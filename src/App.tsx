import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Inspector } from "./components/Inspector";
import { Toolbar } from "./components/Toolbar";
import { TraceCanvas } from "./components/TraceCanvas";
import { useEditorStore } from "./store/editor-store";

function App() {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const {
    activeTool,
    document,
    errorMessage,
    deleteSelectedPath,
    deleteSelectedPoint,
    cancelActivePath,
    finishActivePath,
    loadProject,
    loadReferenceImage,
    projectPath,
    saveProject,
    selectedPointIndex,
    setActiveTool,
    selectedPathId,
    statusMessage,
  } = useEditorStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      cancelActivePath: state.cancelActivePath,
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      document: state.document,
      errorMessage: state.errorMessage,
      finishActivePath: state.finishActivePath,
      loadProject: state.loadProject,
      loadReferenceImage: state.loadReferenceImage,
      projectPath: state.projectPath,
      saveProject: state.saveProject,
      selectedPathId: state.selectedPathId,
      selectedPointIndex: state.selectedPointIndex,
      setActiveTool: state.setActiveTool,
      statusMessage: state.statusMessage,
    })),
  );

  const handleReferenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const [file] = event.target.files ?? [];

    if (!file) {
      return;
    }

    await loadReferenceImage(file);
    event.target.value = "";
  };

  const handleSave = async () => {
    setSaveInFlight(true);

    try {
      await saveProject();
    } finally {
      setSaveInFlight(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        setActiveTool("draw");
      }

      if (event.key === "v" || event.key === "V" || event.key === "s" || event.key === "S") {
        event.preventDefault();
        setActiveTool("select");
      }

      if (event.key === "Enter") {
        event.preventDefault();
        finishActivePath();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        cancelActivePath();
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        if (selectedPointIndex !== null) {
          deleteSelectedPoint();
        } else if (selectedPathId) {
          deleteSelectedPath();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cancelActivePath,
    deleteSelectedPath,
    deleteSelectedPoint,
    finishActivePath,
    selectedPathId,
    selectedPointIndex,
    setActiveTool,
  ]);

  return (
    <div className="app-shell">
      <aside className="panel sidebar">
        <div className="panel-header">
          <div>
            <p className="eyebrow">lines</p>
            <h1>Tracing Studio</h1>
          </div>
          <p className="panel-copy">
            Trace over a reference image and save the result as a generated React SVG component.
          </p>
        </div>
        <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />
        <input
          ref={imageInputRef}
          accept="image/*"
          className="hidden-file-input"
          onChange={handleReferenceChange}
          type="file"
        />
        <div className="action-row">
          <button
            className="tool-button"
            onClick={() => imageInputRef.current?.click()}
            type="button"
          >
            Open Image
          </button>
          <button className="tool-button" onClick={loadProject} type="button">
            Open Project
          </button>
          <button
            className="primary-button"
            disabled={saveInFlight}
            onClick={handleSave}
            type="button"
          >
            {saveInFlight ? "Saving..." : "Save"}
          </button>
        </div>
        <div className="inspector-card">
          <h3>Shortcuts</h3>
          <p className="muted-copy">
            <strong>D</strong> draw, <strong>V</strong> select, <strong>Enter</strong> finish path,
            <strong> Escape</strong> discard path, <strong>Delete</strong> remove selection.
          </p>
          <p className="muted-copy">
            Use the mouse wheel to zoom. Hold <strong>Space</strong> and drag to pan.
          </p>
        </div>
        <div className="status-stack">
          <p className="status-line">
            Project file:
            <span>{projectPath || " not set"}</span>
          </p>
          {statusMessage ? <p className="status-ok">{statusMessage}</p> : null}
          {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
        </div>
      </aside>

      <main className="workspace">
        <section className="panel canvas-panel">
          <div className="panel-header compact">
            <div>
              <p className="eyebrow">Canvas</p>
              <h2>{document.name}</h2>
            </div>
            <p className="panel-copy">
              Pen tool to trace, select tool to adjust points, Enter or double click to finish.
            </p>
          </div>
          <TraceCanvas />
        </section>
        <Inspector />
      </main>
    </div>
  );
}

export default App;
