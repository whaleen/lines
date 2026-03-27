type ToolbarProps = {
  activeTool: "select" | "draw";
  onSelectTool: (tool: "select" | "draw") => void;
};

export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  return (
    <div className="tool-cluster">
      <div className="tool-strip">
        <button
          className={`tool-button${activeTool === "select" ? " is-active" : ""}`}
          onClick={() => onSelectTool("select")}
          type="button"
          title="Select tool (V)"
        >
          Select
        </button>
        <button
          className={`tool-button${activeTool === "draw" ? " is-active" : ""}`}
          onClick={() => onSelectTool("draw")}
          type="button"
          title="Pen tool (D)"
        >
          Pen
        </button>
      </div>
    </div>
  );
}
