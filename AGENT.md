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
- **Rust** — file I/O, project detection, Tauri commands

## Running Locally

```bash
# Web preview only
vp dev

# Desktop (requires Tauri CLI + Rust)
npm run desktop:dev
```

Do not use `npm run dev` to start the Tauri app. Use `npm run desktop:dev`.

## Architecture

The app has three screens managed by `project-store.ts`:

- **LaunchScreen** — recent projects list, open folder
- **ProjectScreen** — lists components (`.tsx` + `.lines.json` pairs) in the project's `linesDir`
- **EditorScreen** — the full editor for a single component

Project detection (`detect_project` Tauri command) reads `components.json` and `tsconfig.json` to resolve the correct `linesDir` path, accounting for `@/` alias remapping via tsconfig path mappings.

## Key Files

```
src/
  App.tsx                        # Screen router (launch / project / editor)
  screens/
    LaunchScreen.tsx             # Recent projects + open folder
    ProjectScreen.tsx            # Component list, rename, delete, new
    EditorScreen.tsx             # Full editor shell, keyboard shortcuts, auto-save
  components/
    TraceCanvas.tsx              # SVG canvas — draw, select, pan, zoom, crop
    Toolbar.tsx                  # Tool palette (Select, Node, Draw, Crop)
    Inspector.tsx                # Right panel: canvas info, fill, stroke, opacity, open/closed
    LayersPanel.tsx              # Layer management (visibility, lock, opacity, order)
    CanvasResizeDialog.tsx       # Resize dialog with 3×3 anchor grid
    ColorModePicker.tsx          # Dark/light/system color mode toggle
  store/
    editor-store.ts              # Zustand store — all editor state and actions
    project-store.ts             # Multi-project state — recents, open, navigate screens
  types/
    lines.ts                     # LinesDocument, LinesLayer, TracePath, Point, CssColor types
    project.ts                   # Project, ComponentEntry, ProjectMode types
  lib/
    path-data.ts                 # Point[] → SVG path string
    component-generator.ts       # LinesDocument → React TSX component source
    document-serializer.ts       # LinesDocument → JSON
    theme.ts                     # Theme utilities
  hooks/
    useUpdater.ts                # In-app auto-updater hook (Tauri plugin)
src-tauri/src/
  lib.rs                         # Tauri commands: save/load project, detect_project,
                                 # list_components, delete_component, rename_component, copy_file
```

## Project File Convention

A lines component ships two files alongside each other in the project's `linesDir`:

- `MyComponent.tsx` — the generated React component (app-consumable)
- `MyComponent.lines.json` — the edit source of truth

Component names are free-form — only invalid filename characters are stripped. No forced casing or suffix.

## Gotchas

- Vite+ wraps all tooling — use `vp check`, `vp test`, `vp lint`, not bare tool commands
- The `.lines.json` is the source of truth for editing; the `.tsx` is generated output
- Component theming uses CSS custom properties (`hsl(var(--token))`), not hardcoded colors
- Tauri file dialogs use `@tauri-apps/plugin-dialog` — native OS picker, not browser `<input>`
- The editor canvas is a plain SVG element, not a canvas element
- `detect_project` reads `tsconfig.json` to resolve `@/` alias → actual `src/` prefix; stale recents are re-detected on every `openProject` call
- Zustand selectors use `useShallow` — always destructure from a single `useShallow` call to avoid infinite render loops

## Memory

Project agent memory lives in `.memory/` (index at `.memory/MEMORY.md`). Read it at session start before making changes. Write new memories there — not to `~/.claude/` or any other location.

Global cross-project memory is at `~/.pemguin/memory/MEMORY.md`.

## Spec

See `SPEC.md` for the full feature checklist.

## Docs

See `docs/` for architecture and design decisions (to be added).
