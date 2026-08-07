use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use std::sync::Mutex;
#[cfg(target_os = "android")]
use tauri::Manager;

#[cfg(target_os = "android")]
struct AndroidAuto(tauri::plugin::PluginHandle<tauri::Wry>);

#[derive(Clone, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidAutoState {
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    artwork_url: Option<String>,
    is_playing: Option<bool>,
    station_id: Option<i64>,
}

#[derive(Clone, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidAutoStation {
    id: i64,
    name: String,
    artwork_url: String,
    url: String,
    short_name: String,
    needs_proxy: bool,
    is_open_fm: bool,
    open_fm_id: Option<i64>,
}

#[derive(serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidPlaybackState {
    is_playing: bool,
    station_id: Option<i64>,
    error: Option<String>,
}

#[derive(Clone, serde::Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AndroidAutoFavorites {
    favorites: Vec<i64>,
}

#[tauri::command]
fn update_android_auto(state: AndroidAutoState, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("updateState", state)
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = (state, app);
        Ok(())
    }
}

#[tauri::command]
fn sync_android_auto_stations(
    stations: Vec<AndroidAutoStation>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("syncStations", serde_json::json!({ "stations": stations }))
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = (stations, app);
        Ok(())
    }
}

#[tauri::command]
fn play_android_auto_station(station_id: i64, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin(
            "playStation",
            serde_json::json!({ "stationId": station_id }),
        )
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = (station_id, app);
        Ok(())
    }
}

#[tauri::command]
fn pause_android_auto_playback(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("pausePlayback", ())
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
fn resume_android_auto_playback(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("resumePlayback", ())
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
fn set_android_auto_volume(volume: f64, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("setVolume", serde_json::json!({ "volume": volume }))
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = (volume, app);
        Ok(())
    }
}

#[tauri::command]
fn get_android_auto_playback_state(app: tauri::AppHandle) -> Result<AndroidPlaybackState, String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin("getPlaybackState", ())
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(AndroidPlaybackState {
            is_playing: false,
            station_id: None,
            error: None,
        })
    }
}

#[tauri::command]
fn sync_android_auto_favorites(favorites: Vec<i64>, app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin(
            "saveFavorites",
            serde_json::json!({ "favorites": favorites }),
        )
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = (favorites, app);
        Ok(())
    }
}

#[tauri::command]
fn load_android_auto_favorites(app: tauri::AppHandle) -> Result<AndroidAutoFavorites, String> {
    #[cfg(target_os = "android")]
    return app
        .state::<AndroidAuto>()
        .0
        .run_mobile_plugin::<AndroidAutoFavorites>("loadFavorites", ())
        .map_err(|error| error.to_string());

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Ok(AndroidAutoFavorites { favorites: vec![] })
    }
}

#[derive(Default)]
struct DiscordPresence(Mutex<Option<DiscordIpcClient>>);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PresencePayload {
    details: String,
    state: String,
    large_image: String,
    large_text: String,
    small_image: String,
    small_text: String,
}

#[tauri::command]
fn set_discord_presence(
    client_id: String,
    presence: PresencePayload,
    discord: tauri::State<'_, DiscordPresence>,
) -> Result<(), String> {
    if client_id.trim().is_empty() {
        return Err("Discord Rich Presence is not configured".to_string());
    }

    let mut client = discord
        .0
        .lock()
        .map_err(|_| "Discord Rich Presence state is unavailable".to_string())?;

    if client.is_none() {
        let mut new_client = DiscordIpcClient::new(client_id);
        new_client
            .connect()
            .map_err(|error| format!("Unable to connect to Discord: {error}"))?;
        *client = Some(new_client);
    }

    client
        .as_mut()
        .expect("Discord IPC client was initialized")
        .set_activity(
            activity::Activity::new()
                .name("Radyjko")
                .activity_type(activity::ActivityType::Listening)
                .details(presence.details)
                .state(presence.state)
                .assets(
                    activity::Assets::new()
                        .large_image(presence.large_image)
                        .large_text(presence.large_text)
                        .small_image(presence.small_image)
                        .small_text(presence.small_text),
                ),
        )
        .map_err(|error| format!("Unable to update Discord Rich Presence: {error}"))
}

#[tauri::command]
fn clear_discord_presence(discord: tauri::State<'_, DiscordPresence>) -> Result<(), String> {
    let mut client = discord
        .0
        .lock()
        .map_err(|_| "Discord Rich Presence state is unavailable".to_string())?;

    if let Some(mut client) = client.take() {
        client
            .close()
            .map_err(|error| format!("Unable to close Discord IPC client: {error}"))?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        // WebKitGTK + NVIDIA + Wayland can otherwise abort with GDK Error 71.
        std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");

        // AppImage: linuxdeploy bundles libwayland-client which conflicts with
        // newer Mesa (25+), causing WebKitWebProcess to abort with
        // "EGL_BAD_PARAMETER" when eglGetDisplay is called.
        // Disabling the DMABUF renderer avoids the broken bundled path.
        // See: https://github.com/tauri-apps/tauri/issues/15665
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let mut context = tauri::generate_context!();
    let app_icon = tauri::image::Image::from_bytes(include_bytes!("../../public/icon.png"))
        .expect("Radyjko application icon must be a valid PNG");
    context.set_default_window_icon(Some(app_icon));

    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(
        tauri::plugin::Builder::new("radyjko-auto")
            .setup(
                |app: &tauri::AppHandle, api: tauri::plugin::PluginApi<tauri::Wry, ()>| {
                    let handle =
                        api.register_android_plugin("pl.mordorek.radyjko", "RadyjkoAutoPlugin")?;
                    app.manage(AndroidAuto(handle));
                    Ok(())
                },
            )
            .build(),
    );

    builder
        .manage(DiscordPresence::default())
        .invoke_handler(tauri::generate_handler![
            set_discord_presence,
            clear_discord_presence,
            update_android_auto,
            sync_android_auto_stations,
            play_android_auto_station,
            pause_android_auto_playback,
            resume_android_auto_playback,
            set_android_auto_volume,
            get_android_auto_playback_state,
            sync_android_auto_favorites,
            load_android_auto_favorites
        ])
        .run(context)
        .expect("error while running Radyjko desktop application");
}
