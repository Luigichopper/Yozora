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
    pub name: String,
    pub length: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TorrentDetailsResponse {
    pub id: u32,
    pub name: Option<String>,
    pub files: Option<Vec<TorrentFileItem>>,
}

fn find_rqbit_executable() -> Option<String> {
    #[cfg(target_os = "windows")]
    let check_cmd = "where.exe";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "which";

    if let Ok(output) = Command::new(check_cmd).arg("rqbit").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                let first_line = path_str.lines().next().unwrap_or("rqbit").to_string();
                return Some(first_line);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let cargo_bin = format!("{}\\.cargo\\bin\\rqbit.exe", user_profile);
        if std::path::Path::new(&cargo_bin).is_file() {
            return Some(cargo_bin);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        let cargo_bin = format!("{}/.cargo/bin/rqbit", home);
        if std::path::Path::new(&cargo_bin).is_file() {
            return Some(cargo_bin);
        }
    }

    None
}

// 1. Start rqbit background server process
#[tauri::command]
async fn start_rqbit_server(
    listen_addr: Option<String>,
    cache_dir: Option<String>,
    state: State<'_, AppState>,
) -> Result<RqbitStatus, String> {
    let addr = listen_addr.unwrap_or_else(|| "127.0.0.1:3030".to_string());

    // Check if already responding
    let check_url = format!("http://{}/torrents", addr);
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(600))
        .build()
        .map_err(|e| e.to_string())?;

    if let Ok(resp) = http_client.get(&check_url).send().await {
        if resp.status().is_success() {
            let pid = {
                let proc_guard = state.rqbit_process.lock().map_err(|e| e.to_string())?;
                proc_guard.as_ref().map(|c| c.id())
            };
            return Ok(RqbitStatus {
                running: true,
                listen_addr: addr,
                pid,
            });
        }
    }

    let cache = cache_dir.unwrap_or_else(|| {
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_else(|_| ".".to_string());
        format!("{}/.cache/yozora/torrents", home)
    });

    // Ensure cache directory exists
    let _ = std::fs::create_dir_all(&cache);

    let rqbit_bin = find_rqbit_executable().unwrap_or_else(|| "rqbit".to_string());

    // Spawn rqbit background server with quiet logging and stateless session mode
    let mut cmd = Command::new(&rqbit_bin);
    cmd.env("RUST_LOG", "error");
    cmd.args(&[
        "--http-api-listen-addr",
        &addr,
        "--http-api-allow-create",
        "server",
        "start",
        "--disable-persistence",
        &cache,
    ]);

    cmd.stdout(std::process::Stdio::null());
    cmd.stderr(std::process::Stdio::null());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let child = cmd.spawn().map_err(|e| format!(
        "Failed to spawn rqbit binary ({:?}): {}. Ensure rqbit is installed via 'cargo install rqbit' and accessible.",
        rqbit_bin, e
    ))?;

    let pid = child.id();
    {
        let mut proc_guard = state.rqbit_process.lock().map_err(|e| e.to_string())?;
        *proc_guard = Some(child);
    }

    // Verify socket availability for up to 3 seconds
    let mut ready = false;
    for _ in 0..15 {
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        if let Ok(resp) = http_client.get(&check_url).send().await {
            if resp.status().is_success() {
                ready = true;
                break;
            }
        }
    }

    if !ready {
        return Err(format!(
            "rqbit process started (PID {}) but did not respond at http://{}/torrents within 3 seconds.",
            pid, addr
        ));
    }

    Ok(RqbitStatus {
        running: true,
        listen_addr: addr,
        pid: Some(pid),
    })
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

    // 1. POST magnet to rqbit with overwrite=true to prevent 400 errors on existing torrent files
    let add_url = format!("http://{}/torrents?overwrite=true", addr);
    let resp = client
        .post(&add_url)
        .body(magnet)
        .header("Content-Type", "text/plain")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to rqbit at {}: {}. Make sure the rqbit daemon is started.", addr, e))?;

    if !resp.status().is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(format!("rqbit returned error: {}", err_text));
    }

    let add_json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse rqbit add response: {}", e))?;

    let torrent_id = add_json["id"]
        .as_u64()
        .or_else(|| add_json["details"]["id"].as_u64())
        .ok_or_else(|| "Invalid torrent ID in rqbit response".to_string())? as u32;

    let mut target_file_idx = 0;
    let mut file_name = "anime_stream.mkv".to_string();
    let mut file_size: u64 = 0;
    let mut found_files = false;

    let is_video = |name: &str| {
        let n = name.to_lowercase();
        n.ends_with(".mkv") || n.ends_with(".mp4") || n.ends_with(".webm") || n.ends_with(".avi") || n.ends_with(".ts")
    };

    // Check if files array is already returned in POST response
    if let Some(files_val) = add_json["details"]["files"].as_array() {
        let mut max_len = 0;
        for (idx, f) in files_val.iter().enumerate() {
            let name = f["name"].as_str().unwrap_or("");
            let length = f["length"].as_u64().unwrap_or(0);
            if is_video(name) && length > max_len {
                max_len = length;
                target_file_idx = idx;
                file_name = name.to_string();
                file_size = length;
                found_files = true;
            }
        }
        if max_len == 0 {
            for (idx, f) in files_val.iter().enumerate() {
                let name = f["name"].as_str().unwrap_or("");
                let length = f["length"].as_u64().unwrap_or(0);
                if length > max_len {
                    max_len = length;
                    target_file_idx = idx;
                    file_name = name.to_string();
                    file_size = length;
                    found_files = true;
                }
            }
        }
    }

    // 2. If not immediately available, poll for torrent metadata & files
    if !found_files {
        let details_url = format!("http://{}/torrents/{}", addr, torrent_id);
        for _ in 0..25 {
            tokio::time::sleep(std::time::Duration::from_millis(300)).await;
            if let Ok(details_resp) = client.get(&details_url).send().await {
                if let Ok(details) = details_resp.json::<TorrentDetailsResponse>().await {
                    if let Some(files) = details.files {
                        if !files.is_empty() {
                            let mut max_len = 0;
                            // 1. Try finding largest video file
                            for (idx, file) in files.iter().enumerate() {
                                if is_video(&file.name) && file.length > max_len {
                                    max_len = file.length;
                                    target_file_idx = idx;
                                    file_name = file.name.clone();
                                    file_size = file.length;
                                }
                            }

                            // 2. Fallback to largest file overall if no extension matched
                            if max_len == 0 {
                                for (idx, file) in files.iter().enumerate() {
                                    if file.length > max_len {
                                        max_len = file.length;
                                        target_file_idx = idx;
                                        file_name = file.name.clone();
                                        file_size = file.length;
                                    }
                                }
                            }
                            break;
                        }
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

// Helper to resolve mpv executable path
fn find_mpv_executable() -> Option<String> {
    // 1. Check if mpv is in PATH
    #[cfg(target_os = "windows")]
    let check_cmd = "where.exe";
    #[cfg(not(target_os = "windows"))]
    let check_cmd = "which";

    if let Ok(output) = Command::new(check_cmd).arg("mpv").output() {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                // where.exe might return multiple lines; take the first one
                let first_line = path_str.lines().next().unwrap_or("mpv").to_string();
                return Some(first_line);
            }
        }
    }

    // 2. Check common Windows installation locations
    #[cfg(target_os = "windows")]
    {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        let program_files_x86 = std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());

        let candidates = vec![
            format!("{}\\mpv\\mpv.exe", program_files),
            format!("{}\\mpv.net\\mpvnet.exe", program_files),
            format!("{}\\mpv\\mpv.exe", program_files_x86),
            format!("{}\\Programs\\mpv\\mpv.exe", local_app_data),
            format!("{}\\scoop\\apps\\mpv\\current\\mpv.exe", user_profile),
            format!("{}\\scoop\\apps\\mpv.net\\current\\mpvnet.exe", user_profile),
            "C:\\ProgramData\\chocolatey\\bin\\mpv.exe".to_string(),
            "C:\\tools\\mpv\\mpv.exe".to_string(),
            "C:\\mpv\\mpv.exe".to_string(),
        ];

        for candidate in candidates {
            if std::path::Path::new(&candidate).is_file() {
                return Some(candidate);
            }
        }
    }

    // 3. Check common Unix locations
    #[cfg(not(target_os = "windows"))]
    {
        let unix_candidates = vec![
            "/usr/bin/mpv",
            "/usr/local/bin/mpv",
            "/opt/homebrew/bin/mpv",
            "/var/lib/flatpak/exports/bin/io.mpv.Mpv",
        ];
        for candidate in unix_candidates {
            if std::path::Path::new(candidate).is_file() {
                return Some(candidate.to_string());
            }
        }
    }

    None
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

    let mpv_bin = find_mpv_executable().unwrap_or_else(|| "mpv".to_string());

    Command::new(&mpv_bin)
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
        .map_err(|e| format!(
            "Failed to launch mpv ({:?}): {}. Ensure mpv is installed (e.g. 'winget install shinchiro.mpv' or 'winget install mpv.net') or available on PATH.",
            mpv_bin, e
        ))?;

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
