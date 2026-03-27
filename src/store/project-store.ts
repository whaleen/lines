import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import type { ComponentEntry, Project, ProjectMode } from "../types/project";

const STORE_FILE = "projects.json";
const STORE_KEY = "recent";

type AppScreen =
  | { id: "launch" }
  | { id: "project"; project: Project; components: ComponentEntry[] }
  | { id: "editor"; project: Project; component: ComponentEntry | null };

type ProjectState = {
  screen: AppScreen;
  recentProjects: Project[];
  // Actions
  loadRecents: () => Promise<void>;
  openProjectFolder: () => Promise<void>;
  openProject: (project: Project) => Promise<void>;
  refreshComponents: (project: Project) => Promise<ComponentEntry[]>;
  openComponent: (project: Project, component: ComponentEntry) => void;
  newComponent: (project: Project) => void;
  goToLaunch: () => void;
  goToProject: (project: Project) => Promise<void>;
};

function folderName(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? path;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

async function saveRecents(projects: Project[]) {
  const store = await load(STORE_FILE);
  await store.set(STORE_KEY, projects);
  await store.save();
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  screen: { id: "launch" },
  recentProjects: [],

  loadRecents: async () => {
    try {
      const store = await load(STORE_FILE);
      const projects = await store.get<Project[]>(STORE_KEY);
      set({ recentProjects: projects ?? [] });
    } catch {
      set({ recentProjects: [] });
    }
  },

  openProjectFolder: async () => {
    const selected = await open({ directory: true, multiple: false, title: "Open project folder" });
    if (!selected || Array.isArray(selected)) return;

    const detected = await invoke<{ mode: string; linesDir: string }>("detect_project", {
      folderPath: selected,
    });

    const existing = get().recentProjects.find((p) => p.path === selected);
    const project: Project = existing
      ? { ...existing, mode: detected.mode as ProjectMode, linesDir: detected.linesDir, lastOpened: new Date().toISOString() }
      : {
          id: randomId(),
          path: selected,
          name: folderName(selected),
          mode: detected.mode as ProjectMode,
          linesDir: detected.linesDir,
          lastOpened: new Date().toISOString(),
        };

    await get().openProject(project);
  },

  openProject: async (project) => {
    const updated = { ...project, lastOpened: new Date().toISOString() };
    const recents = [updated, ...get().recentProjects.filter((p) => p.id !== project.id)].slice(0, 20);
    set({ recentProjects: recents });
    await saveRecents(recents);
    await get().goToProject(updated);
  },

  refreshComponents: async (project) => {
    const components = await invoke<ComponentEntry[]>("list_components", {
      linesDir: project.linesDir,
    });
    return components;
  },

  goToProject: async (project) => {
    try {
      const components = await get().refreshComponents(project);
      set({ screen: { id: "project", project, components } });
    } catch (e) {
      console.error("goToProject failed:", e);
      set({ screen: { id: "project", project, components: [] } });
    }
  },

  openComponent: (project, component) => {
    set({ screen: { id: "editor", project, component } });
  },

  newComponent: (project) => {
    set({ screen: { id: "editor", project, component: null } });
  },

  goToLaunch: () => {
    set({ screen: { id: "launch" } });
  },
}));
