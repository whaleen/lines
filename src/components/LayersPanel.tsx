import { useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "../store/editor-store";

export function LayersPanel() {
  const {
    activeLayerId,
    document,
    addLayer,
    deleteLayer,
    renameLayer,
    reorderLayer,
    setLayerVisible,
    setLayerLocked,
    setLayerOpacity,
    setActiveLayer,
  } = useEditorStore(
    useShallow((s) => ({
      activeLayerId: s.activeLayerId,
      document: s.document,
      addLayer: s.addLayer,
      deleteLayer: s.deleteLayer,
      renameLayer: s.renameLayer,
      reorderLayer: s.reorderLayer,
      setLayerVisible: s.setLayerVisible,
      setLayerLocked: s.setLayerLocked,
      setLayerOpacity: s.setLayerOpacity,
      setActiveLayer: s.setActiveLayer,
    })),
  );

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameLayer(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const startRename = (layerId: string, currentName: string) => {
    setRenamingId(layerId);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.select(), 30);
  };

  const activeLayer = document.layers.find((l) => l.id === activeLayerId);

  return (
    <div className="layers-panel">
      <div className="layers-list">
        {document.layers.map((layer) => (
          <div
            key={layer.id}
            className={`layer-item${layer.id === activeLayerId ? " active" : ""}${dragOverId === layer.id ? " drag-over" : ""}`}
            onClick={() => setActiveLayer(layer.id)}
            draggable
            onDragStart={(e) => { e.dataTransfer.setData("text/plain", layer.id); e.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(e) => { e.preventDefault(); setDragOverId(layer.id); }}
            onDragLeave={() => setDragOverId(null)}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId && fromId !== layer.id) reorderLayer(fromId, layer.id);
              setDragOverId(null);
            }}
            onDragEnd={() => setDragOverId(null)}
          >
            {/* Visibility */}
            <button
              className={`layer-icon-btn${!layer.visible ? " muted" : ""}`}
              title={layer.visible ? "Hide layer" : "Show layer"}
              onClick={(e) => { e.stopPropagation(); setLayerVisible(layer.id, !layer.visible); }}
              type="button"
            >
              {layer.visible ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <ellipse cx="8" cy="8" rx="7" ry="5" stroke="currentColor" strokeWidth="1.3"/>
                  <circle cx="8" cy="8" r="2.5" fill="currentColor"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <line x1="2" y1="14" x2="14" y2="2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <path d="M4.5 10.5A7 5 0 0 1 1 8c1-2 4-5 7-5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M11.5 5.5A7 5 0 0 1 15 8c-1 2-4 5-7 5" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              )}
            </button>

            {/* Lock */}
            <button
              className={`layer-icon-btn${layer.locked ? " active" : ""}`}
              title={layer.locked ? "Unlock layer" : "Lock layer"}
              onClick={(e) => { e.stopPropagation(); setLayerLocked(layer.id, !layer.locked); }}
              type="button"
            >
              {layer.locked ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M5 7V5a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="1.3"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                  <rect x="3" y="7" width="10" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" opacity="0.35"/>
                  <path d="M5 7V5a3 3 0 1 1 6 0" stroke="currentColor" strokeWidth="1.3" opacity="0.35"/>
                </svg>
              )}
            </button>

            {/* Name */}
            <div className="layer-name" onDoubleClick={(e) => { e.stopPropagation(); startRename(layer.id, layer.name); }}>
              {renamingId === layer.id ? (
                <input
                  ref={renameInputRef}
                  className="layer-rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") setRenamingId(null);
                    e.stopPropagation();
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className={!layer.visible ? "layer-name-muted" : ""}>{layer.name}</span>
              )}
            </div>

            {/* Path count */}
            <span className="layer-count">{layer.paths.length}</span>
          </div>
        ))}
      </div>

      {/* Active layer detail */}
      {activeLayer && (
        <div className="layer-detail">
          <div className="insp-field">
            <label>Opacity</label>
            <div className="layer-opacity-row">
              <input
                type="range" min={0} max={1} step={0.01}
                value={activeLayer.opacity}
                onChange={(e) => setLayerOpacity(activeLayer.id, Number(e.target.value))}
                className="layer-opacity-slider"
              />
              <span className="layer-opacity-value">{Math.round(activeLayer.opacity * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="layers-footer">
        <button className="layers-footer-btn" title="Add layer" onClick={addLayer} type="button">
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          Add Layer
        </button>
        <button
          className="layers-footer-btn layers-footer-btn--danger"
          title="Delete active layer"
          onClick={() => { if (document.layers.length > 1) deleteLayer(activeLayerId); }}
          disabled={document.layers.length <= 1}
          type="button"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
            <path d="M3 5h10M6 5V3h4v2M6 8v5M10 8v5M4 5l1 8h6l1-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
}
