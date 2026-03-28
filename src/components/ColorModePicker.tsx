import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "../store/project-store";
import type { ColorMode } from "../store/project-store";

const MODES: { id: ColorMode; label: string; title: string }[] = [
  { id: "dark",   label: "D", title: "Dark" },
  { id: "light",  label: "L", title: "Light" },
  { id: "system", label: "⊙", title: "System" },
];

export function ColorModePicker() {
  const { colorMode, setColorMode } = useProjectStore(
    useShallow((state) => ({ colorMode: state.colorMode, setColorMode: state.setColorMode })),
  );

  return (
    <div className="color-mode-picker" role="group" aria-label="Color mode">
      {MODES.map((mode) => (
        <button
          key={mode.id}
          className={`color-mode-btn${colorMode === mode.id ? " active" : ""}`}
          onClick={() => setColorMode(mode.id)}
          title={mode.title}
          type="button"
          aria-pressed={colorMode === mode.id}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
