import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import { generateComponentSource } from "../lib/component-generator";
import { serializeDocument } from "../lib/document-serializer";
import type { Project } from "../types/project";
import { DEFAULT_DOCUMENT, type LinesDocument, type Point } from "../types/lines";

export type ActiveTool = "select" | "node" | "draw";

// PascalCase + Lines suffix enforcement
export function sanitizeComponentName(raw: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (words.length === 0) return "";

  const base = words.join("");
  return base.endsWith("Lines") ? base : `${base}Lines`;
}

function derivePaths(project: Project, componentName: string) {
  const dir = project.linesDir.replace(/\\/g, "/").replace(/\/$/, "");
  return {
    tsxPath: `${dir}/${componentName}.tsx`,
    jsonPath: `${dir}/${componentName}.lines.json`,
  };
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

type EditorState = {
  activePathId: string | null;
  activeTool: ActiveTool;
  componentName: string;        // the PascalCase name once set
  currentStroke: string;
  currentStrokeWidth: number;
  document: LinesDocument;
  errorMessage: string;
  isDirty: boolean;
  promptName: boolean;          // show inline name nudge in topbar
  referenceImageUrl: string;
  selectedPathId: string | null;
  selectedPathIds: string[];
  selectedPointIndex: number | null;
  statusMessage: string;
  // Actions
  addPointAt: (point: Point) => void;
  cancelActivePath: () => void;
  deleteSelectedPath: () => void;
  deleteSelectedPoint: () => void;
  deselectAll: () => void;
  duplicateSelectedPaths: () => void;
  finishActivePath: () => void;
  loadComponent: (jsonPath: string, imageBasePath?: string) => Promise<void>;
  loadReferenceImage: (file: File) => Promise<void>;
  resetEditor: (componentName?: string) => void;
  saveNow: (project: Project) => Promise<void>;
  scheduleAutoSave: (project: Project) => void;
  selectPath: (pathId: string | null, addToSelection?: boolean) => void;
  selectPoint: (pathId: string, pointIndex: number | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setComponentName: (name: string) => void;
  setPathPoints: (pathId: string, points: Point[]) => void;
  setStroke: (value: string) => void;
  setStrokeWidth: (value: number) => void;
  updatePoint: (pathId: string, pointIndex: number, point: Point) => void;
};

const newPathId = () => `path_${Math.random().toString(36).slice(2, 10)}`;

export const useEditorStore = create<EditorState>((set, get) => ({
  activePathId: null,
  activeTool: "draw",
  componentName: "",
  currentStroke: "currentColor",
  currentStrokeWidth: 2,
  document: DEFAULT_DOCUMENT,
  errorMessage: "",
  isDirty: false,
  promptName: false,
  referenceImageUrl: "",
  selectedPathId: null,
  selectedPathIds: [],
  selectedPointIndex: null,
  statusMessage: "",

  resetEditor: (componentName = "") => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    set({
      activePathId: null,
      activeTool: "draw",
      componentName,
      currentStroke: "currentColor",
      currentStrokeWidth: 2,
      document: DEFAULT_DOCUMENT,
      errorMessage: "",
      isDirty: false,
      promptName: false,
      referenceImageUrl: "",
      selectedPathId: null,
      selectedPathIds: [],
      selectedPointIndex: null,
      statusMessage: "",
    });
  },

  setComponentName: (name) => {
    set({ componentName: name });
  },

  loadComponent: async (jsonPath, imageBasePath) => {
    try {
      const source = await invoke<string>("load_lines_project", { projectPath: jsonPath });
      const document = JSON.parse(source) as LinesDocument;
      const imageUrl = document.sourceImage.src
        ? convertFileSrc(
            imageBasePath
              ? `${imageBasePath}/${document.sourceImage.src}`
              : document.sourceImage.src,
          )
        : "";
      set({
        activePathId: null,
        document,
        errorMessage: "",
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

  loadReferenceImage: async (file) => {
    const objectUrl = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = objectUrl;
    });
    set((state) => ({
      document: {
        ...state.document,
        sourceImage: { src: file.name, width: dimensions.width, height: dimensions.height },
      },
      referenceImageUrl: objectUrl,
      statusMessage: `Loaded ${file.name} (${dimensions.width}×${dimensions.height}).`,
      errorMessage: "",
      isDirty: true,
    }));
  },

  saveNow: async (project) => {
    const state = get();
    if (!state.componentName) return;

    const { tsxPath, jsonPath } = derivePaths(project, state.componentName);
    const componentSource = generateComponentSource({
      ...state.document,
      name: state.componentName,
      export: { componentName: state.componentName, outputPath: tsxPath },
    });
    const projectSource = serializeDocument({
      ...state.document,
      name: state.componentName,
      export: { componentName: state.componentName, outputPath: tsxPath },
    });

    try {
      await invoke("save_lines_project", {
        payload: { projectPath: jsonPath, projectSource, componentPath: tsxPath, componentSource },
      });
      set({ isDirty: false, errorMessage: "", statusMessage: `Saved ${state.componentName}.` });
    } catch (e) {
      set({ errorMessage: e instanceof Error ? e.message : "Save failed." });
    }
  },

  scheduleAutoSave: (project) => {
    const state = get();
    if (!state.componentName) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => get().saveNow(project), 800);
  },

  addPointAt: (point) => {
    set((state) => {
      if (state.activeTool !== "draw") return state;

      const showPrompt = !state.componentName && !state.promptName && state.document.paths.length === 0 && !state.activePathId;

      const { activePathId, document } = state;
      if (!activePathId) {
        const pathId = newPathId();
        return {
          activePathId: pathId,
          promptName: showPrompt ? true : state.promptName,
          document: {
            ...document,
            paths: [
              ...document.paths,
              {
                id: pathId,
                points: [point],
                closed: false,
                stroke: state.currentStroke as "currentColor" | `#${string}`,
                strokeWidth: state.currentStrokeWidth,
                fill: "none",
              },
            ],
          },
          selectedPathId: pathId,
          selectedPathIds: [pathId],
          selectedPointIndex: 0,
          isDirty: true,
          statusMessage: "",
        };
      }

      const path = document.paths.find((p) => p.id === activePathId);
      return {
        document: {
          ...document,
          paths: document.paths.map((p) =>
            p.id === activePathId ? { ...p, points: [...p.points, point] } : p,
          ),
        },
        selectedPathId: activePathId,
        selectedPointIndex: path?.points.length ?? 0,
        isDirty: true,
        statusMessage: "",
      };
    });
  },

  deleteSelectedPath: () => {
    set((state) => {
      const ids = new Set(
        state.selectedPathIds.length > 0
          ? state.selectedPathIds
          : state.selectedPathId
            ? [state.selectedPathId]
            : [],
      );
      if (ids.size === 0) return state;
      return {
        activePathId: ids.has(state.activePathId ?? "") ? null : state.activePathId,
        document: { ...state.document, paths: state.document.paths.filter((p) => !ids.has(p.id)) },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  deselectAll: () => {
    set({ activePathId: null, selectedPathId: null, selectedPathIds: [], selectedPointIndex: null });
  },

  duplicateSelectedPaths: () => {
    set((state) => {
      const ids = new Set(
        state.selectedPathIds.length > 0
          ? state.selectedPathIds
          : state.selectedPathId
            ? [state.selectedPathId]
            : [],
      );
      if (ids.size === 0) return state;
      const copies = state.document.paths
        .filter((p) => ids.has(p.id))
        .map((p) => ({ ...p, id: newPathId(), points: p.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 })) }));
      const newIds = copies.map((p) => p.id);
      return {
        document: { ...state.document, paths: [...state.document.paths, ...copies] },
        selectedPathId: newIds[0] ?? null,
        selectedPathIds: newIds,
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  deleteSelectedPoint: () => {
    set((state) => {
      if (state.selectedPathId === null || state.selectedPointIndex === null) return state;
      const nextPaths = state.document.paths
        .map((p) =>
          p.id !== state.selectedPathId
            ? p
            : { ...p, points: p.points.filter((_, i) => i !== state.selectedPointIndex) },
        )
        .filter((p) => p.points.length > 0);
      return {
        activePathId:
          state.activePathId === state.selectedPathId && !nextPaths.some((p) => p.id === state.selectedPathId)
            ? null
            : state.activePathId,
        document: { ...state.document, paths: nextPaths },
        selectedPointIndex: null,
        isDirty: true,
      };
    });
  },

  cancelActivePath: () => {
    set((state) => {
      if (!state.activePathId) return state;
      return {
        activePathId: null,
        document: { ...state.document, paths: state.document.paths.filter((p) => p.id !== state.activePathId) },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        statusMessage: "Path discarded.",
      };
    });
  },

  finishActivePath: () => {
    set((state) => {
      if (!state.activePathId) return state;
      const active = state.document.paths.find((p) => p.id === state.activePathId);
      const drop = !active || active.points.length < 2;
      return {
        activePathId: null,
        document: drop
          ? { ...state.document, paths: state.document.paths.filter((p) => p.id !== state.activePathId) }
          : state.document,
        selectedPointIndex: null,
        statusMessage: drop ? "A path needs at least two points." : "",
        isDirty: !drop,
      };
    });
  },

  selectPath: (pathId, addToSelection = false) => {
    set((state) => {
      if (!pathId) return { activePathId: null, selectedPathId: null, selectedPathIds: [], selectedPointIndex: null };
      if (addToSelection) {
        const already = state.selectedPathIds.includes(pathId);
        const nextIds = already ? state.selectedPathIds.filter((id) => id !== pathId) : [...state.selectedPathIds, pathId];
        return { activePathId: null, selectedPathId: nextIds[nextIds.length - 1] ?? null, selectedPathIds: nextIds, selectedPointIndex: null };
      }
      return { activePathId: null, selectedPathId: pathId, selectedPathIds: [pathId], selectedPointIndex: null };
    });
  },

  selectPoint: (pathId, pointIndex) => {
    set({ selectedPathId: pathId, selectedPointIndex: pointIndex });
  },

  setActiveTool: (tool) => {
    set((state) => ({
      activePathId: tool === "draw" ? state.activePathId : null,
      activeTool: tool,
      selectedPointIndex: tool === "node" ? state.selectedPointIndex : null,
      statusMessage: "",
    }));
  },

  setPathPoints: (pathId, points) => {
    set((state) => ({
      document: {
        ...state.document,
        paths: state.document.paths.map((p) => (p.id === pathId ? { ...p, points } : p)),
      },
      isDirty: true,
    }));
  },

  setStroke: (value) => {
    const normalized = value === "currentColor" ? "currentColor" : (`#${value.replace(/^#/, "")}` as const);
    set((state) => {
      const ids = new Set(state.selectedPathIds.length > 0 ? state.selectedPathIds : state.selectedPathId ? [state.selectedPathId] : []);
      return {
        currentStroke: normalized,
        document: {
          ...state.document,
          paths: state.document.paths.map((p) => (ids.has(p.id) ? { ...p, stroke: normalized } : p)),
        },
        isDirty: ids.size > 0,
      };
    });
  },

  setStrokeWidth: (value) => {
    const width = Number.isFinite(value) ? Math.max(0.5, value) : null;
    set((state) => {
      const ids = new Set(state.selectedPathIds.length > 0 ? state.selectedPathIds : state.selectedPathId ? [state.selectedPathId] : []);
      return {
        currentStrokeWidth: width ?? state.currentStrokeWidth,
        document: {
          ...state.document,
          paths: state.document.paths.map((p) => (ids.has(p.id) ? { ...p, strokeWidth: width ?? p.strokeWidth } : p)),
        },
        isDirty: ids.size > 0,
      };
    });
  },

  updatePoint: (pathId, pointIndex, point) => {
    set((state) => ({
      document: {
        ...state.document,
        paths: state.document.paths.map((p) =>
          p.id === pathId ? { ...p, points: p.points.map((pt, i) => (i === pointIndex ? point : pt)) } : p,
        ),
      },
      isDirty: true,
    }));
  },
}));
