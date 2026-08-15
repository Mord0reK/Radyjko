package pl.mordorek.radyjko

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.app.SearchManager
import android.graphics.Bitmap
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.support.v4.media.MediaBrowserCompat
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.support.v4.media.RatingCompat
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.media.MediaBrowserServiceCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.Normalizer
import java.util.concurrent.TimeUnit

data class NowPlayingTrack(
    val title: String = "",
    val artist: String = "",
    val artworkUrl: String = "",
)

object RadyjkoAutoState {
    var title = "Radyjko"
    var artist = ""
    var album = "Radyjko"
    var artworkUrl = ""
    var isPlaying = false
    var activeStationId: Long? = null
    var stations: List<AutoStationArgs> = emptyList()
    var nowPlaying: Map<Long, NowPlayingTrack> = emptyMap()
    var favorites: Set<Long> = emptySet()
    var playbackError: String? = null
}

class RadyjkoAutoService : MediaBrowserServiceCompat() {
    private lateinit var mediaSession: MediaSessionCompat
    private lateinit var player: ExoPlayer
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var artworkBitmap: Bitmap? = null
    private var loadedArtworkUrl: String? = null
    private var stationsLoadJob: Job? = null
    private var nowPlayingWs: WebSocket? = null
    private var nowPlayingClient: OkHttpClient? = null
    private var nowPlayingReconnectJob: Job? = null
    private var nowPlayingReconnectAttempt = 0
    private var shutdownJob: Job? = null
    private var androidAutoClientCount = 0
    private var stopping = false
    private var playbackScope = PlaybackScope.ALL

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannel()
        player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                    .build(),
                true,
            )
            addListener(object : Player.Listener {
                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    RadyjkoAutoState.isPlaying = isPlaying
                    if (isPlaying) RadyjkoAutoState.playbackError = null
                    if (isPlaying) {
                        cancelPendingShutdown()
                        startNowPlayingWs()
                    } else {
                        scheduleShutdown()
                    }
                    applyState()
                }

                override fun onPlayerError(error: PlaybackException) {
                    RadyjkoAutoState.playbackError = "Nie udało się odtworzyć stacji"
                    applyState()
                }
            })
        }
        mediaSession = MediaSessionCompat(this, "RadyjkoAndroidAuto").apply {
            setRatingType(RatingCompat.RATING_HEART)
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() = resumePlayback()
                override fun onPause() = pausePlayback()
                override fun onSkipToNext() = playAdjacentStation(1)
                override fun onSkipToPrevious() = playAdjacentStation(-1)
                override fun onSkipToQueueItem(id: Long) = playStation(id)
                override fun onSetRating(rating: RatingCompat?) {
                    val stationId = RadyjkoAutoState.activeStationId ?: return
                    val isFavorite = rating?.isRated == true && rating.hasHeart()
                    setFavorite(stationId, isFavorite)
                }
                override fun onCustomAction(action: String?, extras: Bundle?) {
                    if (action == ACTION_ADD_FAVORITE || action == ACTION_REMOVE_FAVORITE) {
                        RadyjkoAutoState.activeStationId?.let { stationId ->
                            setFavorite(stationId, action == ACTION_ADD_FAVORITE)
                        }
                    }
                }
                override fun onPlayFromMediaId(mediaId: String?, extras: Bundle?) {
                    val selection = parseMediaId(mediaId) ?: return
                    setPlaybackScope(selection.first)
                    playStation(selection.second)
                }
                override fun onPlayFromSearch(query: String?, extras: Bundle?) {
                    playFromSearchQuery(query, extras)
                }
                override fun onPrepareFromSearch(query: String?, extras: Bundle?) {
                    playFromSearchQuery(query, extras)
                }
                override fun onPlayFromUri(uri: Uri?, extras: Bundle?) {
                    val stationQuery = uri?.getQueryParameter("station")
                        ?: uri?.lastPathSegment
                    playFromSearchQuery(stationQuery, extras)
                }
            })
            isActive = true
        }
        sessionToken = mediaSession.sessionToken
        RadyjkoAutoState.stations = loadCachedStations(applicationContext)
        RadyjkoAutoState.favorites = loadFavorites(applicationContext).toSet()
        applyQueue()
        applyState()
        ensureStationsLoaded()
        pendingVolume?.let {
            player.volume = it
            pendingVolume = null
        }
        pendingStationId?.let {
            pendingStationId = null
            playStation(it)
        }
        pendingSearch?.let { (query, extras) ->
            pendingSearch = null
            playFromSearchQuery(query, extras)
        }
    }

    override fun onDestroy() {
        stopping = true
        shutdownJob?.cancel()
        shutdownJob = null
        stopNowPlayingWs()
        serviceScope.cancel()
        player.release()
        mediaSession.release()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        instance = null
        super.onDestroy()
    }

    override fun onGetRoot(
        clientPackageName: String,
        clientUid: Int,
        rootHints: Bundle?,
    ): BrowserRoot {
        // MediaBrowserServiceCompat nie udostępnia osobnego callbacku dla klienta.
        // Licznik jest zerowany w onUnbind, gdy Android Auto odłączy usługę.
        androidAutoClientCount++
        cancelPendingShutdown()
        startNowPlayingWs()
        return BrowserRoot(ROOT_ID, null)
    }

    override fun onUnbind(intent: Intent): Boolean {
        androidAutoClientCount = 0
        scheduleShutdown()
        return super.onUnbind(intent)
    }

    override fun onLoadChildren(
        parentId: String,
        result: Result<MutableList<MediaBrowserCompat.MediaItem>>,
    ) {
        val items = if (parentId == ROOT_ID) {
            mutableListOf(
                MediaBrowserCompat.MediaItem(
                    android.support.v4.media.MediaDescriptionCompat.Builder()
                        .setMediaId(FAVORITES_ID)
                        .setTitle("Ulubione")
                        .build(),
                    MediaBrowserCompat.MediaItem.FLAG_BROWSABLE,
                ),
                MediaBrowserCompat.MediaItem(
                    android.support.v4.media.MediaDescriptionCompat.Builder()
                        .setMediaId(STATIONS_ID)
                        .setTitle("Stacje")
                        .build(),
                    MediaBrowserCompat.MediaItem.FLAG_BROWSABLE,
                ),
            )
        } else if (parentId == STATIONS_ID || parentId == FAVORITES_ID) {
            if (RadyjkoAutoState.stations.isEmpty()) {
                ensureStationsLoaded()
                result.detach()
                serviceScope.launch {
                    stationsLoadJob?.join()
                    result.sendResult(createStationItems(scopeForParent(parentId)))
                }
                return
            }
            createStationItems(scopeForParent(parentId))
        } else {
            mutableListOf()
        }
        result.sendResult(items)
    }

    private fun createStationItems(scope: PlaybackScope): MutableList<MediaBrowserCompat.MediaItem> =
        stationsForScope(scope).map { station ->
            val nowPlaying = RadyjkoAutoState.nowPlaying[station.id]
            val description = android.support.v4.media.MediaDescriptionCompat.Builder()
                .setMediaId(mediaId(scope, station.id))
                .setTitle(station.name)
            nowPlaying?.let { track ->
                if (track.title.isNotBlank()) {
                    description.setSubtitle("${track.artist} — ${track.title}")
                }
            }
            if (station.artworkUrl.isNotBlank()) {
                description.setIconUri(Uri.parse(station.artworkUrl))
            }
            MediaBrowserCompat.MediaItem(
                description.build(),
                MediaBrowserCompat.MediaItem.FLAG_PLAYABLE,
            )
        }.toMutableList()

    private fun ensureStationsLoaded() {
        if (RadyjkoAutoState.stations.isNotEmpty() && RadyjkoAutoState.stations.all { it.url.isNotBlank() }) return
        if (stationsLoadJob?.isActive == true) return

        stationsLoadJob = serviceScope.launch {
            val stations = withContext(Dispatchers.IO) { fetchStations() }
            if (stations.isNotEmpty()) {
                updateStations(applicationContext, stations)
            }
        }
    }

    private fun playFromSearchQuery(query: String?, extras: Bundle?) {
        cancelPendingShutdown()
        startNowPlayingWs()

        val searchQuery = extractSearchQuery(query, extras)
        if (searchQuery.isNullOrBlank()) {
            val fallbackStationId = RadyjkoAutoState.activeStationId
                ?: RadyjkoAutoState.favorites.firstOrNull()
                ?: RadyjkoAutoState.stations.firstOrNull()?.id
            if (fallbackStationId != null) {
                setPlaybackScope(PlaybackScope.ALL)
                playStation(fallbackStationId)
            } else {
                resumePlayback()
            }
            return
        }

        fun playMatch() {
            val station = findStationByQuery(searchQuery, RadyjkoAutoState.stations)
            if (station != null) {
                setPlaybackScope(PlaybackScope.ALL)
                playStation(station.id)
            } else {
                resumePlayback()
            }
        }

        if (RadyjkoAutoState.stations.isEmpty()) {
            ensureStationsLoaded()
            serviceScope.launch {
                stationsLoadJob?.join()
                playMatch()
            }
        } else {
            playMatch()
        }
    }

    private fun playStation(stationId: Long) {
        cancelPendingShutdown()
        startNowPlayingWs()
        val station = RadyjkoAutoState.stations.firstOrNull { it.id == stationId } ?: return
        val openFmId = station.openFmId
        if (station.url.isBlank() && (!station.isOpenFM || openFmId == null)) {
            ensureStationsLoaded()
            serviceScope.launch {
                stationsLoadJob?.join()
                if (RadyjkoAutoState.stations.firstOrNull { it.id == stationId }?.url?.isNotBlank() == true) {
                    playStation(stationId)
                }
            }
            return
        }
        val streamUrl = if (station.needsProxy) {
            Uri.parse("${BuildConfig.API_BASE_URL}/api/stream")
                .buildUpon()
                .appendQueryParameter("station", station.shortName)
                .build()
                .toString()
        } else {
            station.url
        }
        RadyjkoAutoState.activeStationId = station.id
        RadyjkoAutoState.playbackError = null
        RadyjkoAutoState.title = station.name
        RadyjkoAutoState.artist = ""
        RadyjkoAutoState.album = station.name
        RadyjkoAutoState.artworkUrl = station.artworkUrl
        loadArtwork(station.artworkUrl)
        applyState()
        if (station.isOpenFM && openFmId != null) {
            serviceScope.launch {
                withContext(Dispatchers.IO) { fetchOpenFmStreamUrl(openFmId) }
                    ?.let { startPlayback(it, isHls = true) }
            }
            return
        }
        startPlayback(streamUrl, isHls = streamUrl.substringBefore('?').endsWith(".m3u8"))
    }

    private fun playAdjacentStation(direction: Int) {
        adjacentStationId(
            stationsForScope(playbackScope),
            RadyjkoAutoState.activeStationId,
            direction,
        )?.let(::playStation)
    }

    private fun stationsForScope(scope: PlaybackScope): List<AutoStationArgs> = orderedStations(
        RadyjkoAutoState.stations,
        RadyjkoAutoState.favorites,
        scope,
    )

    private fun setPlaybackScope(scope: PlaybackScope) {
        if (playbackScope == scope) return
        playbackScope = scope
        applyQueue()
    }

    private fun startPlayback(streamUrl: String, isHls: Boolean) {
        player.setMediaItem(
            MediaItem.Builder()
                .setUri(streamUrl)
                .setMimeType(if (isHls) MimeTypes.APPLICATION_M3U8 else null)
                .build(),
        )
        player.prepare()
        player.play()
    }

    private fun pausePlayback() {
        player.pause()
        scheduleShutdown()
    }

    private fun resumePlayback() {
        cancelPendingShutdown()
        startNowPlayingWs()
        if (player.currentMediaItem == null) {
            RadyjkoAutoState.activeStationId?.let { playStation(it) }
        } else {
            player.play()
        }
    }

    private fun applyState() {
        val nowPlaying = RadyjkoAutoState.nowPlaying[RadyjkoAutoState.activeStationId]
        val trackTitle = nowPlaying?.title?.takeIf { it.isNotBlank() } ?: RadyjkoAutoState.title
        val trackArtist = nowPlaying?.artist?.takeIf { it.isNotBlank() } ?: RadyjkoAutoState.artist
        val displayArtwork = RadyjkoAutoState.artworkUrl
        val displayStation = RadyjkoAutoState.album.takeIf { it.isNotBlank() } ?: "Radyjko"
        val displayTrack = listOf(trackTitle, trackArtist)
            .filter { it.isNotBlank() }
            .joinToString(" • ")
        val rating = RatingCompat.newHeartRating(
            RadyjkoAutoState.activeStationId?.let { RadyjkoAutoState.favorites.contains(it) } == true,
        )

        val metadata = MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, displayStation)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, displayStation)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, displayTrack)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, displayStation)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, displayTrack)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, displayTrack)
                .putRating(MediaMetadataCompat.METADATA_KEY_RATING, rating)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM_ART_URI, displayArtwork)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON_URI, displayArtwork)
        artworkBitmap?.let { bitmap ->
            metadata.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bitmap)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, bitmap)
                .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, bitmap)
        }
        mediaSession.setMetadata(metadata.build())

        val state = if (RadyjkoAutoState.isPlaying) {
            PlaybackStateCompat.STATE_PLAYING
        } else {
            PlaybackStateCompat.STATE_PAUSED
        }
        val actions = PlaybackStateCompat.ACTION_PLAY or
            PlaybackStateCompat.ACTION_PAUSE or
            PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
            PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS or
            PlaybackStateCompat.ACTION_SKIP_TO_QUEUE_ITEM or
            PlaybackStateCompat.ACTION_PLAY_FROM_MEDIA_ID or
            PlaybackStateCompat.ACTION_PLAY_FROM_SEARCH or
            PlaybackStateCompat.ACTION_PREPARE_FROM_SEARCH or
            PlaybackStateCompat.ACTION_SET_RATING
        val playbackState = PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1f)
        RadyjkoAutoState.activeStationId?.let {
            val isFavorite = RadyjkoAutoState.favorites.contains(it)
            playbackState.addCustomAction(
                PlaybackStateCompat.CustomAction.Builder(
                    if (isFavorite) ACTION_REMOVE_FAVORITE else ACTION_ADD_FAVORITE,
                    if (isFavorite) {
                        "Usuń z ulubionych"
                    } else {
                        "Dodaj do ulubionych"
                    },
                    if (isFavorite) R.drawable.ic_favorite_filled else R.drawable.ic_favorite_outline,
                ).build(),
            )
        }
        RadyjkoAutoState.activeStationId?.let { playbackState.setActiveQueueItemId(it) }
        mediaSession.setPlaybackState(
            playbackState.build(),
        )
        updatePlaybackNotification(displayStation, displayTrack)
        RadyjkoAutoPlugin.triggerPlaybackStateChanged()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Odtwarzanie radia",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Sterowanie odtwarzaniem Radyjka"
            },
        )
    }

    private fun mediaAction(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, RadyjkoMediaActionReceiver::class.java).setAction(action)
        return PendingIntent.getBroadcast(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun updatePlaybackNotification(title: String, subtitle: String) {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
        val playPauseAction = if (RadyjkoAutoState.isPlaying) {
            NotificationCompat.Action(
                android.R.drawable.ic_media_pause,
                "Pauza",
                mediaAction(RadyjkoMediaActionReceiver.ACTION_PAUSE, 2),
            )
        } else {
            NotificationCompat.Action(
                android.R.drawable.ic_media_play,
                "Odtwórz",
                mediaAction(RadyjkoMediaActionReceiver.ACTION_PLAY, 2),
            )
        }

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setOngoing(RadyjkoAutoState.isPlaying)
            .addAction(
                android.R.drawable.ic_media_previous,
                "Poprzednia",
                mediaAction(RadyjkoMediaActionReceiver.ACTION_PREVIOUS, 1),
            )
            .addAction(playPauseAction)
            .addAction(
                android.R.drawable.ic_media_next,
                "Następna",
                mediaAction(RadyjkoMediaActionReceiver.ACTION_NEXT, 3),
            )
            .setStyle(
                MediaNotificationCompat.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2),
            )
            .apply {
                artworkBitmap?.let { setLargeIcon(it) }
            }
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun applyQueue() {
        val queue = stationsForScope(playbackScope).map { station ->
            val nowPlaying = RadyjkoAutoState.nowPlaying[station.id]
            val parts = mutableListOf<String>()
            nowPlaying?.artist?.takeIf { it.isNotBlank() }?.let { parts.add(it) }
            nowPlaying?.title?.takeIf { it.isNotBlank() }?.let { parts.add(it) }
            val subtitle = parts.joinToString(" — ").takeIf { it.isNotBlank() }
            val description = android.support.v4.media.MediaDescriptionCompat.Builder()
                .setMediaId(mediaId(playbackScope, station.id))
                .setTitle(station.name)
                .setSubtitle(subtitle)
            if (station.artworkUrl.isNotBlank()) {
                description.setIconUri(Uri.parse(station.artworkUrl))
            }
            MediaSessionCompat.QueueItem(
                description.build(),
                station.id,
            )
        }
        mediaSession.setQueue(queue)
        mediaSession.setQueueTitle(if (playbackScope == PlaybackScope.FAVORITES) "Ulubione" else "Stacje")
    }

    private fun loadArtwork(url: String) {
        if (url.isBlank() || url == loadedArtworkUrl) return
        loadedArtworkUrl = url
        serviceScope.launch {
            val request = ImageRequest.Builder(this@RadyjkoAutoService)
                .data(url).allowHardware(false).size(512).build()
            val result = ImageLoader(this@RadyjkoAutoService).execute(request)
            artworkBitmap = if (result is SuccessResult) {
                (result.drawable as? BitmapDrawable)?.bitmap
            } else null
            applyState()
        }
    }

    private fun startNowPlayingWs() {
        if (stopping || nowPlayingWs != null || nowPlayingReconnectJob?.isActive == true) return

        if (!isNowPlayingNeeded()) return

        val wsUrl = "${BuildConfig.API_BASE_URL.replace("https://", "wss://").replace("http://", "ws://")}/api/nowplaying"
        val client = OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build()
        nowPlayingClient = client
        val request = Request.Builder()
            .url(wsUrl)
            .header("User-Agent", "Radyjko-Android-${BuildConfig.VERSION_NAME}")
            .build()

        nowPlayingWs = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val envelope = JSONObject(text)
                    val type = envelope.optString("type", "")
                    if (type == "snapshot" || type == "update") {
                        val payload = envelope.getJSONObject("payload")
                        val nowPlayingObj = payload.optJSONObject("nowPlaying") ?: return
                        val newNowPlaying = mutableMapOf<Long, NowPlayingTrack>()
                        nowPlayingObj.keys().forEach { stationIdStr ->
                            val stationId = stationIdStr.toLongOrNull() ?: return@forEach
                            val song = nowPlayingObj.getJSONObject(stationIdStr)
                            val station = RadyjkoAutoState.stations.firstOrNull { it.id == stationId }
                            val fallbackArtwork = station?.artworkUrl
                                ?.takeIf { it.isNotBlank() }
                                ?: station?.shortName?.let(::stationArtworkUrl).orEmpty()
                            newNowPlaying[stationId] = NowPlayingTrack(
                                title = song.optString("title", ""),
                                artist = song.optString("artist", ""),
                                artworkUrl = song.optString("cover", "")
                                    .takeIf { it.isNotBlank() }
                                    ?: fallbackArtwork,
                            )
                        }
                        RadyjkoAutoState.nowPlaying = newNowPlaying
                        nowPlayingReconnectAttempt = 0
                        applyState()
                    }
                } catch (error: Exception) {
                    Log.w(TAG, "Nie udało się sparsować wiadomości nowplaying WebSocket", error)
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                Log.w(TAG, "Błąd WebSocket nowplaying: ${t.message}")
                nowPlayingWs = null
                scheduleNowPlayingReconnect()
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.d(TAG, "WebSocket nowplaying zamknięty: $code $reason")
                nowPlayingWs = null
                scheduleNowPlayingReconnect()
            }
        })

        Log.d(TAG, "WebSocket nowplaying uruchomiony: $wsUrl")
    }

    private fun stopNowPlayingWs() {
        nowPlayingReconnectJob?.cancel()
        nowPlayingReconnectJob = null
        nowPlayingWs?.close(1000, "Service destroyed")
        nowPlayingWs = null
        nowPlayingClient?.dispatcher?.executorService?.shutdown()
        nowPlayingClient = null
    }

    private fun setFavorite(stationId: Long, favorite: Boolean) {
        val next = RadyjkoAutoState.favorites.toMutableSet().apply {
            if (favorite) add(stationId) else remove(stationId)
        }
        updateFavorites(applicationContext, next.toList())
    }

    private fun scheduleNowPlayingReconnect() {
        if (stopping || !isNowPlayingNeeded() || nowPlayingReconnectJob?.isActive == true) return
        val delayMs = minOf(60_000L, 5_000L * (1L shl nowPlayingReconnectAttempt.coerceAtMost(4)))
        nowPlayingReconnectAttempt++
        nowPlayingReconnectJob = serviceScope.launch {
            delay(delayMs)
            nowPlayingReconnectJob = null
            startNowPlayingWs()
        }
    }

    private fun isNowPlayingNeeded(): Boolean =
        RadyjkoAutoState.isPlaying || androidAutoClientCount > 0

    private fun cancelPendingShutdown() {
        shutdownJob?.cancel()
        shutdownJob = null
    }

    private fun scheduleShutdown() {
        if (stopping || isNowPlayingNeeded() || shutdownJob?.isActive == true) return

        shutdownJob = serviceScope.launch {
            delay(IDLE_SHUTDOWN_DELAY_MS)
            shutdownJob = null
            if (stopping || isNowPlayingNeeded()) return@launch

            stopNowPlayingWs()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
            stopSelf()
        }
    }

    companion object {
        private const val ROOT_ID = "radyjko-root"
        private const val STATIONS_ID = "radyjko-stations"
        private const val FAVORITES_ID = "radyjko-favorites"
        private const val STATION_MEDIA_ID_PREFIX = "station:"
        private const val FAVORITE_MEDIA_ID_PREFIX = "favorite:"
        private const val ACTION_ADD_FAVORITE = "pl.mordorek.radyjko.ADD_FAVORITE"
        private const val ACTION_REMOVE_FAVORITE = "pl.mordorek.radyjko.REMOVE_FAVORITE"
        private const val TAG = "RadyjkoAuto"
        private const val PREFERENCES_NAME = "radyjko_android_auto"
        private const val STATIONS_PREFERENCE_KEY = "stations"
        private const val FAVORITES_PREFERENCE_KEY = "favorites"
        private const val NOTIFICATION_CHANNEL_ID = "radyjko.playback"
        private const val NOTIFICATION_ID = 9501
        private const val IDLE_SHUTDOWN_DELAY_MS = 60_000L
        private var instance: RadyjkoAutoService? = null
        private var pendingStationId: Long? = null
        private var pendingVolume: Float? = null
        private var pendingSearch: Pair<String?, Bundle?>? = null

        private fun normalizeSearchText(text: String): String =
            Normalizer.normalize(text.replace('ł', 'l').replace('Ł', 'L'), Normalizer.Form.NFD)
                .replace("\\p{InCombiningDiacriticalMarks}+".toRegex(), "")
                .lowercase()
                .replace("[^a-z0-9 ]".toRegex(), " ")
                .replace("\\s+".toRegex(), " ")
                .trim()

        private fun stripNoiseWords(text: String): String = text.split(" ")
            .filter { word ->
                word !in setOf(
                    "radio", "radia", "stacja", "stacje", "stacji", "fm",
                    "wlacz", "odtworz", "graj", "zagraj", "prosze", "mi", "w", "na",
                )
            }
            .joinToString(" ")
            .trim()

        fun extractSearchQuery(query: String?, extras: Bundle?): String? {
            query?.takeIf { it.isNotBlank() }?.let { return it }
            extras?.getString(SearchManager.QUERY)?.takeIf { it.isNotBlank() }?.let { return it }
            extras?.getString(MediaStore.EXTRA_MEDIA_TITLE)?.takeIf { it.isNotBlank() }?.let { return it }
            extras?.getString(MediaStore.EXTRA_MEDIA_ARTIST)?.takeIf { it.isNotBlank() }?.let { return it }
            extras?.getString(MediaStore.EXTRA_MEDIA_ALBUM)?.takeIf { it.isNotBlank() }?.let { return it }
            return null
        }

        fun findStationByQuery(rawQuery: String, stations: List<AutoStationArgs>): AutoStationArgs? {
            val query = normalizeSearchText(rawQuery)
            if (query.isBlank() || stations.isEmpty()) return null
            val cleanQuery = stripNoiseWords(query)

            stations.firstOrNull { station ->
                val name = normalizeSearchText(station.name)
                val shortName = normalizeSearchText(station.shortName.replace('-', ' '))
                query == name || query == shortName || cleanQuery == stripNoiseWords(name) ||
                    (cleanQuery.isNotBlank() && cleanQuery == stripNoiseWords(shortName))
            }?.let { return it }

            val queryTokens = (if (cleanQuery.isNotBlank()) cleanQuery else query)
                .split(" ").filter { it.length > 1 }
            if (queryTokens.isEmpty()) return null

            return stations.firstOrNull { station ->
                val searchable = "${normalizeSearchText(station.name)} " +
                    normalizeSearchText(station.shortName.replace('-', ' '))
                queryTokens.all { token -> searchable.contains(token) }
            }
        }

        private fun scopeForParent(parentId: String): PlaybackScope =
            if (parentId == FAVORITES_ID) PlaybackScope.FAVORITES else PlaybackScope.ALL

        private fun mediaId(scope: PlaybackScope, stationId: Long): String = when (scope) {
            PlaybackScope.ALL -> "$STATION_MEDIA_ID_PREFIX$stationId"
            PlaybackScope.FAVORITES -> "$FAVORITE_MEDIA_ID_PREFIX$stationId"
        }

        private fun parseMediaId(mediaId: String?): Pair<PlaybackScope, Long>? {
            if (mediaId == null) return null
            if (mediaId.startsWith(FAVORITE_MEDIA_ID_PREFIX)) {
                return mediaId.removePrefix(FAVORITE_MEDIA_ID_PREFIX).toLongOrNull()
                    ?.let { PlaybackScope.FAVORITES to it }
            }
            if (mediaId.startsWith(STATION_MEDIA_ID_PREFIX)) {
                return mediaId.removePrefix(STATION_MEDIA_ID_PREFIX).toLongOrNull()
                    ?.let { PlaybackScope.ALL to it }
            }
            return mediaId.toLongOrNull()?.let { PlaybackScope.ALL to it }
        }

        private fun stationArtworkUrl(shortName: String): String {
            return "${BuildConfig.API_BASE_URL}/ikony/$shortName.webp"
        }

        private fun hasSameStationCatalog(
            current: List<AutoStationArgs>,
            incoming: List<AutoStationArgs>,
        ): Boolean {
            if (current.size != incoming.size) return false
            return current.zip(incoming).all { (left, right) ->
                left.id == right.id &&
                    left.name == right.name &&
                    left.artworkUrl == right.artworkUrl &&
                    left.url == right.url &&
                    left.shortName == right.shortName &&
                    left.needsProxy == right.needsProxy &&
                    left.isOpenFM == right.isOpenFM &&
                    left.openFmId == right.openFmId
            }
        }

        fun updateState(state: AutoStateArgs) {
            state.title?.let { RadyjkoAutoState.title = it }
            state.artist?.let { RadyjkoAutoState.artist = it }
            state.album?.let { RadyjkoAutoState.album = it }
            state.artworkUrl?.let { RadyjkoAutoState.artworkUrl = it }
            state.stationId?.let { RadyjkoAutoState.activeStationId = it }
            state.artworkUrl?.let { instance?.loadArtwork(it) }
            instance?.applyState()
        }

        fun updateStations(context: android.content.Context, stations: List<AutoStationArgs>) {
            if (hasSameStationCatalog(RadyjkoAutoState.stations, stations)) return

            RadyjkoAutoState.stations = stations
            persistStations(context, stations)
            instance?.applyQueue()
            instance?.notifyChildrenChanged(ROOT_ID)
            instance?.notifyChildrenChanged(STATIONS_ID)
        }

        fun requestPlay(context: android.content.Context, stationId: Long) {
            val service = instance
            if (service != null) {
                service.setPlaybackScope(PlaybackScope.ALL)
                service.playStation(stationId)
                return
            }

            pendingStationId = stationId
            ContextCompat.startForegroundService(
                context,
                Intent(context, RadyjkoAutoService::class.java),
            )
        }

        fun requestPlayFromSearch(
            context: android.content.Context,
            query: String?,
            extras: Bundle?,
        ) {
            val service = instance
            if (service != null) {
                service.playFromSearchQuery(query, extras)
                return
            }
            pendingSearch = query to extras
            ContextCompat.startForegroundService(
                context,
                Intent(context, RadyjkoAutoService::class.java),
            )
        }

        fun requestPause() {
            instance?.pausePlayback()
        }

        fun requestResume(context: android.content.Context) {
            val service = instance
            if (service != null) {
                service.resumePlayback()
                return
            }

            RadyjkoAutoState.activeStationId?.let { requestPlay(context, it) }
        }

        fun requestAdjacent(direction: Int) {
            instance?.playAdjacentStation(direction)
        }

        fun requestVolume(volume: Float) {
            val service = instance
            if (service != null) service.player.volume = volume
            else pendingVolume = volume
        }

        fun saveFavorites(context: android.content.Context, favorites: List<Long>) {
            val normalized = favorites.distinct()
            val normalizedSet = normalized.toSet()
            if (RadyjkoAutoState.favorites == normalizedSet) return

            RadyjkoAutoState.favorites = normalizedSet
            val serialized = JSONArray(normalized).toString()
            context.getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE)
                .edit()
                .putString(FAVORITES_PREFERENCE_KEY, serialized)
                .apply()
            instance?.applyQueue()
            instance?.applyState()
            instance?.notifyChildrenChanged(FAVORITES_ID)
        }

        fun loadFavorites(context: android.content.Context): List<Long> {
            return try {
                val serialized = context
                    .getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE)
                    .getString(FAVORITES_PREFERENCE_KEY, null)
                    ?: return emptyList()
                val array = JSONArray(serialized)
                buildList {
                    for (i in 0 until array.length()) {
                        add(array.getLong(i))
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "Nie udało się odczytać ulubionych", error)
                emptyList()
            }
        }

        fun updateFavorites(context: android.content.Context, favorites: List<Long>) {
            val normalized = favorites.distinct()
            saveFavorites(context, normalized)
            RadyjkoAutoPlugin.triggerFavoritesChanged(normalized)
        }

        private fun loadCachedStations(context: android.content.Context): List<AutoStationArgs> {
            return try {
                val serializedStations = context
                    .getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE)
                    .getString(STATIONS_PREFERENCE_KEY, null)
                    ?: return emptyList()
                val stations = JSONArray(serializedStations)
                buildList {
                    for (index in 0 until stations.length()) {
                        val station = stations.getJSONObject(index)
                        if (!station.has("id") || station.isNull("id")) continue
                        add(AutoStationArgs().apply {
                            id = station.getLong("id")
                            name = station.optString("name")
                            url = station.optString("url")
                            shortName = station.optString("shortName")
                            needsProxy = station.optBoolean("needsProxy")
                            isOpenFM = station.optInt("isOpenFM") != 0 || station.optBoolean("isOpenFM")
                            openFmId = if (station.isNull("openFmId")) null else station.optLong("openFmId")
                            val cachedArtwork = station.optString("artworkUrl")
                            artworkUrl = cachedArtwork.takeIf {
                                it.isNotBlank() && !it.startsWith("${BuildConfig.API_BASE_URL}/ikony/")
                            } ?: stationArtworkUrl(shortName)
                        })
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "Nie udało się odczytać katalogu stacji Android Auto", error)
                emptyList()
            }
        }

        private fun persistStations(context: android.content.Context, stations: List<AutoStationArgs>) {
            val serializedStations = JSONArray().apply {
                stations.forEach { station ->
                    put(JSONObject().apply {
                        put("id", station.id)
                        put("name", station.name)
                        put("artworkUrl", station.artworkUrl)
                        put("url", station.url)
                        put("shortName", station.shortName)
                        put("needsProxy", station.needsProxy)
                        put("isOpenFM", station.isOpenFM)
                        put("openFmId", station.openFmId)
                    })
                }
            }.toString()
            context.getSharedPreferences(PREFERENCES_NAME, android.content.Context.MODE_PRIVATE)
                .edit()
                .putString(STATIONS_PREFERENCE_KEY, serializedStations)
                .apply()
        }

        private fun fetchStations(): List<AutoStationArgs> {
            val artworkByStationId = RadyjkoAutoState.stations.associate { it.id to it.artworkUrl }
            val connection = try {
                URL("${BuildConfig.API_BASE_URL}/api/stations").openConnection() as HttpURLConnection
            } catch (error: Exception) {
                Log.w(TAG, "Nie udało się utworzyć połączenia z katalogiem stacji", error)
                return emptyList()
            }

            return try {
                connection.requestMethod = "GET"
                connection.setRequestProperty("User-Agent", "Radyjko-Android-${BuildConfig.VERSION_NAME}")
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                if (connection.responseCode !in 200..299) {
                    Log.w(TAG, "Katalog stacji zwrócił HTTP ${connection.responseCode}")
                    return emptyList()
                }

                val payload = connection.inputStream.bufferedReader().use { it.readText() }
                val stations = JSONArray(payload)
                buildList {
                    for (index in 0 until stations.length()) {
                        val station = stations.getJSONObject(index)
                        if (!station.has("id") || station.isNull("id")) continue
                        add(AutoStationArgs().apply {
                            id = station.getLong("id")
                            name = station.optString("name")
                            url = station.optString("url")
                            shortName = station.optString("shortName")
                            needsProxy = station.optBoolean("needsProxy")
                            isOpenFM = station.optInt("isOpenFM") != 0 || station.optBoolean("isOpenFM")
                            openFmId = if (station.isNull("openFmId")) null else station.optLong("openFmId")
                            artworkUrl = artworkByStationId[id]
                                ?.takeIf {
                                    it.isNotBlank() && !it.startsWith("${BuildConfig.API_BASE_URL}/ikony/")
                                }
                                ?: stationArtworkUrl(shortName)
                        })
                    }
                }
            } catch (error: Exception) {
                Log.w(TAG, "Nie udało się pobrać katalogu stacji", error)
                emptyList()
            } finally {
                connection.disconnect()
            }
        }

        private fun fetchOpenFmStreamUrl(openFmId: Long): String? {
            val endpoint = "https://open.fm/api/user/token?fp=https://stream-cdn-1.open.fm/OFM$openFmId/ngrp:standard/playlist.m3u8"
            val connection = URL(endpoint).openConnection() as HttpURLConnection
            return try {
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                if (connection.responseCode !in 200..299) return null
                JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
                    .optString("url")
                    .takeIf { it.isNotBlank() }
            } catch (error: Exception) {
                Log.w(TAG, "Nie udało się pobrać adresu streamu OpenFM", error)
                null
            } finally {
                connection.disconnect()
            }
        }

    }
}
