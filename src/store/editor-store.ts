import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { generateComponentSource } from "../lib/component-generator";
import { serializeDocument } from "../lib/document-serializer";
import type { Project } from "../types/project";
import {
  DEFAULT_DOCUMENT,
  makeDefaultLayer,
  migrateDocument,
  type BlendMode,
  type CssColor,
  type LinesDocument,
  type LinesLayer,
  type Point,
  type StrokeLinecap,
  type StrokeLinejoin,
  type TracePath,
} from "../types/lines";

export type ActiveTool = "select" | "node" | "draw" | "crop";

/** Strip characters that are invalid in filenames; preserve user's intended name. */
export function sanitizeComponentName(raw: string): string {
  return raw.trim().replace(/[/\\:*?"<>|]/g, "");
}

// ── Layer / path helpers ──────────────────────────────────────────────────────

function newPathId() { return `path_${Math.random().toString(36).slice(2, 10)}`; }

function derivePaths(project: Project, componentName: string) {
  const dir = project.linesDir.replace(/\\/g, "/").replace(/\/$/, "");
  return {
    tsxPath: `${dir}/${componentName}.tsx`,
    jsonPath: `${dir}/${componentName}.lines.json`,
  };
}

/** Find a path across all layers; returns null if not found. */
function findPath(layers: LinesLayer[], pathId: string) {
  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    const pi = layer.paths.findIndex((p) => p.id === pathId);
    if (pi !== -1) return { layer, path: layer.paths[pi], li, pi };
  }
  return null;
}

/** Map layers, touching only layers that contain at least one of the given path IDs. */
function mapLayerPaths(
  layers: LinesLayer[],
  ids: Set<string>,
  fn: (path: TracePath) => TracePath,
): LinesLayer[] {
  return layers.map((layer) => {
    if (!layer.paths.some((p) => ids.has(p.id))) return layer;
    return { ...layer, paths: layer.paths.map((p) => (ids.has(p.id) ? fn(p) : p)) };
  });
}

/** Remove paths with given IDs from all layers, discarding empty-path data. */
function removePaths(layers: LinesLayer[], ids: Set<string>): LinesLayer[] {
  return layers.map((layer) => ({
    ...layer,
    paths: layer.paths.filter((p) => !ids.has(p.id)),
  }));
}

/** Flatten all paths from all layers (in render order: last layer first = bottom). */
export function allPaths(layers: LinesLayer[]): TracePath[] {
  return [...layers].reverse().flatMap((l) => l.paths);
}

/** AABB of a path's points. */
export function pathBounds(points: Point[]): { x: number; y: number; r: number; b: number } | null {
  if (!points.length) return null;
  let x = Infinity, y = Infinity, r = -Infinity, b = -Infinity;
  for (const p of points) {
    if (p.x < x) x = p.x;
    if (p.y < y) y = p.y;
    if (p.x > r) r = p.x;
    if (p.y > b) b = p.y;
  }
  return { x, y, r, b };
}

// ── Store type ────────────────────────────────────────────────────────────────

type EditorState = {
  activeLayerId: string;
  activeTool: ActiveTool;
  clipboard: TracePath[];
  componentName: string;
  currentFill: CssColor;
  currentStroke: CssColor;
  currentStrokeWidth: number;
  document: LinesDocument;
  errorMessage: string;
  imageSourcePath: string;
  isDirty: boolean;
  promptName: boolean;
  referenceImageUrl: string;
  selectedPathId: string | null;
  selectedPathIds: string[];
  selectedPointIndex: number | null;
  /** Path ID currently being drawn (draw tool active path). */
  activePathId: string | null;
  statusMessage: string;

  // Canvas / image
  setCanvasSize: (w: number, h: number) => void;
  setImageTransform: (x: number, y: number, scale: number) => void;
  resizeCanvas: (newW: number, newH: number, anchorX: number, anchorY: number) => void;
  cropCanvas: (x: number, y: number, w: number, h: number) => void;

  // Component / save
  loadComponent: (jsonPath: string, linesDir: string) => Promise<void>;
  loadReferenceImage: (file: File, sourcePath?: string) => Promise<void>;
  resetEditor: (componentName?: string) => void;
  saveNow: (project: Project) => Promise<void>;
  scheduleAutoSave: (project: Project) => void;
  setComponentName: (name: string) => void;

  // Tool / selection
  setActiveTool: (tool: ActiveTool) => void;
  selectPath: (pathId: string | null, addToSelection?: boolean) => void;
  selectPoint: (pathId: string, pointIndex: number | null) => void;
  deselectAll: () => void;
  selectAll: () => void;

  // Draw
  addPointAt: (point: Point) => void;
  cancelActivePath: () => void;
  finishActivePath: () => void;

  // Path edit
  deleteSelectedPath: () => void;
  deleteSelectedPoint: () => void;
  duplicateSelectedPaths: () => void;
  setPathPoints: (pathId: string, points: Point[]) => void;
  updatePoint: (pathId: string, pointIndex: number, point: Point) => void;

  // Path style
  setFill: (value: CssColor) => void;
  setStroke: (value: CssColor) => void;
  setStrokeWidth: (value: number) => void;
  setStrokeLinecap: (value: StrokeLinecap) => void;
  setStrokeLinejoin: (value: StrokeLinejoin) => void;
  setPathOpacity: (value: number) => void;
  setPathClosed: (closed: boolean) => void;

  // Clipboard
  copySelected: () => void;
  cutSelected: () => void;
  pasteClipboard: () => void;

  // Z-order (within layer)
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;

  // Layer management
  addLayer: () => void;
  deleteLayer: (layerId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  reorderLayer: (fromId: string, toId: string) => void;
  setLayerVisible: (layerId: string, visible: boolean) => void;
  setLayerLocked: (layerId: string, locked: boolean) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerBlendMode: (layerId: string, blendMode: BlendMode) => void;
  setActiveLayer: (layerId: string) => void;
  groupSelected: () => void;
};

// ── Store ─────────────────────────────────────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const useEditorStore = create<EditorState>((set, get) => ({
  activeLayerId: DEFAULT_DOCUMENT.layers[0].id,
  activeTool: "draw",
  activePathId: null,
  clipboard: [],
  componentName: "",
  currentFill: "none",
  currentStroke: "currentColor",
  currentStrokeWidth: 2,
  document: DEFAULT_DOCUMENT,
  errorMessage: "",
  imageSourcePath: "",
  isDirty: false,
  promptName: false,
  referenceImageUrl: "",
  selectedPathId: null,
  selectedPathIds: [],
  selectedPointIndex: null,
  statusMessage: "",

  // ── Canvas / image ──

  setCanvasSize: (width, height) => {
    set((s) => ({ document: { ...s.document, canvas: { width, height } }, isDirty: true }));
  },

  setImageTransform: (x, y, scale) => {
    set((s) => ({
      document: { ...s.document, sourceImage: { ...s.document.sourceImage, x, y, scale } },
      isDirty: true,
    }));
  },

  resizeCanvas: (newW, newH, anchorX, anchorY) => {
    set((s) => {
      const oldW = s.document.canvas.width;
      const oldH = s.document.canvas.height;
      const dx = anchorX * (newW - oldW);
      const dy = anchorY * (newH - oldH);
      const movePaths = dx !== 0 || dy !== 0;
      const layers = movePaths
        ? s.document.layers.map((layer) => ({
            ...layer,
            paths: layer.paths.map((path) => ({
              ...path,
              points: path.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            })),
          }))
        : s.document.layers;
      const si = s.document.sourceImage;
      return {
        document: {
          ...s.document,
          canvas: { width: newW, height: newH },
          layers,
          sourceImage: si.width > 0 && movePaths ? { ...si, x: si.x + dx, y: si.y + dy } : si,
        },
        isDirty: true,
      };
    });
  },

  cropCanvas: (x, y, w, h) => {
    set((s) => {
      const dx = -x, dy = -y;
      const layers = s.document.layers.map((layer) => ({
        ...layer,
        paths: layer.paths.map((path) => ({
          ...path,
          points: path.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
        })),
      }));
      const si = s.document.sourceImage;
      return {
        document: {
          ...s.document,
          canvas: { width: Math.round(w), height: Math.round(h) },
          layers,
          sourceImage: si.width > 0 ? { ...si, x: si.x + dx, y: si.y + dy } : si,
        },
        activeTool: "select",
        isDirty: true,
      };
    });
  },

  // ── Component / save ──

  setComponentName: (name) => set({ componentName: name }),

  resetEditor: (componentName = "") => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const doc = DEFAULT_DOCUMENT;
    set({
      activeLayerId: doc.layers[0].id,
      activeTool: "draw",
      activePathId: null,
      clipboard: [],
      componentName,
      currentFill: "none",
      currentStroke: "currentColor",
      currentStrokeWidth: 2,
      document: { ...doc, layers: [{ ...doc.layers[0], id: doc.layers[0].id }] },
      errorMessage: "",
      imageSourcePath: "",
      isDirty: false,
      promptName: false,
      referenceImageUrl: "",
      selectedPathId: null,
      selectedPathIds: [],
      selectedPointIndex: null,
      statusMessage: "",
    });
  },

  loadComponent: async (jsonPath, linesDir) => {
    try {
      const source = await invoke<string>("load_lines_project", { projectPath: jsonPath });
      const doc = migrateDocument(JSON.parse(source));
      const imageUrl = doc.sourceImage.src
        ? convertFileSrc(`${linesDir}/${doc.sourceImage.src}`)
        : "";
      set({
        activeLayerId: doc.layers[0].id,
        activePathId: null,
        document: doc,
        errorMessage: "",
        imageSourcePath: "",
        isDirty: false,
        promptName: false,
        referenceImageUrl: imageUrl,
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        statusMessage: "",
      });
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : "Failed to load component." });
    }
  },

  loadReferenceImage: async (file, sourcePath = "") => {
    const objectUrl = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = objectUrl;
    });
    const fileName = file.name.split("/").pop() ?? file.name;
    set((s) => ({
      document: {
        ...s.document,
        sourceImage: { src: fileName, width: dimensions.width, height: dimensions.height, x: 0, y: 0, scale: 1 },
      },
      imageSourcePath: sourcePath,
      referenceImageUrl: objectUrl,
      statusMessage: `Loaded ${fileName} (${dimensions.width}×${dimensions.height}).`,
      errorMessage: "",
      isDirty: true,
    }));
  },

  saveNow: async (project) => {
    const s = get();
    if (!s.componentName) return;
    const { tsxPath, jsonPath } = derivePaths(project, s.componentName);
    const dir = project.linesDir.replace(/\\/g, "/").replace(/\/$/, "");
    if (s.imageSourcePath && s.document.sourceImage.src) {
      try { await invoke("copy_file", { srcPath: s.imageSourcePath, destPath: `${dir}/${s.document.sourceImage.src}` }); }
      catch { /* non-fatal */ }
    }
    const doc = { ...s.document, name: s.componentName, export: { componentName: s.componentName, outputPath: tsxPath } };
    try {
      await invoke("save_lines_project", {
        payload: { projectPath: jsonPath, projectSource: serializeDocument(doc), componentPath: tsxPath, componentSource: generateComponentSource(doc) },
      });
      set({ isDirty: false, errorMessage: "", statusMessage: `Saved ${s.componentName}.` });
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : "Save failed." });
    }
  },

  scheduleAutoSave: (project) => {
    if (!get().componentName) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => get().saveNow(project), 800);
  },

  // ── Tool / selection ──

  setActiveTool: (tool) => {
    set((s) => ({
      activePathId: tool === "draw" ? s.activePathId : null,
      activeTool: tool,
      selectedPointIndex: tool === "node" ? s.selectedPointIndex : null,
      statusMessage: "",
    }));
  },

  selectPath: (pathId, addToSelection = false) => {
    set((s) => {
      if (!pathId) return { activePathId: null, selectedPathId: null, selectedPathIds: [], selectedPointIndex: null };
      // Auto-switch active layer to the path's layer
      const found = findPath(s.document.layers, pathId);
      const activeLayerId = found ? found.layer.id : s.activeLayerId;
      if (addToSelection) {
        const already = s.selectedPathIds.includes(pathId);
        const nextIds = already ? s.selectedPathIds.filter((id) => id !== pathId) : [...s.selectedPathIds, pathId];
        return { activeLayerId, activePathId: null, selectedPathId: nextIds[nextIds.length - 1] ?? null, selectedPathIds: nextIds, selectedPointIndex: null };
      }
      return { activeLayerId, activePathId: null, selectedPathId: pathId, selectedPathIds: [pathId], selectedPointIndex: null };
    });
  },

  selectPoint: (pathId, pointIndex) => {
    set({ selectedPathId: pathId, selectedPointIndex: pointIndex });
  },

  deselectAll: () => {
    set({ activePathId: null, selectedPathId: null, selectedPathIds: [], selectedPointIndex: null });
  },

  selectAll: () => {
    const { document: doc, activeLayerId } = get();
    const layer = doc.layers.find((l) => l.id === activeLayerId);
    const paths = layer?.paths ?? [];
    if (!paths.length) return;
    const ids = paths.map((p) => p.id);
    set({ selectedPathId: ids[ids.length - 1], selectedPathIds: ids, selectedPointIndex: null });
  },

  // ── Draw ──

  addPointAt: (point) => {
    set((s) => {
      if (s.activeTool !== "draw") return s;
      const layer = s.document.layers.find((l) => l.id === s.activeLayerId);
      if (!layer || layer.locked) return s;

      const showPrompt = !s.componentName && !s.promptName && allPaths(s.document.layers).length === 0 && !s.activePathId;

      if (!s.activePathId) {
        const pathId = newPathId();
        const newPath: TracePath = {
          id: pathId,
          points: [point],
          closed: false,
          fill: s.currentFill,
          stroke: s.currentStroke,
          strokeWidth: s.currentStrokeWidth,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          opacity: 1,
        };
        return {
          activePathId: pathId,
          promptName: showPrompt ? true : s.promptName,
          document: {
            ...s.document,
            layers: s.document.layers.map((l) =>
              l.id === s.activeLayerId ? { ...l, paths: [...l.paths, newPath] } : l,
            ),
          },
          selectedPathId: pathId,
          selectedPathIds: [pathId],
          selectedPointIndex: 0,
          isDirty: true,
          statusMessage: "",
        };
      }

      const found = findPath(s.document.layers, s.activePathId);
      return {
        document: {
          ...s.document,
          layers: s.document.layers.map((l) =>
            l.id !== found?.layer.id ? l : {
              ...l,
              paths: l.paths.map((p) =>
                p.id !== s.activePathId ? p : { ...p, points: [...p.points, point] },
              ),
            },
          ),
        },
        selectedPathId: s.activePathId,
        selectedPointIndex: found?.path.points.length ?? 0,
        isDirty: true,
        statusMessage: "",
      };
    });
  },

  cancelActivePath: () => {
    set((s) => {
      if (!s.activePathId) return s;
      return {
        activePathId: null,
        document: {
          ...s.document,
          layers: s.document.layers.map((l) => ({
            ...l, paths: l.paths.filter((p) => p.id !== s.activePathId),
          })),
        },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        statusMessage: "Path discarded.",
      };
    });
  },

  finishActivePath: () => {
    set((s) => {
      if (!s.activePathId) return s;
      const found = findPath(s.document.layers, s.activePathId);
      const drop = !found || found.path.points.length < 2;
      return {
        activePathId: null,
        document: drop
          ? {
              ...s.document,
              layers: s.document.layers.map((l) => ({
                ...l, paths: l.paths.filter((p) => p.id !== s.activePathId),
              })),
            }
          : s.document,
        selectedPointIndex: null,
        statusMessage: drop ? "A path needs at least two points." : "",
        isDirty: !drop,
      };
    });
  },

  // ── Path edit ──

  deleteSelectedPath: () => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      if (!ids.size) return s;
      return {
        activePathId: ids.has(s.activePathId ?? "") ? null : s.activePathId,
        document: { ...s.document, layers: removePaths(s.document.layers, ids) },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  deleteSelectedPoint: () => {
    set((s) => {
      if (!s.selectedPathId || s.selectedPointIndex === null) return s;
      const found = findPath(s.document.layers, s.selectedPathId);
      if (!found) return s;
      const newPoints = found.path.points.filter((_, i) => i !== s.selectedPointIndex);
      const layers = newPoints.length === 0
        ? removePaths(s.document.layers, new Set([s.selectedPathId]))
        : s.document.layers.map((l) =>
            l.id !== found.layer.id ? l : {
              ...l, paths: l.paths.map((p) => p.id !== s.selectedPathId ? p : { ...p, points: newPoints }),
            },
          );
      return {
        activePathId: newPoints.length === 0 && s.activePathId === s.selectedPathId ? null : s.activePathId,
        document: { ...s.document, layers },
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  duplicateSelectedPaths: () => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      if (!ids.size) return s;
      const copies: TracePath[] = [];
      const newLayers = s.document.layers.map((layer) => {
        const layerCopies = layer.paths
          .filter((p) => ids.has(p.id))
          .map((p) => ({ ...p, id: newPathId(), points: p.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 })) }));
        copies.push(...layerCopies);
        if (!layerCopies.length) return layer;
        return { ...layer, paths: [...layer.paths, ...layerCopies] };
      });
      const newIds = copies.map((p) => p.id);
      return {
        document: { ...s.document, layers: newLayers },
        selectedPathId: newIds[0] ?? null,
        selectedPathIds: newIds,
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  setPathPoints: (pathId, points) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => ({
          ...l, paths: l.paths.map((p) => p.id === pathId ? { ...p, points } : p),
        })),
      },
      isDirty: true,
    }));
  },

  updatePoint: (pathId, pointIndex, point) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => ({
          ...l, paths: l.paths.map((p) =>
            p.id !== pathId ? p : { ...p, points: p.points.map((pt, i) => i === pointIndex ? point : pt) },
          ),
        })),
      },
      isDirty: true,
    }));
  },

  // ── Path style ──

  setFill: (value) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        currentFill: value,
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, fill: value })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setStroke: (value) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        currentStroke: value,
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, stroke: value })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setStrokeWidth: (value) => {
    const width = Number.isFinite(value) ? Math.max(0.5, value) : null;
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        currentStrokeWidth: width ?? s.currentStrokeWidth,
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, strokeWidth: width ?? p.strokeWidth })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setStrokeLinecap: (value) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, strokeLinecap: value })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setStrokeLinejoin: (value) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, strokeLinejoin: value })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setPathOpacity: (value) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, opacity: value })) },
        isDirty: ids.size > 0,
      };
    });
  },

  setPathClosed: (closed) => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      return {
        document: { ...s.document, layers: mapLayerPaths(s.document.layers, ids, (p) => ({ ...p, closed })) },
        isDirty: ids.size > 0,
      };
    });
  },

  // ── Clipboard ──

  copySelected: () => {
    const s = get();
    const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
    if (!ids.size) return;
    const copies = allPaths(s.document.layers).filter((p) => ids.has(p.id));
    set({ clipboard: copies });
  },

  cutSelected: () => {
    const s = get();
    const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
    if (!ids.size) return;
    const copies = allPaths(s.document.layers).filter((p) => ids.has(p.id));
    set({
      clipboard: copies,
      document: { ...s.document, layers: removePaths(s.document.layers, ids) },
      activePathId: ids.has(s.activePathId ?? "") ? null : s.activePathId,
      selectedPathId: null,
      selectedPathIds: [],
      selectedPointIndex: null,
      isDirty: true,
    });
  },

  pasteClipboard: () => {
    set((s) => {
      if (!s.clipboard.length) return s;
      const newPaths: TracePath[] = s.clipboard.map((p) => ({
        ...p,
        id: newPathId(),
        points: p.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 })),
      }));
      const newIds = newPaths.map((p) => p.id);
      return {
        document: {
          ...s.document,
          layers: s.document.layers.map((l) =>
            l.id === s.activeLayerId ? { ...l, paths: [...l.paths, ...newPaths] } : l,
          ),
        },
        selectedPathId: newIds[newIds.length - 1] ?? null,
        selectedPathIds: newIds,
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  // ── Z-order (within layer) ──

  bringForward: () => {
    set((s) => {
      const id = s.selectedPathId;
      if (!id) return s;
      const found = findPath(s.document.layers, id);
      if (!found || found.pi >= found.layer.paths.length - 1) return s;
      const paths = [...found.layer.paths];
      [paths[found.pi], paths[found.pi + 1]] = [paths[found.pi + 1], paths[found.pi]];
      return { document: { ...s.document, layers: s.document.layers.map((l) => l.id === found.layer.id ? { ...l, paths } : l) }, isDirty: true };
    });
  },

  sendBackward: () => {
    set((s) => {
      const id = s.selectedPathId;
      if (!id) return s;
      const found = findPath(s.document.layers, id);
      if (!found || found.pi <= 0) return s;
      const paths = [...found.layer.paths];
      [paths[found.pi], paths[found.pi - 1]] = [paths[found.pi - 1], paths[found.pi]];
      return { document: { ...s.document, layers: s.document.layers.map((l) => l.id === found.layer.id ? { ...l, paths } : l) }, isDirty: true };
    });
  },

  bringToFront: () => {
    set((s) => {
      const id = s.selectedPathId;
      if (!id) return s;
      const found = findPath(s.document.layers, id);
      if (!found) return s;
      const paths = [...found.layer.paths.filter((p) => p.id !== id), found.path];
      return { document: { ...s.document, layers: s.document.layers.map((l) => l.id === found.layer.id ? { ...l, paths } : l) }, isDirty: true };
    });
  },

  sendToBack: () => {
    set((s) => {
      const id = s.selectedPathId;
      if (!id) return s;
      const found = findPath(s.document.layers, id);
      if (!found) return s;
      const paths = [found.path, ...found.layer.paths.filter((p) => p.id !== id)];
      return { document: { ...s.document, layers: s.document.layers.map((l) => l.id === found.layer.id ? { ...l, paths } : l) }, isDirty: true };
    });
  },

  // ── Layer management ──

  addLayer: () => {
    set((s) => {
      const count = s.document.layers.length + 1;
      const layer = makeDefaultLayer(`Layer ${count}`);
      return {
        activeLayerId: layer.id,
        document: { ...s.document, layers: [layer, ...s.document.layers] },
      };
    });
  },

  deleteLayer: (layerId) => {
    set((s) => {
      if (s.document.layers.length <= 1) return s; // never delete last layer
      const layers = s.document.layers.filter((l) => l.id !== layerId);
      const activeLayerId = s.activeLayerId === layerId
        ? (layers[0]?.id ?? "")
        : s.activeLayerId;
      return { document: { ...s.document, layers }, activeLayerId, isDirty: true };
    });
  },

  renameLayer: (layerId, name) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => l.id === layerId ? { ...l, name } : l),
      },
      isDirty: true,
    }));
  },

  reorderLayer: (fromId, toId) => {
    set((s) => {
      const layers = s.document.layers;
      const from = layers.find((l) => l.id === fromId);
      if (!from || fromId === toId) return s;
      const withoutFrom = layers.filter((l) => l.id !== fromId);
      const toIdx = withoutFrom.findIndex((l) => l.id === toId);
      if (toIdx === -1) return s;
      withoutFrom.splice(toIdx, 0, from);
      return { document: { ...s.document, layers: withoutFrom }, isDirty: true };
    });
  },

  setLayerVisible: (layerId, visible) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => l.id === layerId ? { ...l, visible } : l),
      },
    }));
  },

  setLayerLocked: (layerId, locked) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => l.id === layerId ? { ...l, locked } : l),
      },
    }));
  },

  setLayerOpacity: (layerId, opacity) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => l.id === layerId ? { ...l, opacity } : l),
      },
      isDirty: true,
    }));
  },

  setLayerBlendMode: (layerId, blendMode) => {
    set((s) => ({
      document: {
        ...s.document,
        layers: s.document.layers.map((l) => l.id === layerId ? { ...l, blendMode } : l),
      },
      isDirty: true,
    }));
  },

  setActiveLayer: (layerId) => {
    set({ activeLayerId: layerId });
  },

  groupSelected: () => {
    set((s) => {
      const ids = new Set(s.selectedPathIds.length > 0 ? s.selectedPathIds : s.selectedPathId ? [s.selectedPathId] : []);
      if (!ids.size) return s;
      const paths = allPaths(s.document.layers).filter((p) => ids.has(p.id));
      const count = s.document.layers.length + 1;
      const newLayer = { ...makeDefaultLayer(`Group ${count}`), paths };
      const cleanedLayers = removePaths(s.document.layers, ids);
      return {
        activeLayerId: newLayer.id,
        document: { ...s.document, layers: [newLayer, ...cleanedLayers] },
        selectedPathIds: paths.map((p) => p.id),
        isDirty: true,
      };
    });
  },
}));
