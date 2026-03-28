import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "../store/editor-store";
import { THEME_COLORS, type CssColor } from "../types/lines";
import type { Project } from "../types/project";

type InspectorProps = { project: Project; onResizeCanvas: () => void };


// ── Color swatch ──────────────────────────────────────────────────────────────

function ColorSwatch({ value, active, onClick, title }: {
  value: CssColor;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  const isNone = value === "none";
  const isCurrent = value === "currentColor";
  return (
    <button
      className={`color-swatch${active ? " active" : ""}`}
      onClick={onClick}
      title={title}
      type="button"
      style={isNone || isCurrent ? undefined : { background: value }}
    >
      {isNone && (
        <svg viewBox="0 0 14 14" width="10" height="10" fill="none">
          <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
      )}
      {isCurrent && <span className="color-swatch-cc">cc</span>}
    </button>
  );
}

function ColorRow({ label, value, onChange }: {
  label: string;
  value: CssColor;
  onChange: (v: CssColor) => void;
}) {
  return (
    <div className="insp-field">
      <label>{label}</label>
      <div className="color-swatch-row">
        <ColorSwatch value="none"         active={value === "none"}         onClick={() => onChange("none")}         title="None" />
        <ColorSwatch value="currentColor" active={value === "currentColor"} onClick={() => onChange("currentColor")} title="currentColor (inherits)" />
        <div className="color-swatch-divider" />
        {THEME_COLORS.map((c) => (
          <ColorSwatch key={c.value} value={c.value} active={value === c.value} onClick={() => onChange(c.value)} title={c.label} />
        ))}
      </div>
    </div>
  );
}


// ── Inspector ─────────────────────────────────────────────────────────────────

export function Inspector({ project: _project, onResizeCanvas }: InspectorProps) {
  const {
    document,
    selectedPath,
    selectedPointIndex,
    setFill,
    setImageTransform,
    setPathClosed,
    setPathOpacity,
    setStroke,
    setStrokeWidth,
  } = useEditorStore(
    useShallow((s) => ({
      document: s.document,
      selectedPath: s.document.layers.flatMap((l) => l.paths).find((p) => p.id === s.selectedPathId) ?? null,
      selectedPointIndex: s.selectedPointIndex,
      setFill: s.setFill,
      setImageTransform: s.setImageTransform,
      setPathClosed: s.setPathClosed,
      setPathOpacity: s.setPathOpacity,
      setStroke: s.setStroke,
      setStrokeWidth: s.setStrokeWidth,
    })),
  );

  const [widthInput, setWidthInput] = useState(String(selectedPath?.strokeWidth ?? 2));

  useEffect(() => {
    if (selectedPath) setWidthInput(String(selectedPath.strokeWidth));
  }, [selectedPath?.strokeWidth]);

  const hasImage = document.sourceImage.width > 0;

  const fitImage = () => {
    if (!hasImage) return;
    const scale = Math.min(
      document.canvas.width / document.sourceImage.width,
      document.canvas.height / document.sourceImage.height,
    );
    setImageTransform(
      (document.canvas.width - document.sourceImage.width * scale) / 2,
      (document.canvas.height - document.sourceImage.height * scale) / 2,
      scale,
    );
  };

  const totalPaths = document.layers.reduce((n, l) => n + l.paths.length, 0);

  return (
    <aside className="inspector">
      {/* Canvas */}
      <div className="insp-section">
        <div className="insp-label">Canvas</div>
        <div className="insp-stat">{document.canvas.width}×{document.canvas.height} · {totalPaths} path{totalPaths !== 1 ? "s" : ""}</div>
        <button className="insp-action-btn" onClick={onResizeCanvas} type="button">Resize…</button>
      </div>

      {/* Image */}
      {hasImage && (
        <div className="insp-section">
          <div className="insp-label">Image</div>
          <div className="insp-stat">{document.sourceImage.width}×{document.sourceImage.height} · {Math.round(document.sourceImage.scale * 100)}%</div>
          <div className="insp-row">
            <button className="insp-action-btn" onClick={fitImage} type="button">Fit</button>
            <button className="insp-action-btn" onClick={() => setImageTransform(0, 0, 1)} type="button">Reset</button>
          </div>
          <div className="insp-hint">Alt+drag · Alt+scroll</div>
        </div>
      )}

      {/* Selection */}
      <div className="insp-section">
        <div className="insp-label">Selection</div>
        {selectedPath ? (
          <>
            {/* Fill */}
            <ColorRow label="Fill" value={selectedPath.fill} onChange={setFill} />

            {/* Stroke */}
            <ColorRow label="Stroke" value={selectedPath.stroke} onChange={setStroke} />

            {/* Stroke width */}
            <div className="insp-field">
              <label htmlFor="stroke-w">Width</label>
              <input
                id="stroke-w"
                type="number" min={0.5} step={0.5}
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
                onBlur={() => {
                  const n = parseFloat(widthInput);
                  if (Number.isFinite(n) && n > 0) setStrokeWidth(n);
                  else setWidthInput(String(selectedPath.strokeWidth));
                }}
                onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              />
            </div>

            {/* Opacity */}
            <div className="insp-field">
              <label>Opacity</label>
              <div className="layer-opacity-row">
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={selectedPath.opacity}
                  onChange={(e) => setPathOpacity(Number(e.target.value))}
                  className="layer-opacity-slider"
                />
                <span className="layer-opacity-value">{Math.round(selectedPath.opacity * 100)}%</span>
              </div>
            </div>

            {/* Closed toggle */}
            <div className="insp-field">
              <label>Path</label>
              <div className="insp-btn-group">
                <button className={`insp-seg-btn${!selectedPath.closed ? " active" : ""}`} onClick={() => setPathClosed(false)} type="button">Open</button>
                <button className={`insp-seg-btn${selectedPath.closed ? " active" : ""}`} onClick={() => setPathClosed(true)} type="button">Closed</button>
              </div>
            </div>

            <div className="insp-stat">
              {selectedPath.points.length} pts
              {selectedPointIndex !== null ? ` · pt ${selectedPointIndex + 1}` : ""}
            </div>
          </>
        ) : (
          <div className="insp-empty">Select a path to edit</div>
        )}
      </div>
    </aside>
  );
}
