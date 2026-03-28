import { useEffect, useState } from "react";

type Anchor = [col: 0 | 1 | 2, row: 0 | 1 | 2];

const ANCHOR_LABELS = [
  ["Top Left", "Top Center", "Top Right"],
  ["Middle Left", "Center", "Middle Right"],
  ["Bottom Left", "Bottom Center", "Bottom Right"],
];

type Props = {
  open: boolean;
  currentW: number;
  currentH: number;
  onConfirm: (w: number, h: number, anchorX: number, anchorY: number) => void;
  onClose: () => void;
};

export function CanvasResizeDialog({ open, currentW, currentH, onConfirm, onClose }: Props) {
  const [wInput, setWInput] = useState(String(currentW));
  const [hInput, setHInput] = useState(String(currentH));
  const [anchor, setAnchor] = useState<Anchor>([0, 0]);

  useEffect(() => {
    if (open) {
      setWInput(String(currentW));
      setHInput(String(currentH));
      setAnchor([0, 0]);
    }
  }, [open, currentW, currentH]);

  if (!open) return null;

  const confirm = () => {
    const w = parseInt(wInput, 10);
    const h = parseInt(hInput, 10);
    if (w > 0 && h > 0) onConfirm(w, h, anchor[0] / 2, anchor[1] / 2);
    onClose();
  };

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className="dialog-panel"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === "Enter") confirm(); e.stopPropagation(); }}
      >
        <div className="dialog-title">Resize Canvas</div>

        <div className="dialog-fields">
          <div className="dialog-field">
            <label>W</label>
            <input
              type="number" min={1} step={1}
              value={wInput}
              onChange={(e) => setWInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="dialog-field">
            <label>H</label>
            <input
              type="number" min={1} step={1}
              value={hInput}
              onChange={(e) => setHInput(e.target.value)}
            />
          </div>
        </div>

        <div className="dialog-anchor-label">Anchor</div>
        <div className="anchor-grid">
          {([0, 1, 2] as const).map((row) =>
            ([0, 1, 2] as const).map((col) => (
              <button
                key={`${col}-${row}`}
                className={`anchor-dot${anchor[0] === col && anchor[1] === row ? " active" : ""}`}
                onClick={() => setAnchor([col, row])}
                title={ANCHOR_LABELS[row][col]}
                type="button"
              />
            ))
          )}
        </div>

        <div className="dialog-actions">
          <button className="dialog-btn" onClick={onClose} type="button">Cancel</button>
          <button className="dialog-btn primary" onClick={confirm} type="button">Resize</button>
        </div>
      </div>
    </div>
  );
}
