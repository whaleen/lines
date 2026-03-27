use serde::Deserialize;
use std::{fs, path::Path};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveLinesProjectPayload {
    component_path: String,
    component_source: String,
    project_path: String,
    project_source: String,
}

fn write_text_file(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(path, contents).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_lines_project(payload: SaveLinesProjectPayload) -> Result<(), String> {
    let project_path = Path::new(&payload.project_path);
    let component_path = Path::new(&payload.component_path);

    write_text_file(project_path, &payload.project_source)?;
    write_text_file(component_path, &payload.component_source)?;

    Ok(())
}

#[tauri::command]
fn load_lines_project(project_path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&project_path)).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_lines_project, load_lines_project])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
