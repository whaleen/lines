# lines

Desktop tracing tool for drawing SVG line overlays on top of reference images, then saving the result as:

- a `.lines.json` project file for the editor
- a generated `.tsx` React component for app consumption and HMR

The app runs as `Tauri + React + TypeScript` and uses `vite+` for the web toolchain.

## Stack

- `Tauri` for the desktop shell and file writing
- `React` for the editor UI
- `TypeScript` for the document model and generators
- `vite+` for dev, build, lint, format, and type checks
- `Zustand` for editor state

## Current Scope

The current scaffold supports:

- loading a reference image into the canvas
- tracing open line paths over that image
- selecting paths and points
- dragging points in select mode
- editing stroke and stroke width
- deleting selected points or paths
- saving the editor document and generated component together

The reference image is an editor-only layer. The generated component contains only the traced SVG output.

## File Contract

Each traced asset is expected to produce:

- `Something.lines.json`
- `SomethingLines.tsx`

The JSON file is the editor source of truth. The generated TSX file is the app-facing artifact intended to hot reload inside a React frontend.

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

Direct `vite+` commands also work:

```bash
vp dev --host 0.0.0.0 --port 1420 --strictPort
vp build
vp check
vp check --fix
```

## Development Notes

- Tauri uses `vp dev` and `vp build` internally via [`src-tauri/tauri.conf.json`](./src-tauri/tauri.conf.json).
- The editor document model lives in [`src/types/lines.ts`](./src/types/lines.ts).
- The generated React component output is produced by [`src/lib/component-generator.ts`](./src/lib/component-generator.ts).
- File writes are handled by the Tauri command in [`src-tauri/src/lib.rs`](./src-tauri/src/lib.rs).

## Verification

The project is currently verified with:

```bash
vp check
vp build
cargo check --manifest-path src-tauri/Cargo.toml
```

## Known Issue

`@vitejs/plugin-react` currently emits a Vite+ warning about deprecated esbuild-oriented options during `vp build` and `vp check`. The app still builds and checks cleanly. I left it in place because the current `@vitejs/plugin-react-oxc` package metadata does not yet declare Vite 8 compatibility.
