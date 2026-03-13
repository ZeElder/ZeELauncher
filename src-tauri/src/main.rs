#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::Command,
};
use tauri::{Emitter, Manager};
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_shell::ShellExt;
use tokio::io::AsyncWriteExt;
use zip::ZipArchive;

const MANIFEST_URL: &str =
    "https://raw.githubusercontent.com/ZeElder/zeelauncher-data/main/manifest.json";
const PATCHNOTES_URL: &str =
    "https://raw.githubusercontent.com/ZeElder/zeelauncher-data/main/patchnotes.json";
const NEWS_URL: &str =
    "https://raw.githubusercontent.com/ZeElder/zeelauncher-data/main/news.json";

const ALLOWED_DATA_HOST: &str = "raw.githubusercontent.com";
const ALLOWED_UPDATE_HOST: &str = "github.com";
const ALLOWED_UPDATE_REPO_PATH: &str = "/ZeElder/ZeELauncher/";
const ALLOWED_GAMES_REPO_PATH: &str = "/ZeElder/zeelauncher-games/";
const ALLOWED_DATA_REPO_PATH: &str = "/ZeElder/zeelauncher-data/";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct InstalledGameEntry {
    installed_version: String,
    install_dir: String,
    exe_relative_path: String,
}

type InstalledGamesMap = HashMap<String, InstalledGameEntry>;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct LauncherInfo {
    name: String,
    version: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GameManifestItem {
    id: String,
    name: String,
    version: String,
    download_url: String,
    sha256: String,
    exe: String,
    size: String,
    description: String,
    cover: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ManifestData {
    launcher: LauncherInfo,
    games: Vec<GameManifestItem>,
    patch_notes: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PatchNoteItem {
    version: String,
    date: String,
    game: String,
    notes: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PatchNotesData {
    patches: Vec<PatchNoteItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct NewsItem {
    title: String,
    content: String,
    date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct NewsData {
    news: Vec<NewsItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UserProfile {
    username: String,
    avatar_url: String,
    banner_url: String,
    bio: String,
    status: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstallProgressPayload {
    game_id: String,
    progress: u64,
    transferred: Option<u64>,
    total: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct InstallStatePayload {
    game_id: String,
    state: String,
    message: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LauncherUpdateProgressPayload {
    progress: u64,
    downloaded: u64,
    total: Option<u64>,
    state: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallGamePayload {
    game_id: String,
    game_name: String,
    version: String,
    download_url: String,
    sha256: String,
    exe_relative_path: String,
    launcher_name: String,
}

fn ensure_dir(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| format!("create_dir_all failed: {e}"))
}

fn get_launcher_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir failed: {e}"))?;

    ensure_dir(&app_data_dir)?;
    Ok(app_data_dir)
}

fn get_games_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = get_launcher_root(app)?.join("games");
    ensure_dir(&dir)?;
    Ok(dir)
}

fn get_temp_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = get_launcher_root(app)?.join("temp");
    ensure_dir(&dir)?;
    Ok(dir)
}

fn get_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = get_launcher_root(app)?.join("cache");
    ensure_dir(&dir)?;
    Ok(dir)
}

fn get_installed_json_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = get_launcher_root(app)?;
    Ok(root.join("installed.json"))
}

fn get_profile_json_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = get_launcher_root(app)?;
    Ok(root.join("profile.json"))
}

fn default_user_profile() -> UserProfile {
    UserProfile {
        username: "Mon Profil".to_string(),
        avatar_url: "".to_string(),
        banner_url: "".to_string(),
        bio: "Joueur ZeELauncher".to_string(),
        status: "En ligne".to_string(),
    }
}

fn validate_game_id(game_id: &str) -> Result<(), String> {
    if game_id.is_empty() {
        return Err("game_id vide".into());
    }

    if !game_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err("game_id invalide".into());
    }

    Ok(())
}

fn validate_relative_safe_path(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);

    if path.is_absolute() {
        return Err("Chemin absolu non autorisé".into());
    }

    if path
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err("Chemin avec .. non autorisé".into());
    }

    Ok(())
}

fn validate_executable_extension(path_str: &str) -> Result<(), String> {
    let path = Path::new(path_str);

    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .ok_or_else(|| "Extension exécutable manquante".to_string())?;

    match ext.as_str() {
        "exe" => Ok(()),
        _ => Err("Extension exécutable non autorisée".into()),
    }
}

fn validate_user_profile(profile: &UserProfile) -> Result<(), String> {
    match profile.status.as_str() {
        "En ligne" | "Inactive" | "Hors ligne" => {}
        _ => return Err("Statut profil invalide".into()),
    }

    if profile.username.trim().is_empty() {
        return Err("Pseudo vide".into());
    }

    if profile.username.len() > 32 {
        return Err("Pseudo trop long".into());
    }

    if profile.bio.len() > 500 {
        return Err("Bio trop longue".into());
    }

    Ok(())
}

fn is_valid_sha256(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|c| c.is_ascii_hexdigit())
}

