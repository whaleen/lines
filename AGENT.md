# lines — Agent Instructions

## What This Is

**lines** is a lightweight desktop SVG path editor built with Tauri + React + TypeScript. It has two distinct parts:

1. **Desktop editor** — trace reference images, draw SVG paths, export as React components
2. **CLI + registry** — a shadcn-style install convention (`npx lines add <name>`) for a public component library of traced drawings

The output of the editor is not raw SVG — it's a React component that uses CSS custom properties for theming (compatible with shadcn's CSS variable system).

## Stack

- **Tauri 2** — desktop shell (Rust backend, web frontend)
- **React 18 + TypeScript** — editor UI
- **Zustand** — editor state
- **Vite+ (`vp`)** — build toolchain (wraps Vite, Vitest, Oxlint, Oxfmt — use `vp` not `npm run`)
- **Rust** — file I/O, Tauri commands

## Running Locally

```bash
# Web preview only
vp dev

# Desktop (requires Tauri CLI + Rust)
npm run desktop:dev
```

Do not use `npm run dev` to start the Tauri app. Use `npm run desktop:dev`.

## Key Files

```
src/
  App.tsx                    # Root layout, keyboard shortcuts, file load
  components/
    TraceCanvas.tsx          # SVG canvas — draw, select, pan, zoom
    Toolbar.tsx              # Tool palette
    Inspector.tsx            # Right sidebar: path properties, project settings
  store/
    editor-store.ts          # Zustand store — all editor state and actions
  types/
    lines.ts                 # LinesDocument, TracePath, Point types
  lib/
    path-data.ts             # Point[] → SVG path string
    component-generator.ts   # LinesDocument → React TSX component
    document-serializer.ts   # LinesDocument → JSON
src-tauri/src/
  lib.rs                     # Tauri commands: save_lines_project, load_lines_project
```

## Project File Convention

A lines component ships two files:

- `components/lines/MyComponent.tsx` — the React component (consumable)
- `components/lines/data/MyComponent.lines.json` — the edit source of truth

`lines init` creates the `components/lines/data/` directory in a project.
`lines add <name>` copies both files from the registry into the right places.

## Gotchas

- Vite+ wraps all tooling — use `vp check`, `vp test`, `vp lint`, not bare tool commands
- The `.lines.json` is the source of truth for editing; the `.tsx` is generated output
- Component theming uses CSS custom properties, not hardcoded colors — keep it shadcn-compatible
- Tauri file dialogs use `@tauri-apps/plugin-dialog` — native OS picker, not browser `<input>`
- The editor canvas is a plain SVG element, not a canvas element

## Spec

See `SPEC.md` for the full feature roadmap.

## Docs

See `docs/` for architecture and design decisions (to be added).
