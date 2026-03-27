import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore, sanitizeComponentName } from "../store/editor-store";
import type { Project } from "../types/project";

type InspectorProps = { project: Project };

export function Inspector({ project: _project }: InspectorProps) {
  const {
    componentName,
    deleteSelectedPath,
    deleteSelectedPoint,
    document,
    selectedPath,
    selectedPointIndex,
    setComponentName,
    setStroke,
    setStrokeWidth,
  } = useEditorStore(
    useShallow((state) => ({
      componentName: state.componentName,
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      document: state.document,
      selectedPath: state.document.paths.find((p) => p.id === state.selectedPathId) ?? null,
      selectedPointIndex: state.selectedPointIndex,
      setComponentName: state.setComponentName,
      setStroke: state.setStroke,
      setStrokeWidth: state.setStrokeWidth,
    })),
  );

  const [nameInput, setNameInput] = useState(componentName);

  // Keep local input in sync when store value changes externally
  useEffect(() => {
    setNameInput(componentName);
  }, [componentName]);

  const commitName = () => {
    const sanitized = sanitizeComponentName(nameInput);
    if (sanitized) setComponentName(sanitized);
    else setNameInput(componentName); // revert if empty/invalid
  };

  const strokeHex =
    selectedPath && selectedPath.stroke !== "currentColor" ? selectedPath.stroke : "#e6edf7";

  return (
    <aside className="inspector">
      {/* Component */}
      <div className="insp-section">
        <div className="insp-label">Component</div>
        <div className="insp-field">
          <label htmlFor="comp-name">Name</label>
          <input
            id="comp-name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
            placeholder="MyIllustrationLines"
            spellCheck={false}
          />
        </div>
        <div className="insp-stat">
          {document.paths.length} path{document.paths.length !== 1 ? "s" : ""}
          {document.sourceImage.width > 0 ? ` · ${document.sourceImage.width}×${document.sourceImage.height}` : ""}
        </div>
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
    </aside>
  );
}
