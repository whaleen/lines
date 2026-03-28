// ── Color system ─────────────────────────────────────────────────────────────

/**
 * A paint value for fill or stroke.
 * Shadcn projects use hsl(var(--token)) — these get embedded as-is in the SVG,
 * so the component inherits the consuming project's theme automatically.
 */
export type CssColor =
  | "none"
  | "currentColor"
  | `hsl(var(--${string}))`
  | `#${string}`;

/** Shadcn-compatible theme tokens available in the color picker. */
export const THEME_COLORS: { label: string; value: `hsl(var(--${string}))` }[] = [
  { label: "Foreground",    value: "hsl(var(--foreground))" },
  { label: "Background",    value: "hsl(var(--background))" },
  { label: "Primary",       value: "hsl(var(--primary))" },
  { label: "Primary FG",    value: "hsl(var(--primary-foreground))" },
  { label: "Muted",         value: "hsl(var(--muted-foreground))" },
  { label: "Accent",        value: "hsl(var(--accent-foreground))" },
  { label: "Destructive",   value: "hsl(var(--destructive))" },
  { label: "Border",        value: "hsl(var(--border))" },
];

// ── Path types ────────────────────────────────────────────────────────────────

export type StrokeLinecap  = "butt" | "round" | "square";
export type StrokeLinejoin = "miter" | "round" | "bevel";
export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay"
  | "darken" | "lighten" | "color-dodge" | "color-burn"
  | "hard-light" | "soft-light" | "difference" | "exclusion";

export type Point = { x: number; y: number };

export type TracePath = {
  id: string;
  points: Point[];
  closed: boolean;
  fill: CssColor;
  stroke: CssColor;
  strokeWidth: number;
  strokeLinecap: StrokeLinecap;
  strokeLinejoin: StrokeLinejoin;
  opacity: number;
};

// ── Layer ─────────────────────────────────────────────────────────────────────

export type LinesLayer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: BlendMode;
  paths: TracePath[];
};

// ── Document ──────────────────────────────────────────────────────────────────

export type LinesDocument = {
  version: 2;
  name: string;
  canvas: { width: number; height: number };
  sourceImage: {
    src: string;
    width: number;
    height: number;
    x: number;
    y: number;
    scale: number;
  };
  export: {
    componentName: string;
    outputPath: string;
  };
  /** layers[0] = topmost (rendered last in SVG = visually on top) */
  layers: LinesLayer[];
};

// ── Factories ─────────────────────────────────────────────────────────────────

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function makeDefaultLayer(name = "Layer 1"): LinesLayer {
  return {
    id: newId("layer"),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    paths: [],
  };
}

export const DEFAULT_DOCUMENT: LinesDocument = {
  version: 2,
  name: "Untitled",
  canvas: { width: 1200, height: 800 },
  sourceImage: { src: "", width: 0, height: 0, x: 0, y: 0, scale: 1 },
  export: { componentName: "UntitledLines", outputPath: "" },
  layers: [makeDefaultLayer()],
};

// ── Migration ─────────────────────────────────────────────────────────────────

function migratePath(p: Record<string, unknown>): TracePath {
  return {
    id:            (p.id as string)            ?? newId("path"),
    points:        (p.points as Point[])       ?? [],
    closed:        (p.closed as boolean)       ?? false,
    fill:          (p.fill as CssColor)        ?? "none",
    stroke:        (p.stroke as CssColor)      ?? "currentColor",
    strokeWidth:   (p.strokeWidth as number)   ?? 2,
    strokeLinecap: (p.strokeLinecap as StrokeLinecap)   ?? "round",
    strokeLinejoin:(p.strokeLinejoin as StrokeLinejoin) ?? "round",
    opacity:       (p.opacity as number)       ?? 1,
  };
}

export function migrateDocument(raw: unknown): LinesDocument {
  const doc = raw as Record<string, unknown>;

  let layers: LinesLayer[];

  if (Array.isArray(doc.layers)) {
    // v2 — migrate each layer
    layers = (doc.layers as Record<string, unknown>[]).map((l) => ({
      id:        (l.id as string)        ?? newId("layer"),
      name:      (l.name as string)      ?? "Layer",
      visible:   (l.visible as boolean)  ?? true,
      locked:    (l.locked as boolean)   ?? false,
      opacity:   (l.opacity as number)   ?? 1,
      blendMode: (l.blendMode as BlendMode) ?? "normal",
      paths: Array.isArray(l.paths)
        ? (l.paths as Record<string, unknown>[]).map(migratePath)
        : [],
    }));
  } else if (Array.isArray(doc.paths)) {
    // v1 — wrap flat paths in a default layer
    layers = [{
      ...makeDefaultLayer("Layer 1"),
      paths: (doc.paths as Record<string, unknown>[]).map(migratePath),
    }];
  } else {
    layers = [makeDefaultLayer()];
  }

  if (layers.length === 0) layers = [makeDefaultLayer()];

  const srcImg = (doc.sourceImage as Record<string, unknown> | undefined) ?? {};

  return {
    version: 2,
    name: (doc.name as string) ?? "Untitled",
    canvas: (doc.canvas as { width: number; height: number }) ?? {
      width:  (srcImg.width as number)  ?? 1200,
      height: (srcImg.height as number) ?? 800,
    },
    sourceImage: {
      src:    (srcImg.src as string)    ?? "",
      width:  (srcImg.width as number)  ?? 0,
      height: (srcImg.height as number) ?? 0,
      x:      (srcImg.x as number)      ?? 0,
      y:      (srcImg.y as number)      ?? 0,
      scale:  (srcImg.scale as number)  ?? 1,
    },
    export: {
      componentName: ((doc.export as Record<string, unknown>)?.componentName as string) ?? "UntitledLines",
      outputPath:    ((doc.export as Record<string, unknown>)?.outputPath as string)    ?? "",
    },
    layers,
  };
}
