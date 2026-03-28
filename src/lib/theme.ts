import { invoke } from "@tauri-apps/api/core";
import type { ColorMode } from "../store/project-store";
import type { Project } from "../types/project";

const STYLE_ID = "lines-project-theme";
let mqlCleanup: (() => void) | null = null;

// ─── Project CSS injection ────────────────────────────────────────────────────

async function loadProjectCss(project: Project): Promise<string | null> {
  if (project.mode !== "shadcn") return null;

  const root = project.path.replace(/\\/g, "/").replace(/\/$/, "");
  const candidates = [
    `${root}/app/globals.css`,
    `${root}/src/app/globals.css`,
    `${root}/src/globals.css`,
    `${root}/src/index.css`,
    `${root}/styles/globals.css`,
  ];

  for (const cssPath of candidates) {
    try {
      return await invoke<string>("load_lines_project", { projectPath: cssPath });
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Extract :root { } and .dark { } variable blocks from a CSS file.
 * Uses a brace-counting approach to handle nested/multi-line blocks.
 */
function extractVariableBlocks(css: string): string {
  const blocks: string[] = [];

  function extractBlock(pattern: RegExp): void {
    const match = pattern.exec(css);
    if (!match) return;
    const start = match.index + match[0].length - 1; // position of '{'
    let depth = 1;
    let i = start + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    blocks.push(match[0].slice(0, -1) + css.slice(start + 1, i - 1) + "}");
  }

  // Extract all :root and .dark blocks
  const rootRe = /:root\s*\{/g;
  const darkRe = /\.dark\s*\{/g;
  let m: RegExpExecArray | null;

  while ((m = rootRe.exec(css)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    let depth = 1, i = openIdx + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    blocks.push(`:root {${css.slice(openIdx + 1, i - 1)}}`);
  }

  while ((m = darkRe.exec(css)) !== null) {
    const openIdx = m.index + m[0].length - 1;
    let depth = 1, i = openIdx + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}") depth--;
      i++;
    }
    blocks.push(`.dark {${css.slice(openIdx + 1, i - 1)}}`);
  }

  return blocks.join("\n");
}

function injectProjectStyles(css: string | null): void {
  document.getElementById(STYLE_ID)?.remove();
  if (!css) return;

  const extracted = extractVariableBlocks(css);
  if (!extracted.trim()) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = extracted;
  document.head.appendChild(style);
}

// ─── Dark class helpers ───────────────────────────────────────────────────────

function setDark(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
}

function teardownSystem(): void {
  mqlCleanup?.();
  mqlCleanup = null;
}

function setupSystem(): void {
  teardownSystem();
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => setDark(e.matches);
  mql.addEventListener("change", handler);
  setDark(mql.matches);
  mqlCleanup = () => mql.removeEventListener("change", handler);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Apply color mode and inject project CSS variables when a shadcn project is open.
 * Call whenever colorMode or the active project changes.
 */
export async function applyTheme(
  colorMode: ColorMode,
  activeProject: Project | null,
): Promise<void> {
  // Inject project's own :root / .dark variable blocks (or clear them)
  const projectCss = activeProject ? await loadProjectCss(activeProject) : null;
  injectProjectStyles(projectCss);

  // Apply dark/light class
  if (colorMode === "dark") {
    teardownSystem();
    setDark(true);
  } else if (colorMode === "light") {
    teardownSystem();
    setDark(false);
  } else {
    // "system" — follow OS preference
    setupSystem();
  }
}