fn calculate_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path)
        .map_err(|e| format!("open file for sha256 failed: {e}"))?;

    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];

    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|e| format!("read file for sha256 failed: {e}"))?;

        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn allowed_raw_data_url(url: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };

    parsed.scheme() == "https"
        && parsed.host_str() == Some(ALLOWED_DATA_HOST)
        && parsed.path().starts_with(ALLOWED_DATA_REPO_PATH)
}

fn allowed_games_download_url(url: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };

    parsed.scheme() == "https"
        && parsed.host_str() == Some(ALLOWED_UPDATE_HOST)
        && parsed.path().contains(ALLOWED_GAMES_REPO_PATH)
}

fn allowed_update_download_url(url: &str) -> bool {
    let Ok(parsed) = url::Url::parse(url) else {
        return false;
    };

    parsed.scheme() == "https"
        && parsed.host_str() == Some(ALLOWED_UPDATE_HOST)
        && parsed.path().contains(ALLOWED_UPDATE_REPO_PATH)
}

fn read_installed_map(app: &tauri::AppHandle) -> Result<InstalledGamesMap, String> {
    let installed_path = get_installed_json_path(app)?;

    if !installed_path.exists() {
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(&installed_path)
        .map_err(|e| format!("read_to_string failed on {:?}: {e}", installed_path))?;

    if content.trim().is_empty() {
        return Ok(HashMap::new());
    }

    serde_json::from_str::<InstalledGamesMap>(&content)
        .map_err(|e| format!("invalid installed.json format: {e}"))
}

fn write_installed_map(app: &tauri::AppHandle, map: &InstalledGamesMap) -> Result<(), String> {
    let installed_path = get_installed_json_path(app)?;
    let tmp_path = installed_path.with_extension("json.tmp");

    let json = serde_json::to_string_pretty(map)
        .map_err(|e| format!("serialize installed.json failed: {e}"))?;

    fs::write(&tmp_path, json).map_err(|e| format!("write temp installed.json failed: {e}"))?;
    fs::rename(&tmp_path, &installed_path)
        .map_err(|e| format!("rename temp installed.json failed: {e}"))?;

    Ok(())
}

fn get_installed_game(app: &tauri::AppHandle, game_id: &str) -> Result<InstalledGameEntry, String> {
    let installed = read_installed_map(app)?;
    installed
        .get(game_id)
        .cloned()
        .ok_or_else(|| format!("Jeu non installé: {game_id}"))
}

fn emit_install_state(
    app: &tauri::AppHandle,
    game_id: &str,
    state: &str,
    message: Option<String>,
) -> Result<(), String> {
    app.emit(
        "install_state",
        InstallStatePayload {
            game_id: game_id.to_string(),
            state: state.to_string(),
            message,
        },
    )
    .map_err(|e| format!("emit install_state failed: {e}"))
}

fn emit_download_progress(
    app: &tauri::AppHandle,
    game_id: &str,
    progress: u64,
    transferred: Option<u64>,
    total: Option<u64>,
) -> Result<(), String> {
    app.emit(
        "download_progress",
        InstallProgressPayload {
            game_id: game_id.to_string(),
            progress,
            transferred,
            total,
        },
    )
    .map_err(|e| format!("emit download_progress failed: {e}"))
}

fn emit_extract_progress(
    app: &tauri::AppHandle,
    game_id: &str,
    progress: u64,
    transferred: Option<u64>,
    total: Option<u64>,
) -> Result<(), String> {
    app.emit(
        "extract_progress",
        InstallProgressPayload {
            game_id: game_id.to_string(),
            progress,
            transferred,
            total,
        },
    )
    .map_err(|e| format!("emit extract_progress failed: {e}"))
}

fn emit_launcher_update_progress(
    app: &tauri::AppHandle,
    progress: u64,
    downloaded: u64,
    total: Option<u64>,
    state: &str,
) -> Result<(), String> {
    app.emit(
        "launcher_update_progress",
        LauncherUpdateProgressPayload {
            progress,
            downloaded,
            total,
            state: state.to_string(),
        },
    )
    .map_err(|e| format!("emit launcher_update_progress failed: {e}"))
}

fn validate_manifest_data(manifest: &ManifestData) -> Result<(), String> {
    for game in &manifest.games {
        validate_game_id(&game.id)?;
        validate_relative_safe_path(&game.exe)?;
        validate_executable_extension(&game.exe)?;

        if !allowed_games_download_url(&game.download_url) {
            return Err(format!(
                "URL de téléchargement jeu non autorisée pour {}",
                game.id
            ));
        }

        if !allowed_raw_data_url(&game.cover) {
            return Err(format!("URL de cover non autorisée pour {}", game.id));
        }

        if !is_valid_sha256(&game.sha256) {
            return Err(format!("SHA256 invalide pour {}", game.id));
        }

        if game.name.trim().is_empty() || game.version.trim().is_empty() {
            return Err(format!("Manifest invalide pour {}", game.id));
        }
    }

    Ok(())
}

async fn fetch_text(url: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("request failed on {url}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("request failed on {url} with status {}", response.status()));
    }

    response
        .text()
        .await
        .map_err(|e| format!("read body failed on {url}: {e}"))
}

async fn fetch_with_cache<T>(
    app: &tauri::AppHandle,
    url: &str,
    cache_file_name: &str,
) -> Result<T, String>
where
    T: for<'de> Deserialize<'de> + Serialize,
{
    let cache_path = get_cache_dir(app)?.join(cache_file_name);

    match fetch_text(url).await {
        Ok(text) => {
            let parsed = serde_json::from_str::<T>(&text)
                .map_err(|e| format!("invalid JSON from {url}: {e}"))?;

            fs::write(&cache_path, text)
                .map_err(|e| format!("write cache failed on {:?}: {e}", cache_path))?;

            Ok(parsed)
        }
        Err(network_error) => {
            if cache_path.exists() {
                let cached = fs::read_to_string(&cache_path)
                    .map_err(|e| format!("read cache failed on {:?}: {e}", cache_path))?;

                serde_json::from_str::<T>(&cached)
                    .map_err(|e| format!("invalid cached JSON on {:?}: {e}", cache_path))
            } else {
                Err(network_error)
            }
        }
    }
}

async fn download_zip(
    app: &tauri::AppHandle,
    game_id: &str,
    url: &str,
    destination: &Path,
) -> Result<(), String> {
    if !allowed_games_download_url(url) {
        return Err("Download URL non autorisée".into());
    }

    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("download request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("download failed with status {}", response.status()));
    }

    let total_size = response.content_length();
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    let mut file = tokio::fs::File::create(destination)
        .await
        .map_err(|e| format!("create zip file failed: {e}"))?;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("download chunk failed: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write chunk failed: {e}"))?;

        downloaded += chunk.len() as u64;

        let progress = if let Some(total) = total_size {
            if total > 0 {
                (downloaded.saturating_mul(100) / total).min(100)
            } else {
                0
            }
        } else {
            0
        };

        let _ = emit_download_progress(app, game_id, progress, Some(downloaded), total_size);
    }

    file.flush()
        .await
        .map_err(|e| format!("flush zip file failed: {e}"))?;

    let _ = emit_download_progress(app, game_id, 100, Some(downloaded), total_size);
    Ok(())
}

