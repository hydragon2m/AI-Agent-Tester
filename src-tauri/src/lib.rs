use std::process::{Command, Child};
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::Manager;

struct BackendProcess(Arc<Mutex<Option<Child>>>);

/// Tìm binary server đã được đóng gói.
/// - Production: `hydra-server[.exe]` nằm cạnh file .exe cài đặt (Tauri resource)
/// - Dev mode: fallback về node src/server/app.js
fn find_server_binary() -> Option<PathBuf> {
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    #[cfg(target_os = "windows")]
    let bin_name = "hydra-server.exe";
    #[cfg(not(target_os = "windows"))]
    let bin_name = "hydra-server";

    let bin_path = exe_dir.join(bin_name);
    if bin_path.exists() {
        println!("[Backend] Tìm thấy binary: {:?}", bin_path);
        return Some(bin_path);
    }

    println!("[Backend] Không tìm thấy binary tại {:?}, fallback sang dev mode.", bin_path);
    None
}

/// Spawn binary server (production) hoặc node (dev).
fn start_backend() -> Option<Child> {
    if let Some(bin_path) = find_server_binary() {
        // ── Production mode: chạy binary đóng gói ────────────────────────
        match Command::new(&bin_path).spawn() {
            Ok(child) => {
                println!("[Backend] Binary server khởi động, PID={}", child.id());
                return Some(child);
            }
            Err(e) => {
                eprintln!("[Backend] Không thể chạy binary {:?}: {}", bin_path, e);
            }
        }
    }

    // ── Dev mode: chạy qua node ───────────────────────────────────────────
    let dev_candidates = [
        ("node", "src/server/app.js"),
    ];

    for (cmd, script) in &dev_candidates {
        match Command::new(cmd).arg(script).spawn() {
            Ok(child) => {
                println!("[Backend] Dev mode: '{}' PID={}", cmd, child.id());
                return Some(child);
            }
            Err(e) => {
                eprintln!("[Backend] Dev fallback '{}' thất bại: {}", cmd, e);
            }
        }
    }

    eprintln!("[Backend] KHÔNG THỂ khởi động server. Kiểm tra binary hoặc cài Node.js.");
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let child_state = Arc::new(Mutex::new(None::<Child>));
    let child_state_clone = Arc::clone(&child_state);

    tauri::Builder::default()
        .manage(BackendProcess(child_state))
        .setup(move |_app| {
            #[cfg(debug_assertions)]
            {
                _app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            if let Some(child) = start_backend() {
                let mut guard = child_state_clone.lock().unwrap();
                *guard = Some(child);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let state = app.state::<BackendProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(mut child) = guard.take() {
                    println!("[Backend] Đang dừng server process...");
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
