# lines — Spec

Feature source of truth. Update this when features ship, change, or get cut.

## Multi-Project System

- ✅ Launch screen — recent projects list, open folder
- ✅ Project screen — list components in `linesDir`, open/new/rename/delete
- ✅ Editor screen — edit a single component, back to project
- ✅ Project detection — reads `components.json` + `tsconfig.json` to resolve `linesDir`
- ✅ Recents — persisted via `@tauri-apps/plugin-store`, last 20 projects
- ✅ `linesDir` re-detected on every open (stale recents self-heal)
- ✅ Color mode per project (dark / light / system), persisted to store

## Editor — Canvas

- ✅ Load reference image (PNG/JPG) as non-exportable background layer
- ✅ Pan (spacebar + drag, or middle-mouse drag)
- ✅ Zoom (scroll wheel, zoom buttons, fit button)
- ✅ SVG canvas with correct viewport/transform (getScreenCTM for pixel-accurate coordinate mapping)
- ✅ Reference image opacity control (topbar slider)
- ✅ Canvas resize dialog — 3×3 anchor grid, W/H inputs, paths and image shift accordingly
- ✅ Crop tool — drag handles to define crop region, Enter to commit, Escape to cancel
- ✅ Code view tab — shows generated component source
- 📋 Fit-to-window on image load
- 📋 Zoom to fit / zoom to 100% keyboard shortcuts
- 📋 Canvas background color toggle (white / dark / transparent grid)

## Editor — Tools

- ✅ Pen tool — click to place points (open polyline)
- ✅ Pen tool — press and drag for freehand continuous stroke (auto-finishes on pointerup)
- ✅ Select tool (click path to select, drag to move)
- ✅ Node edit tool — select individual points on a path, drag to reposition
- ✅ Crop tool — drag handles on canvas to set crop region
- ✅ Finish path (Enter)
- ✅ Cancel active path (Escape)
- ✅ Delete selected path(s) (Delete/Backspace)
- ✅ Delete individual point (Delete/Backspace in node edit mode)
- ✅ Multi-select — shift+click to add/remove paths from selection
- ✅ Select all (⌘A)
- ✅ Duplicate path(s) — ⌘D
- ✅ Copy / Cut / Paste — ⌘C / ⌘X / ⌘V
- ✅ Group paths — ⌘G
- ✅ Z-order — ⌘] / ⌘[ (forward/back), ⌘⇧] / ⌘⇧[ (front/back)
- ✅ Right-click context menu — Duplicate / Delete with selection count
- 📋 Insert point on path segment (click on edge)
- 📋 Bezier curve handles (v2, deferred)
- 📋 Ungroup (⌘⇧G)

## Editor — Toolbar

- ✅ Tool palette with SVG icons (Select, Node Edit, Draw, Crop)
- ✅ Tool keyboard shortcuts shown in tooltip (V, A, P/D, C)
- ✅ Active tool highlight

## Editor — Inspector / Properties

- ✅ Canvas section: size stat, "Resize…" button
- ✅ Fill color picker (none / currentColor / shadcn theme tokens)
- ✅ Stroke color picker (none / currentColor / shadcn theme tokens)
- ✅ Stroke width input
- ✅ Opacity slider per path
- ✅ Open / Closed path toggle
- ✅ Point count + selected point index display
- ✅ Style persists to new paths (currentFill / currentStroke / currentStrokeWidth)
- 📋 Path name/label

## Editor — Layers

- ✅ Layers panel (tab alongside Properties)
- ✅ Layer visibility toggle
- ✅ Layer lock toggle
- ✅ Layer opacity slider
- ✅ Add / delete layers
- ✅ Rename layer (inline)
- ✅ Reorder layers (drag or up/down buttons)
- 📋 Layer blend mode (removed from UI — data model retained for future)

## Editor — Theming

- ✅ Color picker offers shadcn CSS var tokens (--foreground, --primary, --muted-foreground, etc.)
- ✅ `CssColor` type supports `none`, `currentColor`, `hsl(var(--token))`, `#hex`
- ✅ Generated component embeds CSS var references directly — inherits consuming project's theme
- 📋 Preview panel renders component in shadcn light and dark themes side by side
- 📋 `strokeWidth` as a prop on the generated component

## Editor — File / Project

- ✅ Save component as `.lines.json` + generated `.tsx` to project's `linesDir`
- ✅ Load component from `.lines.json`
- ✅ Auto-save (debounced, triggers on `isDirty` + `componentName`)
- ✅ Component name editable in topbar; only invalid filename chars stripped
- ✅ Generate React `.tsx` component from document
- 📋 Unsaved changes indicator + confirm-before-close
- 📋 Export plain SVG (no React wrapper)
- 📋 Open existing `.tsx` + `.lines.json` for re-editing (full round-trip)

## Generated Component Format

- ✅ Uses shadcn CSS var color values by default
- ✅ `vectorEffect="non-scaling-stroke"` on paths
- ✅ Single default export named from component name
- ✅ No runtime dependencies — pure SVG in JSX
- 📋 `className` and `strokeWidth` props
- 📋 Named color override props

## Desktop App — Distribution

- ✅ macOS universal binary (arm64 + x86_64)
- ✅ GitHub Actions release pipeline (tag push → signed DMG → published release)
- ✅ Homebrew Cask install (`brew install whaleen/tap/lines`)
- ✅ In-app auto-updater — checks on launch, downloads in background, prompts to relaunch
- ✅ Signed releases (minisign keypair, TAURI_SIGNING_PRIVATE_KEY secret)
- ✅ `latest.json` manifest auto-updated in homebrew-tap on release publish
- 📋 Linux — add `ubuntu-22.04` to build matrix, apt deps, AppImage + .deb bundles
- 📋 Linux — AUR `-bin` package for Arch users (PKGBUILD auto-updated in release workflow)
- 📋 Linux — add `linux-x86_64` platform entry to `latest.json` for in-app updater

## Desktop App — UX

- 📋 File association: double-click `.lines.json` opens in editor
- 📋 Drag-and-drop image onto canvas to set reference
- 📋 Drag-and-drop `.lines.json` onto window to open
- 📋 App menu (File, Edit)

## CLI (`lines`)

- 📋 `lines init` — create `components/lines/` dir in current project
- 📋 `lines add <name>` — fetch component + `.lines.json` from registry, copy to correct dirs
- 📋 `lines list` — list available components in the registry
- 📋 `lines remove <name>` — delete component and data file from project
- 📋 Dry-run flag (`--dry-run`) for `add`
- 📋 Published as `lines` on npm

## Registry

- 📋 Public GitHub repo (`whaleen/lines-registry` or similar)
- 📋 Each component: `registry/<name>/component.tsx` + `registry/<name>/component.lines.json`
- 📋 Registry index: `registry/index.json` (name, description, tags, author, preview URL)
- 📋 Open contributions via PR
- 📋 Preview site showing all registered components rendered in light/dark
- 📋 CLI fetches from raw GitHub or a CDN-fronted static host

## shadcn Integration

- 📋 Install convention mirrors shadcn: copy source into project (not a node_modules dep)
- 📋 Components land in `components/lines/` by default (configurable via `lines.config.json`)
- 📋 `lines.config.json` in project root: output dir, aliases
- 📋 Works with any shadcn project out of the box — no extra setup beyond `lines init`
- 📋 Components use the same CSS variable names as shadcn (`--background`, `--foreground`, etc.)

## Known Issues / Open

- Canvas doesn't fit-to-window on image load
- No preview of what the component looks like outside the editor (no theme preview)
- No close path toggle via keyboard (inspector only)
