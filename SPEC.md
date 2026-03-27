# lines — Spec

Feature source of truth. Update this when features ship, change, or get cut.

## Editor — Canvas

- ✅ Load reference image (PNG/JPG) as non-exportable background layer
- ✅ Pan (spacebar + drag)
- ✅ Zoom (scroll wheel)
- ✅ SVG canvas with correct viewport/transform
- 📋 Fit-to-window on image load
- 📋 Zoom to fit / zoom to 100% keyboard shortcuts
- 📋 Canvas background color toggle (white / dark / transparent grid)
- 📋 Reference image opacity control (so traces are visible over busy images)

## Editor — Tools

- ✅ Pen tool (click to place points, building open polyline paths)
- ✅ Select tool (click path to select)
- ✅ Finish path (Enter)
- ✅ Cancel active path (Escape)
- ✅ Delete selected path (Delete/Backspace)
- 📋 Node edit mode — select individual points on a path, drag to reposition
- 📋 Move tool — drag entire selected path
- 📋 Close path (toggle open/closed)
- 📋 Insert point on path segment (click on edge)
- 📋 Delete individual point
- 📋 Bezier curve handles (v2, deferred)

## Editor — Toolbar

- ✅ Draw / Select tool buttons
- 📋 Proper tool palette with icons (not text labels)
- 📋 Tool keyboard shortcuts shown in tooltip
- 📋 Active tool highlight
- 📋 Node edit tool in toolbar

## Editor — Inspector / Properties

- ✅ Stroke color picker
- ✅ Stroke width input
- ✅ Delete path button
- 📋 Stroke uses CSS var reference (e.g. `var(--foreground)`) with hex fallback
- 📋 Fill color (none / CSS var / hex)
- 📋 Stroke linecap (butt / round / square)
- 📋 Stroke linejoin (miter / round / bevel)
- 📋 Opacity
- 📋 Path name/label (for generated component prop names)
- 📋 Layer order (up/down)

## Editor — Theming

- 📋 Preview panel renders component in shadcn light and dark themes side by side
- 📋 Stroke color picker offers CSS var suggestions from shadcn palette (--foreground, --primary, --muted-foreground, etc.)
- 📋 Component output uses CSS vars by default, falls back to hex for non-var values
- 📋 `strokeWidth` is a prop on the generated component (so consumers can override)

## Editor — File / Project

- ✅ Save project as `.lines.json`
- ✅ Load `.lines.json` project file
- ✅ Generate React `.tsx` component from document
- 📋 Auto-save (write `.lines.json` on every change, debounced)
- 📋 Open existing `.tsx` component + its sibling `.lines.json` for editing (round-trip)
- 📋 Recent files list
- 📋 Unsaved changes indicator + confirm-before-close
- 📋 Export plain SVG (no React wrapper)

## Generated Component Format

- 📋 Props: `className`, `strokeWidth` (number, default from editor), any named color overrides
- 📋 Uses `vectorEffect="non-scaling-stroke"` on paths
- 📋 Stroke colors default to CSS vars (`var(--foreground)`) or explicit hex
- 📋 Component is a single default export, named from project name (PascalCase)
- 📋 No runtime dependencies — pure SVG in JSX

## CLI (`lines`)

- 📋 `lines init` — create `components/lines/data/` dir in current project, add to `.gitignore` convention
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
- 📋 `lines.config.json` in project root: output dir, data dir, aliases
- 📋 Works with any shadcn project out of the box — no extra setup beyond `lines init`
- 📋 Components use the same CSS variable names as shadcn (`--background`, `--foreground`, etc.)

## Desktop App — UX

- 📋 Native window chrome (minimal, borderless or custom titlebar)
- 📋 File association: double-click `.lines.json` opens in editor
- 📋 Drag-and-drop image onto canvas to set reference
- 📋 Drag-and-drop `.lines.json` onto window to open
- 📋 App menu (File, Edit)

## Known Issues / Codex Wireframe Gaps

- Toolbar is text-label buttons — needs icon-based tool palette
- No node edit mode (can't move individual points after placing)
- No move tool (can't reposition whole paths)
- Inspector mixes project settings and path properties awkwardly
- Canvas doesn't fit-to-window on image load
- No preview of what the component looks like outside the editor (no theme preview)
- Stroke colors are raw hex — no CSS var support yet
