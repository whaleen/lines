# lines — Status

## What's Working

Everything in SPEC.md marked ✅ is shipped. The core loop works end to end:

- Open a reference image and trace paths over it (click-to-place or freehand press+drag)
- Select, move, and edit paths with the select and node edit tools
- Multi-select with shift+click; duplicate with ⌘D or context menu
- Stroke color and width editable per path; style persists to new paths
- Save `.lines.json` project and generated `.tsx` React component
- Reload a saved project (image path and paths round-trip correctly)
- Install via Homebrew; in-app auto-updater with download progress and relaunch prompt

## Known Rough Edges

- **No fit-to-window on image load**: canvas resets to zoom=1 at origin; you may need to zoom/pan to find the image if it's large
- **No unsaved changes indicator**: the app doesn't warn before close if there are unsaved changes
- **Stroke colors are raw hex**: no CSS var support yet; generated component won't automatically adapt to the consumer's theme
- **No close path toggle**: all paths are open polylines; no way to close them in the editor
- **Synchronous project open**: no loading indicator while Tauri reads the project file (fast in practice)

## What's Next

- Fit-to-window on image load (zoom + pan to center image in canvas area)
- Close path toggle (open ↔ closed polyline)
- CSS var stroke colors with shadcn palette suggestions
- Auto-save (debounced write on every change)
- File association (double-click `.lines.json` opens in editor)
- Drag-and-drop image and project file onto canvas/window
- CLI (`lines init`, `lines add`, `lines list`) for consuming components in downstream projects
