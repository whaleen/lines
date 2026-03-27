# lines

Desktop tracing tool for drawing SVG line overlays on top of reference images, then saving the result as:

- a `.lines.json` project file for the editor
- a generated `.tsx` React component for app consumption and HMR

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

- Load a reference image into the canvas
- Trace open line paths — click to place points or press+drag for freehand
- Select paths and points; shift+click for multi-select
- Drag points (node edit) or drag entire paths (select tool)
- Right-click context menu for duplicate and delete
- Edit stroke color and width per path; style persists to new paths
- Duplicate paths (⌘D)
- Delete selected paths or individual points
- Save the editor document and generated component together

The reference image is an editor-only layer. The generated component contains only the traced SVG output.

## File Contract

Each traced asset produces:

- `Something.lines.json` — editor source of truth
- `SomethingLines.tsx` — app-facing React component

The generated component hot-reloads inside any React frontend.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` / `D` | Pen tool |
| `V` | Select / Move tool |
| `A` | Node edit tool |
| `Enter` | Finish active path |
| `Escape` | Cancel active path |
| `Delete` / `Backspace` | Delete selected path or point |
| `⌘D` | Duplicate selected path(s) |
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
- File writes are handled by the Tauri command in [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs).
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
