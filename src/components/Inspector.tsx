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
    setProjectPath,
    setStroke,
    setStrokeWidth,
  } = useEditorStore(
    useShallow((state) => ({
      deleteSelectedPath: state.deleteSelectedPath,
      deleteSelectedPoint: state.deleteSelectedPoint,
      document: state.document,
      projectPath: state.projectPath,
      selectedPath: state.document.paths.find((path) => path.id === state.selectedPathId) ?? null,
      selectedPointIndex: state.selectedPointIndex,
      setComponentName: state.setComponentName,
      setOutputPath: state.setOutputPath,
      setProjectName: state.setProjectName,
      setProjectPath: state.setProjectPath,
      setStroke: state.setStroke,
      setStrokeWidth: state.setStrokeWidth,
    })),
  );

  return (
    <aside className="panel inspector">
      <div className="panel-header">
        <p className="eyebrow">Inspector</p>
        <h2>Project</h2>
      </div>

      <div className="inspector-list">
        <section className="inspector-card">
          <h3>Export</h3>
          <div className="field-grid">
            <div className="field-group">
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                onChange={(event) => setProjectName(event.target.value)}
                value={document.name}
              />
            </div>
            <div className="field-group">
              <label htmlFor="project-path">Project file path</label>
              <input
                id="project-path"
                onChange={(event) => setProjectPath(event.target.value)}
                placeholder="Choose with the Project Path button"
                value={projectPath}
              />
            </div>
            <div className="field-group">
              <label htmlFor="component-name">Component name</label>
              <input
                id="component-name"
                onChange={(event) => setComponentName(event.target.value)}
                value={document.export.componentName}
              />
            </div>
            <div className="field-group">
              <label htmlFor="output-path">Component output path</label>
              <input
                id="output-path"
                onChange={(event) => setOutputPath(event.target.value)}
                placeholder="Choose with the Component Path button"
                value={document.export.outputPath}
              />
            </div>
          </div>
        </section>

        <section className="inspector-card">
          <h3>Reference image</h3>
          <p className="muted-copy">
            {document.sourceImage.src
              ? `${document.sourceImage.src} • ${document.sourceImage.width}x${document.sourceImage.height}`
              : "Load an image from the left panel to start tracing."}
          </p>
        </section>

        <section className="inspector-card">
          <h3>Selection</h3>
          {selectedPath ? (
            <>
              <div className="field-row">
                <div className="field-group">
                  <label htmlFor="stroke">Stroke</label>
                  <input
                    id="stroke"
                    onChange={(event) => setStroke(event.target.value)}
                    value={selectedPath.stroke}
                  />
                </div>
                <div className="field-group">
                  <label htmlFor="stroke-width">Stroke width</label>
                  <input
                    id="stroke-width"
                    min={0.5}
                    onChange={(event) => setStrokeWidth(Number(event.target.value))}
                    step={0.5}
                    type="number"
                    value={selectedPath.strokeWidth}
                  />
                </div>
              </div>
              <p className="muted-copy">
                {selectedPath.points.length} points
                {selectedPointIndex !== null ? ` • point ${selectedPointIndex + 1} selected` : ""}
              </p>
              <button
                className="danger-button"
                disabled={selectedPointIndex === null}
                onClick={deleteSelectedPoint}
                type="button"
              >
                Delete selected point
              </button>
              <button className="danger-button" onClick={deleteSelectedPath} type="button">
                Delete selected path
              </button>
            </>
          ) : (
            <p className="muted-copy">
              Select a path or point on the canvas to edit its stroke or delete it.
            </p>
          )}
        </section>
      </div>
    </aside>
  );
}
