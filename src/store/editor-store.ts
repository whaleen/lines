import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { create } from "zustand";
import { generateComponentSource } from "../lib/component-generator";
import { serializeDocument } from "../lib/document-serializer";
import { DEFAULT_DOCUMENT, type LinesDocument, type Point } from "../types/lines";

type ActiveTool = "select" | "node" | "draw";

type EditorState = {
  activePathId: string | null;
  activeTool: ActiveTool;
  currentStroke: string;
  currentStrokeWidth: number;
  document: LinesDocument;
  errorMessage: string;
  projectPath: string;
  referenceImageUrl: string;
  selectedPathId: string | null;
  selectedPathIds: string[];
  selectedPointIndex: number | null;
  statusMessage: string;
  addPointAt: (point: Point) => void;
  deleteSelectedPath: () => void;
  deleteSelectedPoint: () => void;
  deselectAll: () => void;
  cancelActivePath: () => void;
  duplicateSelectedPaths: () => void;
  finishActivePath: () => void;
  loadProject: () => Promise<void>;
  loadReferenceImage: (file: File) => Promise<void>;
  loadReferenceImageFromDialog: () => Promise<void>;
  pickComponentOutputPath: () => Promise<void>;
  pickProjectPath: () => Promise<void>;
  saveProject: () => Promise<void>;
  selectPath: (pathId: string | null, addToSelection?: boolean) => void;
  selectPoint: (pathId: string, pointIndex: number | null) => void;
  setActiveTool: (tool: ActiveTool) => void;
  setComponentName: (value: string) => void;
  setOutputPath: (value: string) => void;
  setPathPoints: (pathId: string, points: Point[]) => void;
  setProjectName: (value: string) => void;
  setProjectPath: (value: string) => void;
  setStroke: (value: string) => void;
  setStrokeWidth: (value: number) => void;
  updatePoint: (pathId: string, pointIndex: number, point: Point) => void;
};

const newPathId = () => `path_${Math.random().toString(36).slice(2, 10)}`;

function baseName(path: string) {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.split("/").pop() ?? normalized;
  return fileName.replace(/\.[^.]+$/, "");
}

function sanitizeComponentName(name: string) {
  const compact = baseName(name)
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  if (!compact) {
    return "UntitledLines";
  }

  return /^[A-Za-z_$]/.test(compact) ? `${compact}Lines` : `Trace${compact}Lines`;
}

