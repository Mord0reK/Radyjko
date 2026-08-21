package pl.mordorek.radyjko

import android.app.Activity
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File

@InvokeArg
class AutoStateArgs {
    var title: String? = null
    var artist: String? = null
    var album: String? = null
    var artworkUrl: String? = null
    var isPlaying: Boolean? = null
    var stationId: Long? = null
}

@InvokeArg
class AutoStationArgs {
    var id: Long = 0
    var name: String = ""
    var artworkUrl: String = ""
    var url: String = ""
    var shortName: String = ""
    var needsProxy: Boolean = false
    var isOpenFM: Boolean = false
    var openFmId: Long? = null
}

@InvokeArg
class AutoStationsArgs {
    var stations: Array<AutoStationArgs> = emptyArray()
}

@InvokeArg
class AutoFavoritesArgs {
    var favorites: Array<Long> = emptyArray()
}

@InvokeArg
class AutoSelectedStationArgs {
    var stationId: Long = 0
}

@InvokeArg
class AutoVolumeArgs {
    var volume: Double = 1.0
}

@InvokeArg
class AndroidUpdateArgs {
    var url: String = ""
}

@TauriPlugin
class RadyjkoAutoPlugin(private val activity: Activity) : Plugin(activity) {
    init {
        instance = this
        requestNotificationPermission()
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            ActivityCompat.requestPermissions(
                activity,
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST_CODE,
            )
        }
    }

    @Command
    fun updateState(invoke: Invoke) {
        val state = invoke.parseArgs(AutoStateArgs::class.java)
        RadyjkoAutoService.updateState(state)
        invoke.resolve()
    }

    @Command
    fun syncStations(invoke: Invoke) {
        RadyjkoAutoService.updateStations(
            activity.applicationContext,
            invoke.parseArgs(AutoStationsArgs::class.java).stations.toList(),
        )
        invoke.resolve()
    }

    @Command
    fun playStation(invoke: Invoke) {
        val stationId = invoke.parseArgs(AutoSelectedStationArgs::class.java).stationId
        RadyjkoAutoService.requestPlay(activity.applicationContext, stationId)
        invoke.resolve()
    }

    @Command
    fun pausePlayback(invoke: Invoke) {
        RadyjkoAutoService.requestPause()
        invoke.resolve()
    }

    @Command
    fun resumePlayback(invoke: Invoke) {
        RadyjkoAutoService.requestResume(activity.applicationContext)
        invoke.resolve()
    }

    @Command
    fun setVolume(invoke: Invoke) {
        val volume = invoke.parseArgs(AutoVolumeArgs::class.java).volume.toFloat().coerceIn(0f, 1f)
        RadyjkoAutoService.requestVolume(volume)
        invoke.resolve()
    }

    @Command
    fun getPlaybackState(invoke: Invoke) {
        invoke.resolve(JSObject().apply {
            put("isPlaying", RadyjkoAutoState.isPlaying)
            put("stationId", RadyjkoAutoState.activeStationId)
            put("error", RadyjkoAutoState.playbackError)
        })
    }

    @Command
    fun saveFavorites(invoke: Invoke) {
        val args = invoke.parseArgs(AutoFavoritesArgs::class.java)
        RadyjkoAutoService.saveFavorites(activity.applicationContext, args.favorites.toList())
        invoke.resolve()
    }

    @Command
    fun loadFavorites(invoke: Invoke) {
        val favorites = RadyjkoAutoService.loadFavorites(activity.applicationContext)
        val payload = JSObject()
        payload.put("favorites", JSONArray(favorites))
        invoke.resolve(payload)
    }

    @Command
    fun installApk(invoke: Invoke) {
        val url = invoke.parseArgs(AndroidUpdateArgs::class.java).url
        val parsedUrl = Uri.parse(url)
        if (parsedUrl.scheme != "https" || parsedUrl.host != "github.com" ||
            !parsedUrl.path.orEmpty().startsWith("/Mord0reK/Radyjko/releases/download/")) {
            invoke.reject("Nieprawidłowy adres aktualizacji")
            return
        }

        Thread {
            try {
                val request = Request.Builder().url(url)
                    .header("Accept", "application/octet-stream")
                    .header("User-Agent", "Radyjko-Android-${BuildConfig.VERSION_NAME}")
                    .build()
                val response = OkHttpClient().newCall(request).execute()
                if (!response.isSuccessful) throw IllegalStateException("Pobieranie APK nie powiodło się (${response.code})")

                val body = response.body ?: throw IllegalStateException("Pobrany plik APK jest pusty")
                if (body.contentLength() > MAX_APK_SIZE) throw IllegalStateException("Plik APK jest zbyt duży")

                val updateDirectory = File(activity.cacheDir, "apk-updates").apply { mkdirs() }
                val apkFile = File(updateDirectory, "radyjko-update.apk")
                val totalBytes = body.contentLength()
                var downloadedBytes = 0L
                val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                body.byteStream().use { input ->
                    apkFile.outputStream().use { output ->
                        var bytesRead = input.read(buffer)
                        while (bytesRead >= 0) {
                            if (bytesRead > 0) {
                                output.write(buffer, 0, bytesRead)
                                downloadedBytes += bytesRead
                                triggerApkDownloadProgress(downloadedBytes, totalBytes, "downloading")
                            }
                            bytesRead = input.read(buffer)
                        }
                    }
                }

                activity.runOnUiThread {
                    triggerApkDownloadProgress(downloadedBytes, totalBytes, "installing")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
                        val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
                            data = Uri.parse("package:${activity.packageName}")
                        }
                        activity.startActivity(settingsIntent)
                        invoke.reject("Zezwól Radyjku na instalowanie aplikacji, a następnie spróbuj ponownie")
                    } else {
                        val apkUri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", apkFile)
                        val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
                            setDataAndType(apkUri, "application/vnd.android.package-archive")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        activity.startActivity(installIntent)
                        invoke.resolve()
                    }
                }
            } catch (error: Exception) {
                activity.runOnUiThread { invoke.reject(error.message ?: "Nie udało się pobrać APK") }
            }
        }.start()
    }

    companion object {
        private const val MAX_APK_SIZE = 100L * 1024L * 1024L
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 9502
        private var instance: RadyjkoAutoPlugin? = null

        private fun triggerApkDownloadProgress(downloaded: Long, total: Long, phase: String) {
            instance?.trigger("apkDownloadProgress", JSObject().apply {
                put("downloaded", downloaded)
                put("total", total)
                put("percent", if (total > 0) (downloaded * 100 / total).toInt() else 0)
                put("phase", phase)
            })
        }

        fun triggerFavoritesChanged(favorites: List<Long>) {
            instance?.trigger("favoritesChanged", JSObject().apply {
                put("favorites", JSONArray(favorites))
            })
        }

        fun triggerPlaybackStateChanged() {
            instance?.trigger("playbackStateChanged", JSObject().apply {
                put("isPlaying", RadyjkoAutoState.isPlaying)
                put("stationId", RadyjkoAutoState.activeStationId)
                put("error", RadyjkoAutoState.playbackError)
            })
        }

    }
}