fn extract_zip_sync(
    app: &tauri::AppHandle,
    game_id: &str,
    zip_path: &Path,
    target_dir: &Path,
) -> Result<(), String> {
    let zip_file = fs::File::open(zip_path)
        .map_err(|e| format!("open zip failed on {:?}: {e}", zip_path))?;

    let mut archive =
        ZipArchive::new(zip_file).map_err(|e| format!("invalid zip archive: {e}"))?;

    let total_entries = archive.len().max(1);

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("read zip entry failed: {e}"))?;

        let outpath = if let Some(safe_path) = entry.enclosed_name() {
            target_dir.join(safe_path)
        } else {
            continue;
        };

        if entry.is_dir() {
            fs::create_dir_all(&outpath)
                .map_err(|e| format!("create extracted dir failed: {e}"))?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("create parent dir failed: {e}"))?;
            }

            let mut outfile = fs::File::create(&outpath)
                .map_err(|e| format!("create extracted file failed: {e}"))?;

            let mut buffer = Vec::new();
            entry.read_to_end(&mut buffer)
                .map_err(|e| format!("read zip entry bytes failed: {e}"))?;

            outfile
                .write_all(&buffer)
                .map_err(|e| format!("write extracted file failed: {e}"))?;
        }

        let progress = (((i + 1) as u64).saturating_mul(100) / (total_entries as u64)).min(100);
        let _ = emit_extract_progress(
            app,
            game_id,
            progress,
            Some((i + 1) as u64),
            Some(total_entries as u64),
        );
    }

    Ok(())
}

