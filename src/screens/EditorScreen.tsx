import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { CanvasResizeDialog } from "../components/CanvasResizeDialog";
import { Inspector } from "../components/Inspector";
import { LayersPanel } from "../components/LayersPanel";
import { Toolbar } from "../components/Toolbar";
import { TraceCanvas } from "../components/TraceCanvas";
import { generateComponentSource } from "../lib/component-generator";
import { useEditorStore } from "../store/editor-store";
import { useProjectStore } from "../store/project-store";
import type { ComponentEntry, Project } from "../types/project";

type EditorScreenProps = { project: Project; component: ComponentEntry | null };

export function EditorScreen({ project, component }: EditorScreenProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.78);
  const [editorTab, setEditorTab] = useState<"canvas" | "code">("canvas");
  const [rightTab, setRightTab] = useState<"properties" | "layers">("properties");
  const [showResizeDialog, setShowResizeDialog] = useState(false);
  const { goToProject } = useProjectStore();

  const {
    activeTool,
    bringForward,
    bringToFront,
    cancelActivePath,
    componentName,
    copySelected,
    cutSelected,
    deleteSelectedPath,
    deleteSelectedPoint,
    document,
    duplicateSelectedPaths,
    errorMessage,
    finishActivePath,
    groupSelected,
    isDirty,
    loadComponent,
    loadReferenceImage,
    pasteClipboard,
    promptName,
    resetEditor,
    saveNow,
    scheduleAutoSave,
    selectAll,
    selectedPathId,
    selectedPointIndex,
    resizeCanvas,
    sendBackward,
    sendToBack,
    setActiveTool,
    setComponentName,
    statusMessage,
  } = useEditorStore(
    useShallow((s) => ({
      activeTool: s.activeTool,
      bringForward: s.bringForward,
      bringToFront: s.bringToFront,
      cancelActivePath: s.cancelActivePath,
      componentName: s.componentName,
      copySelected: s.copySelected,
      cutSelected: s.cutSelected,
      deleteSelectedPath: s.deleteSelectedPath,
      deleteSelectedPoint: s.deleteSelectedPoint,
      document: s.document,
      duplicateSelectedPaths: s.duplicateSelectedPaths,
      errorMessage: s.errorMessage,
      finishActivePath: s.finishActivePath,
      groupSelected: s.groupSelected,
      isDirty: s.isDirty,
      loadComponent: s.loadComponent,
      loadReferenceImage: s.loadReferenceImage,
      pasteClipboard: s.pasteClipboard,
      promptName: s.promptName,
      resetEditor: s.resetEditor,
      saveNow: s.saveNow,
      scheduleAutoSave: s.scheduleAutoSave,
      selectAll: s.selectAll,
      selectedPathId: s.selectedPathId,
      selectedPointIndex: s.selectedPointIndex,
      resizeCanvas: s.resizeCanvas,
      sendBackward: s.sendBackward,
      sendToBack: s.sendToBack,
      setActiveTool: s.setActiveTool,
      setComponentName: s.setComponentName,
      statusMessage: s.statusMessage,
    })),
  );

  useEffect(() => {
    if (component?.hasData) {
      loadComponent(component.jsonPath, project.linesDir);
      setComponentName(component.name);
    } else {
      resetEditor(component?.name ?? "");
    }
  }, [component, loadComponent, resetEditor, setComponentName]);

  useEffect(() => {
    if (isDirty && componentName) scheduleAutoSave(project);
  }, [isDirty, componentName, project, scheduleAutoSave]);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const [file] = e.target.files ?? [];
    if (!file) return;
    await loadReferenceImage(file);
    e.target.value = "";
  };

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;

      const cmd = e.metaKey || e.ctrlKey;

      // ── Command shortcuts ──
      if (cmd) {
        switch (e.key) {
          case "a": case "A":
            e.preventDefault(); selectAll(); return;
          case "c": case "C":
            e.preventDefault(); copySelected(); return;
          case "x": case "X":
            e.preventDefault(); cutSelected(); return;
          case "v": case "V":
            e.preventDefault(); pasteClipboard(); return;
          case "d": case "D":
            e.preventDefault(); duplicateSelectedPaths(); return;
          case "g": case "G":
            e.preventDefault();
            if (e.shiftKey) { /* ungroup — future */ }
            else groupSelected();
            return;
          case "]":
            e.preventDefault();
            if (e.shiftKey) bringToFront(); else bringForward();
            return;
          case "[":
            e.preventDefault();
            if (e.shiftKey) sendToBack(); else sendBackward();
            return;
        }
        return; // let other ⌘ shortcuts (zoom etc.) fall through to TraceCanvas
      }

      // ── Tool shortcuts ──
      switch (e.key) {
        case "d": case "D": case "p": case "P":
          e.preventDefault(); setActiveTool("draw"); return;
        case "v": case "V":
          e.preventDefault(); setActiveTool("select"); return;
        case "a": case "A":
          e.preventDefault(); setActiveTool("node"); return;
        case "c": case "C":
          e.preventDefault(); setActiveTool("crop"); return;
        case "Enter":
          if (activeTool === "crop") return; // handled by TraceCanvas
          e.preventDefault(); finishActivePath(); return;
        case "Escape":
          if (activeTool === "crop") return; // handled by TraceCanvas
          e.preventDefault(); cancelActivePath(); return;
        case "Backspace": case "Delete":
          e.preventDefault();
          if (selectedPointIndex !== null) deleteSelectedPoint();
          else if (selectedPathId) deleteSelectedPath();
          return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeTool, bringForward, bringToFront, cancelActivePath, copySelected, cutSelected,
    deleteSelectedPath, deleteSelectedPoint, duplicateSelectedPaths, finishActivePath,
    groupSelected, pasteClipboard, selectAll, selectedPathId, selectedPointIndex,
    sendBackward, sendToBack, setActiveTool,
  ]);

  const statusText = errorMessage || statusMessage || (componentName ? componentName : "");

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="topbar-btn" onClick={() => goToProject(project)} type="button" title="Back to project">
          ← {project.name}
        </button>
        <div className="topbar-sep" />

        {promptName && !componentName ? (
          <div className="topbar-name-nudge">
            <input
              autoFocus
              className="topbar-name-input"
              placeholder="Component name…"
              onBlur={(e) => { if (e.target.value.trim()) setComponentName(e.target.value.trim()); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.currentTarget.value.trim()) setComponentName(e.currentTarget.value.trim());
                if (e.key === "Escape") setComponentName("");
                e.stopPropagation();
              }}
              spellCheck={false}
            />
            <span className="topbar-name-hint">Type a name and press Enter</span>
          </div>
        ) : (
          <>
            <button className="topbar-btn" onClick={() => imageInputRef.current?.click()} type="button">Open Image</button>
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={handleImageChange} />
            <div className="topbar-sep" />
            <label className="topbar-label" htmlFor="img-opacity">Ref</label>
            <input
              id="img-opacity"
              className="topbar-range"
              type="range" min="0" max="1" step="0.05"
              value={imageOpacity}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setImageOpacity(Number(e.target.value))}
            />
          </>
        )}

        {statusText && <><div className="topbar-sep" /><span className={`topbar-status${errorMessage ? " error" : ""}`}>{statusText}</span></>}
        {isDirty && componentName && <><div className="topbar-sep" /><span className="topbar-saving">saving…</span></>}
        {!componentName && !promptName && (
          <button className="topbar-btn primary" style={{ marginLeft: "auto" }} onClick={() => saveNow(project)} type="button">Save</button>
        )}
      </header>

      <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />

      <main className="canvas-area">
        <div className="editor-tabs">
          <button className={`editor-tab${editorTab === "canvas" ? " active" : ""}`} onClick={() => setEditorTab("canvas")} type="button">Canvas</button>
          <button className={`editor-tab${editorTab === "code" ? " active" : ""}`} onClick={() => setEditorTab("code")} type="button">Code</button>
        </div>
        <div className="canvas-content">
          {editorTab === "canvas" ? (
            <TraceCanvas imageOpacity={imageOpacity} />
          ) : (
            <div className="code-view">
              <pre className="code-pre"><code>{generateComponentSource(document)}</code></pre>
            </div>
          )}
        </div>
      </main>

      {/* Tabbed right panel */}
      <div className="right-panel">
        <div className="right-panel-tabs">
          <button className={`right-panel-tab${rightTab === "properties" ? " active" : ""}`} onClick={() => setRightTab("properties")} type="button">Properties</button>
          <button className={`right-panel-tab${rightTab === "layers" ? " active" : ""}`} onClick={() => setRightTab("layers")} type="button">Layers</button>
        </div>
        {rightTab === "properties" ? <Inspector project={project} onResizeCanvas={() => setShowResizeDialog(true)} /> : <LayersPanel />}
      </div>

      <CanvasResizeDialog
        open={showResizeDialog}
        currentW={document.canvas.width}
        currentH={document.canvas.height}
        onConfirm={(w, h, anchorX, anchorY) => resizeCanvas(w, h, anchorX, anchorY)}
        onClose={() => setShowResizeDialog(false)}
      />
    </div>
  );
}
