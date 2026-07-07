use std::process::{Command, Child};
use std::sync::{Arc, Mutex};
use tauri::Manager;

struct BackendProcess(Arc<Mutex<Option<Child>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let child_state = Arc::new(Mutex::new(None));
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

      println!("Starting backend process: node src/server/app.js");
      
      // Determine the directory of the backend
      // During development/running, the cwd of the CLI command is the project root (prototype/)
      let child = Command::new("node")
        .arg("src/server/app.js")
        .spawn();

      match child {
        Ok(c) => {
          println!("Backend process started successfully with PID: {}", c.id());
          let mut guard = child_state_clone.lock().unwrap();
          *guard = Some(c);
        }
        Err(e) => {
          eprintln!("Failed to start backend process: {}", e);
        }
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        let app = window.app_handle();
        let state = app.state::<BackendProcess>();
        let mut guard = state.0.lock().unwrap();
        if let Some(mut child) = guard.take() {
          println!("Killing backend process...");
          let _ = child.kill();
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