#[tauri::command]
async fn get_manifest(app: tauri::AppHandle) -> Result<ManifestData, String> {
    let manifest =
        fetch_with_cache::<ManifestData>(&app, MANIFEST_URL, "manifest.json").await?;
    validate_manifest_data(&manifest)?;
    Ok(manifest)
}

#[tauri::command]
async fn get_patch_notes(app: tauri::AppHandle) -> Result<PatchNotesData, String> {
    fetch_with_cache::<PatchNotesData>(&app, PATCHNOTES_URL, "patchnotes.json").await
}

#[tauri::command]
async fn get_news(app: tauri::AppHandle) -> Result<NewsData, String> {
    fetch_with_cache::<NewsData>(&app, NEWS_URL, "news.json").await
}

#[tauri::command]
async fn get_user_profile(app: tauri::AppHandle) -> Result<UserProfile, String> {
    let profile_path = get_profile_json_path(&app)?;

    if !profile_path.exists() {
        let profile = default_user_profile();
        let json = serde_json::to_string_pretty(&profile)
            .map_err(|e| format!("serialize default profile failed: {e}"))?;

        fs::write(&profile_path, json)
            .map_err(|e| format!("write default profile failed: {e}"))?;

        return Ok(profile);
    }

    let content = fs::read_to_string(&profile_path)
        .map_err(|e| format!("read profile failed: {e}"))?;

    if content.trim().is_empty() {
        return Ok(default_user_profile());
    }

    serde_json::from_str::<UserProfile>(&content)
        .map_err(|e| format!("invalid profile.json format: {e}"))
}

#[tauri::command]
async fn save_user_profile(app: tauri::AppHandle, profile: UserProfile) -> Result<(), String> {
    validate_user_profile(&profile)?;

    let profile_path = get_profile_json_path(&app)?;
    let tmp_path = profile_path.with_extension("json.tmp");

    let json = serde_json::to_string_pretty(&profile)
        .map_err(|e| format!("serialize profile failed: {e}"))?;

    fs::write(&tmp_path, json)
        .map_err(|e| format!("write temp profile failed: {e}"))?;

    fs::rename(&tmp_path, &profile_path)
        .map_err(|e| format!("rename temp profile failed: {e}"))?;

    Ok(())
}

#[tauri::command]
async fn list_installed(app: tauri::AppHandle) -> Result<InstalledGamesMap, String> {
    read_installed_map(&app)
}

