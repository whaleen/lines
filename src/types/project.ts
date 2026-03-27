export type ProjectMode = "shadcn" | "adhoc";

export type Project = {
  id: string;
  path: string;       // repo root folder
  name: string;       // derived from folder name
  mode: ProjectMode;
  linesDir: string;   // absolute path to where components live
  lastOpened: string; // ISO date string
};

export type ComponentEntry = {
  name: string;       // "SomethingLines"
  tsxPath: string;
  jsonPath: string;
  hasData: boolean;   // true if .lines.json exists alongside the .tsx
};
