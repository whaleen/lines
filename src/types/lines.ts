export type StrokeValue = "currentColor" | `#${string}`;

export type FillValue = "none" | "currentColor" | `#${string}`;

export type ThemePreviewMode = "light" | "dark" | "muted" | "primary";

export type Point = {
  x: number;
  y: number;
};

export type TracePath = {
  id: string;
  points: Point[];
  closed: boolean;
  stroke: StrokeValue;
  strokeWidth: number;
  fill: FillValue;
};

export type LinesDocument = {
  version: 1;
  name: string;
  sourceImage: {
    src: string;
    width: number;
    height: number;
  };
  export: {
    componentName: string;
    outputPath: string;
  };
  editor: {
    themePreview: ThemePreviewMode;
  };
  paths: TracePath[];
};

export const DEFAULT_DOCUMENT: LinesDocument = {
  version: 1,
  name: "Untitled",
  sourceImage: {
    src: "",
    width: 1200,
    height: 800,
  },
  export: {
    componentName: "UntitledLines",
    outputPath: "",
  },
  editor: {
    themePreview: "dark",
  },
  paths: [],
};