#[tauri::command]
async fn install_game(app: tauri::AppHandle, payload: InstallGamePayload) -> Result<(), String> {
    validate_game_id(&payload.game_id)?;
    validate_relative_safe_path(&payload.exe_relative_path)?;
    validate_executable_extension(&payload.exe_relative_path)?;

    if !allowed_games_download_url(&payload.download_url) {
        return Err("Download URL non autorisée".into());
    }

    if !is_valid_sha256(&payload.sha256) {
        return Err("SHA256 jeu invalide".into());
    }

    let game_id = payload.game_id.clone();

    let _ = emit_install_state(&app, &game_id, "downloading", Some("Téléchargement...".into()));
    let _ = emit_download_progress(&app, &game_id, 0, Some(0), None);
    let _ = emit_extract_progress(&app, &game_id, 0, Some(0), None);

    let temp_dir = get_temp_dir(&app)?;
    let games_dir = get_games_dir(&app)?;

    let zip_path = temp_dir.join(format!("{}.zip", payload.game_id));
    let staging_dir = temp_dir.join(format!("{}-staging", payload.game_id));
    let final_install_dir = games_dir.join(&payload.game_id);

    if staging_dir.exists() {
        fs::remove_dir_all(&staging_dir)
            .map_err(|e| format!("remove old staging dir failed: {e}"))?;
    }

    ensure_dir(&staging_dir)?;
    download_zip(&app, &payload.game_id, &payload.download_url, &zip_path).await?;

    let computed_hash = calculate_sha256(&zip_path)?;
    if computed_hash.to_lowercase() != payload.sha256.to_lowercase() {
        let _ = fs::remove_file(&zip_path);
        return Err("SHA256 du ZIP invalide".into());
    }

    let _ = emit_install_state(&app, &game_id, "extracting", Some("Extraction...".into()));

    let app_clone = app.clone();
    let game_id_clone = payload.game_id.clone();
    let zip_path_clone = zip_path.clone();
    let staging_dir_clone = staging_dir.clone();

    tokio::task::spawn_blocking(move || {
        extract_zip_sync(&app_clone, &game_id_clone, &zip_path_clone, &staging_dir_clone)
    })
    .await
    .map_err(|e| format!("extract task join failed: {e}"))??;

    if final_install_dir.exists() {
        let games_root = get_games_dir(&app)?
            .canonicalize()
            .map_err(|e| format!("canonicalize games dir failed: {e}"))?;

        let existing_final = final_install_dir
            .canonicalize()
            .map_err(|e| format!("canonicalize install dir failed: {e}"))?;

        if !existing_final.starts_with(&games_root) {
            return Err("Dossier installation hors zone autorisée".into());
        }

        fs::remove_dir_all(&final_install_dir)
            .map_err(|e| format!("remove previous install dir failed: {e}"))?;
    }

    fs::rename(&staging_dir, &final_install_dir)
        .map_err(|e| format!("move staging dir to final dir failed: {e}"))?;

    if zip_path.exists() {
        let _ = fs::remove_file(&zip_path);
    }

    let mut installed = read_installed_map(&app)?;
    installed.insert(
        payload.game_id.clone(),
        InstalledGameEntry {
            installed_version: payload.version.clone(),
            install_dir: final_install_dir.to_string_lossy().to_string(),
            exe_relative_path: payload.exe_relative_path.clone(),
        },
    );
    write_installed_map(&app, &installed)?;

    let _ = emit_install_state(
        &app,
        &game_id,
        "completed",
        Some("Installation terminée".into()),
    );
    Ok(())
}

#[tauri::command]
async fn uninstall_game(app: tauri::AppHandle, game_id: String) -> Result<(), String> {
    validate_game_id(&game_id)?;

    let mut installed = read_installed_map(&app)?;

    let game = installed
        .get(&game_id)
        .cloned()
        .ok_or_else(|| format!("Jeu non installé: {game_id}"))?;

    let install_dir = PathBuf::from(game.install_dir);

    if install_dir.exists() {
        let games_root = get_games_dir(&app)?
            .canonicalize()
            .map_err(|e| format!("canonicalize games dir failed: {e}"))?;
        let canonical_install_dir = install_dir
            .canonicalize()
            .map_err(|e| format!("canonicalize install dir failed: {e}"))?;

        if !canonical_install_dir.starts_with(&games_root) {
            return Err("Suppression dossier non autorisée".into());
        }

        fs::remove_dir_all(&canonical_install_dir)
            .map_err(|e| format!("remove game dir failed: {e}"))?;
    }

    installed.remove(&game_id);
    write_installed_map(&app, &installed)?;

    Ok(())
}

