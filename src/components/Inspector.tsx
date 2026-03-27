import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "../store/editor-store";

export function Inspector() {
  const {
    deleteSelectedPath,
    deleteSelectedPoint,
    document,
    projectPath,
    selectedPath,
    selectedPointIndex,
    setComponentName,
    setOutputPath,
    setProjectName,
    setStroke,
    setStrokeWidth,
    pickProjectPath,
    pickComponentOutputPath,
  } = useEditorStore(
    useShallow((state) => ({
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      document: state.document,
      projectPath: state.projectPath,
      selectedPath: state.document.paths.find((p) => p.id === state.selectedPathId) ?? null,
      selectedPointIndex: state.selectedPointIndex,
      setComponentName: state.setComponentName,
      setOutputPath: state.setOutputPath,
      setProjectName: state.setProjectName,
      setStroke: state.setStroke,
      setStrokeWidth: state.setStrokeWidth,
      pickProjectPath: state.pickProjectPath,
      pickComponentOutputPath: state.pickComponentOutputPath,
    })),
  );

  const strokeHex =
    selectedPath && selectedPath.stroke !== "currentColor"
      ? selectedPath.stroke
      : "#e6edf7";

  return (
    <aside className="inspector">
      {/* Document */}
      <div className="insp-section">
        <div className="insp-label">Document</div>
        <div className="insp-field">
          <label htmlFor="doc-name">Name</label>
          <input id="doc-name" value={document.name} onChange={(e) => setProjectName(e.target.value)} />
        </div>
        <div className="insp-field">
          <label htmlFor="comp-name">Component</label>
          <input id="comp-name" value={document.export.componentName} onChange={(e) => setComponentName(e.target.value)} />
        </div>
        <div className="insp-stat">{document.paths.length} path{document.paths.length !== 1 ? "s" : ""} · {document.sourceImage.width}×{document.sourceImage.height}</div>
      </div>

      {/* Selection */}
      <div className="insp-section">
        <div className="insp-label">Selection</div>
        {selectedPath ? (
          <>
            <div className="insp-field">
              <label>Stroke</label>
              <div className="color-row">
                <input
                  type="color"
                  className="color-swatch"
                  value={strokeHex}
                  onChange={(e) => setStroke(e.target.value)}
                  title="Pick stroke color"
                />
                <input
                  className="color-text"
                  value={selectedPath.stroke}
                  onChange={(e) => setStroke(e.target.value)}
                  placeholder="currentColor"
                />
              </div>
            </div>
            <div className="insp-field">
              <label htmlFor="stroke-w">Width</label>
              <input
                id="stroke-w"
                type="number"
                min={0.5}
                step={0.5}
                value={selectedPath.strokeWidth}
                onChange={(e) => setStrokeWidth(Number(e.target.value))}
              />
            </div>
            <div className="insp-stat">
              {selectedPath.points.length} pts
              {selectedPointIndex !== null ? ` · pt ${selectedPointIndex + 1}` : ""}
            </div>
            {selectedPointIndex !== null && (
              <button className="insp-del-btn" onClick={deleteSelectedPoint} type="button">
                Delete point
              </button>
            )}
            <button className="insp-del-btn" onClick={deleteSelectedPath} type="button">
              Delete path
            </button>
          </>
        ) : (
          <div className="insp-empty">Select a path to edit</div>
        )}
      </div>

      {/* Files */}
      <div className="insp-section">
        <div className="insp-label">Files</div>
        <div className="insp-field">
          <label>Project (.lines.json)</label>
          <div className="file-row">
            <input
              readOnly
              value={projectPath}
              placeholder="not set"
              title={projectPath}
            />
            <button className="insp-pick-btn" onClick={pickProjectPath} type="button" title="Choose project file path">…</button>
          </div>
        </div>
        <div className="insp-field">
          <label>Component (.tsx)</label>
          <div className="file-row">
            <input
              readOnly
              value={document.export.outputPath}
              placeholder="not set"
              title={document.export.outputPath}
            />
            <button className="insp-pick-btn" onClick={pickComponentOutputPath} type="button" title="Choose component output path">…</button>
          </div>
        </div>
      </div>
    </aside>
  );
}
