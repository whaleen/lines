use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

// ── Existing file commands ───────────────────────────────────────────────────

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
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_lines_project(payload: SaveLinesProjectPayload) -> Result<(), String> {
    write_text_file(Path::new(&payload.project_path), &payload.project_source)?;
    write_text_file(Path::new(&payload.component_path), &payload.component_source)?;
    Ok(())
}

#[tauri::command]
fn load_lines_project(project_path: String) -> Result<String, String> {
    fs::read_to_string(Path::new(&project_path)).map_err(|e| e.to_string())
}

// ── Project detection ────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectInfo {
    mode: String,     // "shadcn" | "adhoc"
    lines_dir: String, // absolute path to where components should live
}

/// Reads the repo root for components.json (shadcn marker).
/// If found, derives the lines dir from its aliases.components value.
/// Falls back to adhoc mode with a sensible default.
#[tauri::command]
fn detect_project(folder_path: String) -> Result<ProjectInfo, String> {
    let root = Path::new(&folder_path);
    let components_json = root.join("components.json");

    if components_json.exists() {
        let raw = fs::read_to_string(&components_json).map_err(|e| e.to_string())?;
        let parsed: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;

        // shadcn components.json has aliases.components like "@/components"
        // Resolve that to an absolute path by stripping the alias prefix
        let comp_alias = parsed
            .get("aliases")
            .and_then(|a| a.get("components"))
            .and_then(|v| v.as_str())
            .unwrap_or("src/components");

        // Strip leading alias (@/, ~/, etc.) and treat as relative to root
        let relative = comp_alias
            .trim_start_matches('@')
            .trim_start_matches('~')
            .trim_start_matches('/')
            .trim_start_matches('\\');

        let lines_dir = root.join(relative).join("lines");
        return Ok(ProjectInfo {
            mode: "shadcn".into(),
            lines_dir: lines_dir.to_string_lossy().into_owned(),
        });
    }

    // Adhoc: default to src/components/lines if src exists, else root/lines
    let adhoc_dir = if root.join("src").exists() {
        root.join("src").join("components").join("lines")
    } else {
        root.join("lines")
    };

    Ok(ProjectInfo {
        mode: "adhoc".into(),
        lines_dir: adhoc_dir.to_string_lossy().into_owned(),
    })
}

// ── Component scanning ───────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ComponentEntry {
    name: String,
    tsx_path: String,
    json_path: String,
    has_data: bool,
}

/// Lists all .tsx files in the lines dir, paired with their .lines.json siblings.
#[tauri::command]
fn list_components(lines_dir: String) -> Result<Vec<ComponentEntry>, String> {
    let dir = Path::new(&lines_dir);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut components: Vec<ComponentEntry> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let path = entry.path();
            let ext = path.extension()?.to_str()?;
            if ext != "tsx" {
                return None;
            }
            let stem = path.file_stem()?.to_str()?.to_owned();
            let json_path = dir.join(format!("{}.lines.json", stem));
            Some(ComponentEntry {
                tsx_path: path.to_string_lossy().into_owned(),
                json_path: json_path.to_string_lossy().into_owned(),
                has_data: json_path.exists(),
                name: stem,
            })
        })
        .collect();

    components.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(components)
}

// ── App entry ────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            save_lines_project,
            load_lines_project,
            detect_project,
            list_components,
        ])
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
