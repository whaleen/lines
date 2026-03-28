# lines

Desktop tracing tool for drawing SVG line overlays on top of reference images, then saving the result as:

- a `.lines.json` project file for the editor
- a generated `.tsx` React component for app consumption

The app runs as `Tauri + React + TypeScript` and uses `vite+` for the web toolchain.

## Install

```bash
brew install whaleen/tap/lines
```

The app includes an auto-updater — when a new version is available it will prompt you to install and relaunch without leaving the app.

## Stack

- `Tauri` for the desktop shell, file I/O, and updater
- `React` for the editor UI
- `TypeScript` for the document model and generators
- `Zustand` for editor state
- `Vite+` for dev, build, lint, format, and type checks
- `Radix UI` for tooltips and context menus

## Current Scope

- Open any folder as a project; components are saved to the project's `components/lines/` directory
- Load a reference image into the canvas; control its opacity with the topbar slider
- Trace open or closed line paths — click to place points or press+drag for freehand
- Select paths and points; shift+click for multi-select, ⌘A to select all
- Drag points (node edit) or drag entire paths (select tool)
- Copy, cut, paste, and duplicate paths
- Control z-order (bring forward/back, send to front/back)
- Group paths (⌘G)
- Right-click context menu for duplicate and delete
- Edit fill and stroke color per path using shadcn CSS variable tokens or explicit values
- Edit stroke width and path opacity; style persists to new paths
- Toggle paths open/closed
- Manage layers — visibility, lock, opacity, rename, reorder
- Resize canvas with a 3×3 anchor grid dialog (paths and image shift to match)
- Crop canvas — drag handles to define region, Enter to commit
- Code view tab shows the generated component source in real time
- Auto-save: saves both `.lines.json` and `.tsx` whenever the document is dirty

The reference image is an editor-only layer. The generated component contains only the traced SVG output.

## File Contract

Each traced asset produces two files in the project's `components/lines/` directory:

- `something.lines.json` — editor source of truth
- `something.tsx` — app-facing React component

The generated component uses shadcn CSS variable references (`hsl(var(--foreground))` etc.) and hot-reloads inside any React frontend.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` / `D` | Draw (pen) tool |
| `V` | Select / Move tool |
| `A` | Node edit tool |
| `C` | Crop tool |
| `Enter` | Finish active path / commit crop |
| `Escape` | Cancel active path / cancel crop |
| `Delete` / `Backspace` | Delete selected path or point |
| `⌘A` | Select all paths |
| `⌘D` | Duplicate selected path(s) |
| `⌘C` / `⌘X` / `⌘V` | Copy / Cut / Paste |
| `⌘G` | Group selected paths |
| `⌘]` / `⌘[` | Bring forward / Send backward |
| `⌘⇧]` / `⌘⇧[` | Bring to front / Send to back |
| `Space + drag` | Pan canvas |
| Scroll | Zoom |

## Commands

Primary web toolchain commands:

```bash
npm run dev
npm run build
npm run check
npm run check:fix
```

Desktop commands:

```bash
npm run desktop:dev
npm run desktop:build
```

## Development Notes

- Tauri uses `vp dev` and `vp build` internally via [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json).
- The editor document model lives in [`src/types/lines.ts`](./src/types/lines.ts).
- The generated React component output is produced by [`src/lib/component-generator.ts`](./src/lib/component-generator.ts).
- File writes and project detection are handled by Tauri commands in [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs).
- SVG coordinate mapping uses `createSVGPoint().matrixTransform(getScreenCTM().inverse())` for pixel-accurate pointer conversion at any zoom/pan level.

## Release Pipeline

Releases are built and published via GitHub Actions:

1. Push a version tag (`git tag v1.2.3 && git push origin v1.2.3`)
2. `release.yml` builds a signed universal macOS binary and publishes a GitHub release
3. `update-manifest.yml` fires on the published event and writes `latest.json` to the [homebrew-tap](https://github.com/whaleen/homebrew-tap)
4. Running instances pick up the update on next launch

Signing requires `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets in the repo.

## Verification

```bash
vp check
vp build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Known Issue

`@vitejs/plugin-react` currently emits a Vite+ warning about deprecated esbuild-oriented options during `vp build` and `vp check`. The app still builds and checks cleanly. I left it in place because the current `@vitejs/plugin-react-oxc` package metadata does not yet declare Vite 8 compatibility.
