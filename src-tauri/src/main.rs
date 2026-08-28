#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::process::{Child, Command};
use serde::{Deserialize, Serialize};
use tauri::State;

struct AppState {
    rqbit_process: Mutex<Option<Child>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct RqbitStatus {
    pub running: bool,
    pub listen_addr: String,
    pub pid: Option<u32>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StreamResult {
    pub torrent_id: u32,
    pub file_index: usize,
    pub file_name: String,
    pub file_size: u64,
    pub stream_url: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TorrentFileItem {
    pub id: usize,
    pub name: String,
    pub length: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TorrentDetailsResponse {
    pub id: u32,
    pub name: Option<String>,
    pub files: Option<Vec<TorrentFileItem>>,
}

// 1. Start rqbit background server process
#[tauri::command]
async fn start_rqbit_server(
    listen_addr: Option<String>,
    cache_dir: Option<String>,
    state: State<'_, AppState>,
) -> Result<RqbitStatus, String> {
    let mut proc_guard = state.rqbit_process.lock().map_err(|e| e.to_string())?;
    
    // If already running, return status
    if let Some(child) = proc_guard.as_mut() {
        if let Ok(None) = child.try_wait() {
            return Ok(RqbitStatus {
                running: true,
                listen_addr: listen_addr.unwrap_or_else(|| "127.0.0.1:3030".to_string()),
                pid: Some(child.id()),
            });
        }
    }

    let addr = listen_addr.unwrap_or_else(|| "127.0.0.1:3030".to_string());
    let cache = cache_dir.unwrap_or_else(|| {
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_else(|_| ".".to_string());
        format!("{}/.cache/yozora/torrents", home)
    });

    // Ensure cache directory exists
    let _ = std::fs::create_dir_all(&cache);

    // Spawn rqbit server start
    match Command::new("rqbit")
        .args(&[
            "--http-api-listen-addr",
            &addr,
            "--http-api-allow-create",
            "server",
            "start",
            &cache,
        ])
        .spawn()
    {
        Ok(child) => {
            let pid = child.id();
            *proc_guard = Some(child);
            Ok(RqbitStatus {
                running: true,
                listen_addr: addr,
                pid: Some(pid),
            })
        }
        Err(e) => Err(format!(
            "Failed to spawn rqbit binary (make sure rqbit is installed via 'pacman -S rqbit' or 'cargo install rqbit'): {}",
            e
        )),
    }
}

// 2. Stop rqbit server process
#[tauri::command]
async fn stop_rqbit_server(state: State<'_, AppState>) -> Result<bool, String> {
    let mut proc_guard = state.rqbit_process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = proc_guard.take() {
        let _ = child.kill();
        return Ok(true);
    }
    Ok(false)
}

// 3. Get rqbit HTTP status check
#[tauri::command]
async fn get_rqbit_status(
    listen_addr: Option<String>,
    state: State<'_, AppState>,
) -> Result<RqbitStatus, String> {
    let addr = listen_addr.unwrap_or_else(|| "127.0.0.1:3030".to_string());
    let url = format!("http://{}/torrents", addr);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(1500))
        .build()
        .map_err(|e| e.to_string())?;

    let is_alive = match client.get(&url).send().await {
        Ok(resp) => resp.status().is_success(),
        Err(_) => false,
    };

    let proc_guard = state.rqbit_process.lock().map_err(|e| e.to_string())?;
    let pid = proc_guard.as_ref().map(|c| c.id());

    Ok(RqbitStatus {
        running: is_alive,
        listen_addr: addr,
        pid,
    })
}

// 4. Add Magnet / Torrent Link and get sequential stream endpoint
#[tauri::command]
async fn add_torrent_stream(
    listen_addr: Option<String>,
    magnet: String,
) -> Result<StreamResult, String> {
    let addr = listen_addr.unwrap_or_else(|| "127.0.0.1:3030".to_string());
    let client = reqwest::Client::new();

    // 1. POST magnet to rqbit
    let add_url = format!("http://{}/torrents", addr);
    let resp = client
        .post(&add_url)
        .body(magnet)
        .header("Content-Type", "text/plain")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to rqbit at {}: {}. Make sure the rqbit daemon is started.", addr, e))?;

    if !resp.status().is_success() {
        return Err(format!("rqbit returned error status: {}", resp.status()));
    }

    let add_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse rqbit add response: {}", e))?;

    let torrent_id = add_json["id"]
        .as_u64()
        .ok_or_else(|| "Invalid torrent ID in rqbit response".to_string())? as u32;

    // 2. Poll for torrent metadata & files
    let details_url = format!("http://{}/torrents/{}", addr, torrent_id);
    let mut target_file_idx = 0;
    let mut file_name = "anime_stream.mkv".to_string();
    let mut file_size: u64 = 0;

    for _ in 0..12 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        if let Ok(details_resp) = client.get(&details_url).send().await {
            if let Ok(details) = details_resp.json::<TorrentDetailsResponse>().await {
                if let Some(files) = details.files {
                    if !files.is_empty() {
                        // Pick largest media file
                        let mut max_len = 0;
                        for file in files {
                            if file.length > max_len {
                                max_len = file.length;
                                target_file_idx = file.id;
                                file_name = file.name;
                                file_size = file.length;
                            }
                        }
                        break;
                    }
                }
            }
        }
    }

    let stream_url = format!("http://{}/torrents/{}/stream/{}", addr, torrent_id, target_file_idx);

    Ok(StreamResult {
        torrent_id,
        file_index: target_file_idx,
        file_name,
        file_size,
        stream_url,
    })
}

// 4b. Direct helper for start_torrent_stream
#[tauri::command]
async fn start_torrent_stream(
    magnet: String,
) -> Result<String, String> {
    let res = add_torrent_stream(None, magnet).await?;
    Ok(res.stream_url)
}

// 5. Launch external mpv binary with hardware acceleration and IPC socket
#[tauri::command]
async fn launch_external_mpv(
    stream_url: String,
    title: String,
) -> Result<bool, String> {
    let window_title = format!("Yozora — {}", title);

    #[cfg(target_os = "windows")]
    let ipc_arg = "--input-ipc-server=\\\\.\\pipe\\yozora-mpv";

    #[cfg(not(target_os = "windows"))]
    let ipc_arg = "--input-ipc-server=/tmp/yozora-mpv.sock";

    Command::new("mpv")
        .args(&[
            "--vo=gpu-next",
            "--hwdec=auto-safe",
            "--force-window=immediate",
            "--keep-open=yes",
            "--sub-auto=all",
            ipc_arg,
            &format!("--title={}", window_title),
            &stream_url,
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn mpv process: {}. Ensure mpv is installed and available on PATH.", e))?;

    Ok(true)
}

#[tauri::command]
async fn open_mpv_player(
    stream_url: String,
    title: String,
) -> Result<(), String> {
    launch_external_mpv(stream_url, title).await.map(|_| ())
}

fn main() {
    tauri::Builder::default()
        .manage(AppState {
            rqbit_process: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_rqbit_server,
            stop_rqbit_server,
            get_rqbit_status,
            add_torrent_stream,
            start_torrent_stream,
            launch_external_mpv,
            open_mpv_player
        ])
        .run(tauri::generate_context!())
        .expect("error while running Yozora application");
}