#[tauri::command]
async fn launch_game(app: tauri::AppHandle, game_id: String) -> Result<(), String> {
    validate_game_id(&game_id)?;

    let installed = get_installed_game(&app, &game_id)?;
    validate_relative_safe_path(&installed.exe_relative_path)?;
    validate_executable_extension(&installed.exe_relative_path)?;

    let install_dir = PathBuf::from(&installed.install_dir);

    let exe_relative = Path::new(&installed.exe_relative_path);
    let exe_path = install_dir.join(exe_relative);

    if !exe_path.exists() {
        return Err(format!("Executable introuvable: {:?}", exe_path));
    }

    let canonical_exe_path = exe_path
        .canonicalize()
        .map_err(|e| format!("canonicalize exe failed: {e}"))?;
    let canonical_install_dir = install_dir
        .canonicalize()
        .map_err(|e| format!("canonicalize install dir failed: {e}"))?;

    if !canonical_exe_path.starts_with(&canonical_install_dir) {
        return Err("Executable hors du dossier jeu".into());
    }

    let parent_dir = canonical_exe_path
        .parent()
        .ok_or_else(|| "Impossible de déterminer le dossier du jeu".to_string())?;

    let program = canonical_exe_path.to_string_lossy().to_string();

    app.shell()
        .command(program)
        .current_dir(parent_dir)
        .spawn()
        .map_err(|e| format!("Impossible de lancer le jeu: {e}"))?;

    Ok(())
}

#[tauri::command]
async fn open_game_folder(app: tauri::AppHandle, game_id: String) -> Result<(), String> {
    validate_game_id(&game_id)?;

    let installed = get_installed_game(&app, &game_id)?;
    let install_dir = PathBuf::from(&installed.install_dir);

    if !install_dir.exists() {
        return Err(format!("Dossier introuvable: {:?}", install_dir));
    }

    let games_root = get_games_dir(&app)?
        .canonicalize()
        .map_err(|e| format!("canonicalize games dir failed: {e}"))?;
    let canonical_install_dir = install_dir
        .canonicalize()
        .map_err(|e| format!("canonicalize install dir failed: {e}"))?;

    if !canonical_install_dir.starts_with(&games_root) {
        return Err("Ouverture dossier non autorisée".into());
    }

    app.opener()
        .reveal_item_in_dir(&canonical_install_dir)
        .map_err(|e| format!("Impossible d'ouvrir le dossier: {e}"))?;

    Ok(())
}

#[tauri::command]
async fn download_launcher_update(
    app: tauri::AppHandle,
    url: String,
    sha256: String,
) -> Result<(), String> {
    if !allowed_update_download_url(&url) {
        return Err("URL update non autorisée".into());
    }

    if !is_valid_sha256(&sha256) {
        return Err("SHA256 update invalide".into());
    }

    let _ = emit_launcher_update_progress(&app, 0, 0, None, "downloading");

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("update request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "update download failed with status {}",
            response.status()
        ));
    }

    let total_size = response.content_length();
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    let installer_path = std::env::temp_dir().join("zeelauncher_update.exe");
    let mut file = tokio::fs::File::create(&installer_path)
        .await
        .map_err(|e| format!("create update file failed: {e}"))?;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| format!("update chunk failed: {e}"))?;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("write update chunk failed: {e}"))?;

        downloaded += chunk.len() as u64;

        let progress = if let Some(total) = total_size {
            if total > 0 {
                (downloaded.saturating_mul(100) / total).min(100)
            } else {
                0
            }
        } else {
            0
        };

        let _ = emit_launcher_update_progress(
            &app,
            progress,
            downloaded,
            total_size,
            "downloading",
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("flush update file failed: {e}"))?;

    let computed_hash = calculate_sha256(&installer_path)?;
    if computed_hash.to_lowercase() != sha256.to_lowercase() {
        let _ = fs::remove_file(&installer_path);
        return Err("SHA256 update invalide".into());
    }

    let _ = emit_launcher_update_progress(&app, 100, downloaded, total_size, "ready");
    Ok(())
}

#[tauri::command]
async fn install_downloaded_launcher_update(app: tauri::AppHandle) -> Result<(), String> {
    let installer_path = std::env::temp_dir().join("zeelauncher_update.exe");

    if !installer_path.exists() {
        return Err("Aucune mise à jour téléchargée.".into());
    }

    let _ = emit_launcher_update_progress(&app, 100, 0, None, "launching");

    Command::new(&installer_path)
        .spawn()
        .map_err(|e| format!("launch installer failed: {e}"))?;

    std::process::exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            get_manifest,
            get_patch_notes,
            get_news,
            get_user_profile,
            save_user_profile,
            list_installed,
            install_game,
            uninstall_game,
            launch_game,
            open_game_folder,
            download_launcher_update,
            install_downloaded_launcher_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}