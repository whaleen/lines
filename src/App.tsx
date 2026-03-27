import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { Inspector } from "./components/Inspector";
import { Toolbar } from "./components/Toolbar";
import { TraceCanvas } from "./components/TraceCanvas";
import { useEditorStore } from "./store/editor-store";

function App() {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [imageOpacity, setImageOpacity] = useState(0.78);

  const {
    activeTool,
    cancelActivePath,
    deleteSelectedPath,
    deleteSelectedPoint,
    duplicateSelectedPaths,
    errorMessage,
    finishActivePath,
    loadProject,
    loadReferenceImage,
    projectPath,
    saveProject,
    selectedPathId,
    selectedPointIndex,
    setActiveTool,
    statusMessage,
  } = useEditorStore(
    useShallow((state) => ({
      activeTool: state.activeTool,
      cancelActivePath: state.cancelActivePath,
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      duplicateSelectedPaths: state.duplicateSelectedPaths,
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

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const [file] = e.target.files ?? [];
    if (!file) return;
    await loadReferenceImage(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaveInFlight(true);
    try { await saveProject(); } finally { setSaveInFlight(false); }
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

  const statusText = errorMessage || statusMessage || (projectPath ? projectPath.split(/[\\/]/).pop() : "");

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="app-name">lines</span>
        <div className="topbar-sep" />
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
        <button className="topbar-btn" onClick={loadProject} type="button">
          Open Project
        </button>
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
        {statusText && (
          <>
            <div className="topbar-sep" />
            <span className={`topbar-status${errorMessage ? " error" : ""}`}>{statusText}</span>
          </>
        )}
        <button
          className="topbar-btn primary"
          disabled={saveInFlight}
          onClick={handleSave}
          type="button"
        >
          {saveInFlight ? "Saving…" : "Save"}
        </button>
      </header>

      <Toolbar activeTool={activeTool} onSelectTool={setActiveTool} />

      <main className="canvas-area">
        <TraceCanvas imageOpacity={imageOpacity} />
      </main>

      <Inspector />
    </div>
  );
}

export default App;
