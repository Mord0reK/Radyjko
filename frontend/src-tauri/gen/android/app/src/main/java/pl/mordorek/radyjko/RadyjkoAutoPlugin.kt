package pl.mordorek.radyjko

import android.app.Activity
import android.content.Intent
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray

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

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 9502
        private var instance: RadyjkoAutoPlugin? = null

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