function siblingComponentPath(projectPath: string, componentName: string) {
  const normalized = projectPath.replace(/\\/g, "/");
  const directory = normalized.includes("/")
    ? normalized.slice(0, normalized.lastIndexOf("/"))
    : "";
  const fileName = `${componentName}.tsx`;
  return directory ? `${directory}/${fileName}` : fileName;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  activePathId: null,
  activeTool: "draw",
  currentStroke: "currentColor",
  currentStrokeWidth: 2,
  document: DEFAULT_DOCUMENT,
  errorMessage: "",
  projectPath: "",
  referenceImageUrl: "",
  selectedPathId: null,
  selectedPathIds: [],
  selectedPointIndex: null,
  statusMessage: "",
  addPointAt: (point) => {
    set((state) => {
      if (state.activeTool !== "draw") {
        return state;
      }

      const { activePathId, document } = state;

      if (!activePathId) {
        const pathId = newPathId();
        return {
          activePathId: pathId,
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
          statusMessage: "",
        };
      }

      const path = document.paths.find((entry) => entry.id === activePathId);

      return {
        document: {
          ...document,
          paths: document.paths.map((entry) =>
            entry.id === activePathId
              ? {
                  ...entry,
                  points: [...entry.points, point],
                }
              : entry,
          ),
        },
        selectedPathId: activePathId,
        selectedPointIndex: path?.points.length ?? 0,
        statusMessage: "",
      };
    });
  },
  deleteSelectedPath: () => {
    set((state) => {
      const ids = new Set(state.selectedPathIds.length > 0 ? state.selectedPathIds : state.selectedPathId ? [state.selectedPathId] : []);
      if (ids.size === 0) return state;
      const nextPaths = state.document.paths.filter((path) => !ids.has(path.id));
      return {
        activePathId: ids.has(state.activePathId ?? "") ? null : state.activePathId,
        document: { ...state.document, paths: nextPaths },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
      };
    });
  },
  deselectAll: () => {
    set({
      activePathId: null,
      selectedPathId: null,
      selectedPathIds: [],
      selectedPointIndex: null,
    });
  },
  duplicateSelectedPaths: () => {
    set((state) => {
      const ids = new Set(state.selectedPathIds.length > 0 ? state.selectedPathIds : state.selectedPathId ? [state.selectedPathId] : []);
      if (ids.size === 0) return state;
      const copies = state.document.paths
        .filter((p) => ids.has(p.id))
        .map((p) => ({
          ...p,
          id: newPathId(),
          points: p.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 })),
        }));
      const newIds = copies.map((p) => p.id);
      return {
        document: { ...state.document, paths: [...state.document.paths, ...copies] },
        selectedPathId: newIds[0] ?? null,
        selectedPathIds: newIds,
        selectedPointIndex: null,
      };
    });
  },
  deleteSelectedPoint: () => {
    set((state) => {
      if (state.selectedPathId === null || state.selectedPointIndex === null) {
        return state;
      }

      const nextPaths = state.document.paths
        .map((path) => {
          if (path.id !== state.selectedPathId) {
            return path;
          }

          return {
            ...path,
            points: path.points.filter((_, index) => index !== state.selectedPointIndex),
          };
        })
        .filter((path) => path.points.length > 0);

      return {
        activePathId:
          state.activePathId === state.selectedPathId &&
          !nextPaths.some((path) => path.id === state.selectedPathId)
            ? null
            : state.activePathId,
        document: {
          ...state.document,
          paths: nextPaths,
        },
        selectedPointIndex: null,
      };
    });
  },
  cancelActivePath: () => {
    set((state) => {
      if (!state.activePathId) {
        return state;
      }

      return {
        activePathId: null,
        document: {
          ...state.document,
          paths: state.document.paths.filter((path) => path.id !== state.activePathId),
        },
        selectedPathId: null,
        selectedPathIds: [],
        selectedPointIndex: null,
        statusMessage: "Current path discarded.",
      };
    });
  },
  finishActivePath: () => {
    set((state) => {
      if (!state.activePathId) {
        return state;
      }

      const activePath = state.document.paths.find((path) => path.id === state.activePathId);
      const shouldDropPath = !activePath || activePath.points.length < 2;

      return {
        activePathId: null,
        document: shouldDropPath
          ? {
              ...state.document,
              paths: state.document.paths.filter((path) => path.id !== state.activePathId),
            }
          : state.document,
        selectedPointIndex: null,
        statusMessage: shouldDropPath
          ? "A path needs at least two points."
          : "Path finished. Start clicking to trace a new line.",
      };
    });
  },
  loadProject: async () => {
    const selected = await open({
      filters: [
        {
          name: "Lines Project",
          extensions: ["json"],
        },
      ],
      multiple: false,
      title: "Open .lines.json project",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    try {
      const projectSource = await invoke<string>("load_lines_project", {
        projectPath: selected,
      });
      const document = JSON.parse(projectSource) as LinesDocument;

      set({
        activePathId: null,
        document,
        errorMessage: "",
        projectPath: selected,
        referenceImageUrl: document.sourceImage.src ? convertFileSrc(document.sourceImage.src) : "",
        selectedPathId: null,
        selectedPointIndex: null,
        statusMessage: `Loaded ${baseName(selected)}.`,
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "Failed to open the project file.",
        statusMessage: "",
      });
    }
  },
  loadReferenceImage: async (file) => {
    const objectUrl = URL.createObjectURL(file);
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };

      image.onerror = () => reject(new Error("Failed to load the reference image."));
      image.src = objectUrl;
    });

    set((state) => ({
      document: {
        ...state.document,
        sourceImage: {
          src: file.name,
          width: dimensions.width,
          height: dimensions.height,
        },
      },
      referenceImageUrl: objectUrl,
      statusMessage: `Loaded ${file.name} (${dimensions.width}x${dimensions.height}).`,
      errorMessage: "",
    }));
  },
  loadReferenceImageFromDialog: async () => {
    const selected = await open({
      filters: [
        {
          name: "Image",
          extensions: ["png", "jpg", "jpeg", "webp", "gif"],
        },
      ],
      multiple: false,
      title: "Choose reference image",
    });

    if (!selected || Array.isArray(selected)) {
      return;
    }

    const objectUrl = convertFileSrc(selected);
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();

      image.onload = () => {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      };

      image.onerror = () => reject(new Error("Failed to load the selected image."));
      image.src = objectUrl;
    });

    set((state) => {
      const name = baseName(selected);
      const componentName = sanitizeComponentName(name);
      const nextProjectPath = state.projectPath || `${selected}.lines.json`;
      const nextOutputPath =
        state.document.export.outputPath || siblingComponentPath(nextProjectPath, componentName);

      return {
        document: {
          ...state.document,
          name,
          sourceImage: {
            src: selected,
            width: dimensions.width,
            height: dimensions.height,
          },
          export: {
            componentName,
            outputPath: nextOutputPath,
          },
        },
        projectPath: nextProjectPath,
        referenceImageUrl: objectUrl,
        statusMessage: `Loaded ${name} (${dimensions.width}x${dimensions.height}).`,
        errorMessage: "",
      };
    });
  },
  pickComponentOutputPath: async () => {
    const state = get();
    const selected = await save({
      defaultPath:
        state.document.export.outputPath ||
        siblingComponentPath(
          state.projectPath || "Untitled.lines.json",
          state.document.export.componentName,
        ),
      filters: [
        {
          name: "React Component",
          extensions: ["tsx"],
        },
      ],
      title: "Choose component output path",
    });

    if (!selected) {
      return;
    }

    set((current) => ({
      document: {
        ...current.document,
        export: {
          ...current.document.export,
          outputPath: selected,
        },
      },
    }));
  },
  pickProjectPath: async () => {
    const state = get();
    const selected = await save({
      defaultPath: state.projectPath || `${state.document.name || "Untitled"}.lines.json`,
      filters: [
        {
          name: "Lines Project",
          extensions: ["json"],
        },
      ],
      title: "Choose project save path",
    });

    if (!selected) {
      return;
    }

    set((current) => {
      const nextProjectPath = selected;
      const nextOutputPath =
        current.document.export.outputPath ||
        siblingComponentPath(nextProjectPath, current.document.export.componentName);

      return {
        projectPath: nextProjectPath,
        document: {
          ...current.document,
          export: {
            ...current.document.export,
            outputPath: nextOutputPath,
          },
        },
      };
    });
  },
  saveProject: async () => {
    let state = get();

    if (!state.projectPath.trim()) {
      await get().pickProjectPath();
      state = get();
    }

    if (!state.document.export.outputPath.trim()) {
      await get().pickComponentOutputPath();
      state = get();
    }

    const projectPath = state.projectPath.trim();
    const outputPath = state.document.export.outputPath.trim();
    const componentName = state.document.export.componentName.trim();

    if (!projectPath) {
      set({ errorMessage: "Set a project path before saving.", statusMessage: "" });
      return;
    }

    if (!outputPath) {
      set({ errorMessage: "Set a component output path before saving.", statusMessage: "" });
      return;
    }

    if (!componentName) {
      set({ errorMessage: "Set a component name before saving.", statusMessage: "" });
      return;
    }

    const json = serializeDocument(state.document);
    const componentSource = generateComponentSource(state.document);

    try {
      await invoke("save_lines_project", {
        payload: {
          componentPath: outputPath,
          componentSource,
          projectPath,
          projectSource: json,
        },
      });

      set({
        errorMessage: "",
        statusMessage: `Saved ${projectPath} and ${outputPath}.`,
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "Failed to save project files.",
        statusMessage: "",
      });
    }
  },
  selectPath: (pathId, addToSelection = false) => {
    set((state) => {
      if (!pathId) return { activePathId: null, selectedPathId: null, selectedPathIds: [], selectedPointIndex: null };
      if (addToSelection) {
        const already = state.selectedPathIds.includes(pathId);
        const nextIds = already
          ? state.selectedPathIds.filter((id) => id !== pathId)
          : [...state.selectedPathIds, pathId];
        return {
          activePathId: null,
          selectedPathId: nextIds[nextIds.length - 1] ?? null,
          selectedPathIds: nextIds,
          selectedPointIndex: null,
        };
      }
      return {
        activePathId: null,
        selectedPathId: pathId,
        selectedPathIds: [pathId],
        selectedPointIndex: null,
      };
    });
  },
  selectPoint: (pathId, pointIndex) => {
    set({
      selectedPathId: pathId,
      selectedPointIndex: pointIndex,
    });
  },
  setActiveTool: (tool) => {
    set((state) => ({
      activePathId: tool === "draw" ? state.activePathId : null,
      activeTool: tool,
      selectedPointIndex: tool === "node" ? state.selectedPointIndex : null,
      statusMessage: "",
    }));
  },
  setComponentName: (value) => {
    set((state) => ({
      document: {
        ...state.document,
        export: {
          ...state.document.export,
          componentName: value,
        },
      },
    }));
  },
  setOutputPath: (value) => {
    set((state) => ({
      document: {
        ...state.document,
        export: {
          ...state.document.export,
          outputPath: value,
        },
      },
    }));
  },
  setPathPoints: (pathId, points) => {
    set((state) => ({
      document: {
        ...state.document,
        paths: state.document.paths.map((path) =>
          path.id === pathId ? { ...path, points } : path,
        ),
      },
    }));
  },
  setProjectName: (value) => {
    set((state) => ({
      document: {
        ...state.document,
        name: value,
      },
    }));
  },
  setProjectPath: (value) => {
    set({ projectPath: value });
  },
  setStroke: (value) => {
    const normalized = value === "currentColor" ? "currentColor" : (`#${value.replace(/^#/, "")}` as const);
    set((state) => {
      const ids = new Set(state.selectedPathIds.length > 0 ? state.selectedPathIds : state.selectedPathId ? [state.selectedPathId] : []);
      return {
        currentStroke: normalized,
        document: {
          ...state.document,
          paths: state.document.paths.map((path) =>
            ids.has(path.id) ? { ...path, stroke: normalized } : path,
          ),
        },
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
          paths: state.document.paths.map((path) =>
            ids.has(path.id) ? { ...path, strokeWidth: width ?? path.strokeWidth } : path,
          ),
        },
      };
    });
  },
  updatePoint: (pathId, pointIndex, point) => {
    set((state) => ({
      document: {
        ...state.document,
        paths: state.document.paths.map((path) =>
          path.id === pathId
            ? {
                ...path,
                points: path.points.map((currentPoint, index) =>
                  index === pointIndex ? point : currentPoint,
                ),
              }
            : path,
        ),
      },
    }));
  },
}));
