import * as Tooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

type ActiveTool = "select" | "node" | "draw";

type ToolbarProps = {
  activeTool: ActiveTool;
  onSelectTool: (tool: ActiveTool) => void;
};

function IconArrow() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M4 3v14l3.5-3.5 2.5 5.5 2-1-2.5-5.5H16z" fill="currentColor" />
    </svg>
  );
}

function IconNode() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M4 3v14l3.5-3.5 2.5 5.5 2-1-2.5-5.5H16z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPen() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
      <path
        d="M14.5 2.5l3 3L6.5 17l-4.5.5.5-4.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <line x1="11.5" y1="5.5" x2="14.5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  const tools: { id: ActiveTool; icon: ReactNode; label: string; key: string }[] = [
    { id: "select", icon: <IconArrow />, label: "Move",      key: "V" },
    { id: "node",   icon: <IconNode />,  label: "Node Edit", key: "A" },
    { id: "draw",   icon: <IconPen />,   label: "Pen",       key: "P" },
  ];

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="toolbar">
        {tools.map(({ id, icon, label, key }) => (
          <Tooltip.Root key={id}>
            <Tooltip.Trigger asChild>
              <button
                className={`tool-btn${activeTool === id ? " active" : ""}`}
                onClick={() => onSelectTool(id)}
                type="button"
                aria-label={label}
              >
                {icon}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="tooltip-content" side="right" sideOffset={6}>
                {label}
                <span className="tooltip-key">{key}</span>
                <Tooltip.Arrow className="tooltip-arrow" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ))}
      </div>
    </Tooltip.Provider>
  );
}
