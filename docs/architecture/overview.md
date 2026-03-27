# lines — Architecture Overview

## Process Model

lines is a Tauri 2 desktop app. The frontend (React + TypeScript) runs in a WebView; the backend (Rust) handles native file I/O. Communication goes through typed `invoke` calls.

```
Frontend (WebView)          Backend (Rust)
──────────────────          ──────────────
React + Vite+               tauri::command handlers
Zustand store          ←→   load_lines_project
TraceCanvas (SVG)           save_lines_project
Inspector                   tauri-plugin-dialog
Toolbar                     tauri-plugin-updater
useUpdater hook             tauri-plugin-process
```

## Frontend Structure

```
src/
  App.tsx                  — shell, topbar, update banner, keyboard shortcuts
  components/
    TraceCanvas.tsx        — SVG canvas, drawing, selection, drag, zoom/pan, context menu
    Inspector.tsx          — right panel: path properties, project metadata
    Toolbar.tsx            — left panel: tool selector with Radix tooltips
  hooks/
    useUpdater.ts          — auto-update check, download progress, relaunch
  store/
    editor-store.ts        — Zustand store: all editor state and actions
  lib/
    component-generator.ts — converts LinesDocument → .tsx source string
    document-serializer.ts — LinesDocument → JSON
    path-data.ts           — points[] → SVG path `d` attribute
  types/
    lines.ts               — LinesDocument, LinePath, Point, DEFAULT_DOCUMENT
```

## Document Model (`LinesDocument`)

```ts
{
  name: string
  sourceImage: { src: string; width: number; height: number }
  paths: LinePath[]
  export: { componentName: string; outputPath: string }
}

LinePath: {
  id: string         // "path_<8 random chars>"
  points: Point[]    // { x, y } in image pixel space
  closed: boolean
  stroke: "currentColor" | `#${string}`
  strokeWidth: number
  fill: "none" | string
}
```

The document is saved as `.lines.json`. The generated `.tsx` file is derived from it on every save.

## Editor State (`editor-store.ts`)

Key state slices:

| Field | Purpose |
|-------|---------|
| `document` | The LinesDocument being edited |
| `activeTool` | `"draw"` \| `"select"` \| `"node"` |
| `activePathId` | The path currently being drawn into |
| `selectedPathId` | Primary selected path (inspector target) |
| `selectedPathIds` | All selected paths (multi-select) |
| `selectedPointIndex` | Selected point index in node edit mode |
| `currentStroke` | Stroke color for next new path |
| `currentStrokeWidth` | Stroke width for next new path |
| `referenceImageUrl` | Object URL or `convertFileSrc` URL for the background image |
| `projectPath` | Filesystem path to the `.lines.json` file |

## Canvas Coordinate System

The SVG `viewBox` is driven by `{ x, y, zoom }` viewport state:

```
viewBox = `${viewBoxX} ${viewBoxY} ${width/zoom} ${height/zoom}`
```

Screen → canvas coordinate conversion uses the SVG matrix API for pixel accuracy at any zoom/pan level:

```ts
const pt = svgRef.current.createSVGPoint();
pt.x = clientX; pt.y = clientY;
const r = pt.matrixTransform(svgRef.current.getScreenCTM().inverse());
// r.x, r.y are in image pixel space
```

This avoids the letterboxing errors that occur with `getBoundingClientRect()` math when the SVG's aspect ratio differs from its container.

## Drawing Modes

**Click-to-place (pen tool):** Each `pointerdown` on the canvas calls `addPointAt`. `Enter` finishes; `Escape` cancels.

**Freehand (pen tool, press+drag):** `pointerdown` starts a stroke and sets `isDrawing = true`. A window-level `pointermove` listener samples points at `FREEHAND_THRESHOLD = 4` canvas units. `pointerup` calls `finishActivePath` and clears the drawing state.

Both modes share `addPointAt` in the store — the difference is only in how points are sourced (discrete clicks vs. continuous pointer movement).

## Drag States

Three independent drag state machines run on window-level `pointermove`:

| State | What it does |
|-------|-------------|
| `pointDragState` | Moves a single node handle (node edit tool) |
| `pathDragState` | Moves all selected paths together (select tool); captures `originals` at drag start to avoid drift |
| `panState` | Pans the viewport (spacebar + drag or middle-mouse) |

## File I/O

Both files are written atomically by a single `save_lines_project` Rust command:

```
invoke("save_lines_project", { projectPath, projectSource, componentPath, componentSource })
```

On load, `load_lines_project` reads the JSON and returns it as a string; the frontend parses it and restores `referenceImageUrl` via `convertFileSrc` if `sourceImage.src` is an absolute path.

## Update Pipeline

```
git tag v1.2.3
  → release.yml (GitHub Actions)
    → tauri-action: universal macOS binary + signed .tar.gz
    → GitHub release published
  → update-manifest.yml (triggered by release:published event)
    → fetches release assets via gh api
    → writes latest.json to whaleen/homebrew-tap
      {
        version, pub_date, notes,
        platforms: { "darwin-universal": { url, signature } }
      }

App launch (production)
  → tauri-plugin-updater checks latest.json endpoint
  → if update.available: show banner → user clicks Install
  → downloadAndInstall with progress events → status: "ready"
  → user clicks Relaunch → tauri-plugin-process relaunch()
```

Signing uses a minisign keypair. The public key is embedded in `tauri.conf.json`; the private key lives in `TAURI_SIGNING_PRIVATE_KEY` GitHub secret.
