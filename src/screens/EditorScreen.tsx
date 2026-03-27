import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Inspector } from "../components/Inspector";
import { Toolbar } from "../components/Toolbar";
import { TraceCanvas } from "../components/TraceCanvas";
import { useUpdater } from "../hooks/useUpdater";
import { useEditorStore, sanitizeComponentName } from "../store/editor-store";
import { useProjectStore } from "../store/project-store";
import type { ComponentEntry, Project } from "../types/project";

type EditorScreenProps = {
  project: Project;
  component: ComponentEntry | null;
};

export function EditorScreen({ project, component }: EditorScreenProps) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [imageOpacity, setImageOpacity] = useState(0.78);
  const [nameInputValue, setNameInputValue] = useState("");
  const { state: updateState, install, relaunchApp } = useUpdater();
  const { goToProject } = useProjectStore();

  const {
    activeTool,
    cancelActivePath,
    componentName,
    deleteSelectedPath,
    deleteSelectedPoint,
    duplicateSelectedPaths,
    errorMessage,
    finishActivePath,
    isDirty,
    loadComponent,
    loadReferenceImage,
    promptName,
    resetEditor,
    saveNow,
    scheduleAutoSave,
    selectedPathId,
    selectedPointIndex,
    setActiveTool,
    setComponentName,
    statusMessage,
  } = useEditorStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      cancelActivePath: state.cancelActivePath,
      componentName: state.componentName,
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      duplicateSelectedPaths: state.duplicateSelectedPaths,
      errorMessage: state.errorMessage,
      finishActivePath: state.finishActivePath,
      isDirty: state.isDirty,
      loadComponent: state.loadComponent,
      loadReferenceImage: state.loadReferenceImage,
      promptName: state.promptName,
      resetEditor: state.resetEditor,
      saveNow: state.saveNow,
      scheduleAutoSave: state.scheduleAutoSave,
      selectedPathId: state.selectedPathId,
      selectedPointIndex: state.selectedPointIndex,
      setActiveTool: state.setActiveTool,
      setComponentName: state.setComponentName,
      statusMessage: state.statusMessage,
    })),
  );

  // Load component or reset when screen mounts
  useEffect(() => {
    if (component?.hasData) {
      loadComponent(component.jsonPath);
      setComponentName(component.name);
    } else {
      resetEditor(component?.name ?? "");
    }
  }, [component, loadComponent, resetEditor, setComponentName]);

  // Auto-save whenever isDirty flips to true and we have a name
  useEffect(() => {
    if (isDirty && componentName) {
      scheduleAutoSave(project);
    }
  }, [isDirty, componentName, project, scheduleAutoSave]);

  // Focus name input when prompt appears
  useEffect(() => {
    if (promptName) {
      setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [promptName]);

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const [file] = e.target.files ?? [];
    if (!file) return;
    await loadReferenceImage(file);
    e.target.value = "";
  };

  const handleNameConfirm = () => {
    const sanitized = sanitizeComponentName(nameInputValue);
    if (!sanitized) return;
    setComponentName(sanitized);
    setNameInputValue("");
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleNameConfirm();
    if (e.key === "Escape") setNameInputValue("");
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) return;

      if ((event.key === "d" || event.key === "D") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        duplicateSelectedPaths();
      } else if (event.key === "d" || event.key === "D" || event.key === "p" || event.key === "P") {
        event.preventDefault();
        setActiveTool("draw");
      } else if (event.key === "v" || event.key === "V") {
        event.preventDefault();
        setActiveTool("select");
      } else if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        setActiveTool("node");
      } else if (event.key === "Enter") {
        event.preventDefault();
        finishActivePath();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancelActivePath();
      } else if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        if (selectedPointIndex !== null) deleteSelectedPoint();
        else if (selectedPathId) deleteSelectedPath();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cancelActivePath,
    deleteSelectedPath,
    deleteSelectedPoint,
    duplicateSelectedPaths,
    finishActivePath,
    selectedPathId,
    selectedPointIndex,
    setActiveTool,
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
              ref={nameInputRef}
              className="topbar-name-input"
              placeholder="Name this component…"
              value={nameInputValue}
              onChange={(e) => setNameInputValue(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameConfirm}
              spellCheck={false}
            />
            <span className="topbar-name-hint">PascalCase · Lines suffix auto-added</span>
          </div>
        ) : (
          <>
            <button className="topbar-btn" onClick={() => imageInputRef.current?.click()} type="button">
              Open Image
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden-file-input"
              onChange={handleImageChange}
            />
            <div className="topbar-sep" />
            <label className="topbar-label" htmlFor="img-opacity">Ref</label>
            <input
              id="img-opacity"
              className="topbar-range"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={imageOpacity}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setImageOpacity(Number(e.target.value))}
            />
          </>
        )}

        {statusText && (
          <>
            <div className="topbar-sep" />
            <span className={`topbar-status${errorMessage ? " error" : ""}`}>{statusText}</span>
          </>
        )}

        {isDirty && componentName && (
          <>
            <div className="topbar-sep" />
            <span className="topbar-saving">saving…</span>
          </>
        )}

        {!componentName && !promptName && (
          <button
            className="topbar-btn primary"
            style={{ marginLeft: "auto" }}
            onClick={() => saveNow(project)}
            type="button"
          >
            Save
          </button>
        )}
      </header>

      {updateState.status === "available" && (
        <div className="update-banner">
          <span>lines {updateState.version} is available</span>
          <button className="update-banner-btn" onClick={install} type="button">Install update</button>
        </div>
      )}
      {updateState.status === "downloading" && (
        <div className="update-banner">
          <span>Downloading… {updateState.progress}%</span>
          <div className="update-progress-bar"><div className="update-progress-fill" style={{ width: `${updateState.progress}%` }} /></div>
        </div>
      )}
      {updateState.status === "ready" && (
        <div className="update-banner update-banner--ready">
          <span>Update ready</span>
          <button className="update-banner-btn" onClick={relaunchApp} type="button">Relaunch</button>
        </div>
      )}

      <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />

      <main className="canvas-area">
        <TraceCanvas imageOpacity={imageOpacity} />
      </main>

      <Inspector project={project} />
    </div>
  );
}
