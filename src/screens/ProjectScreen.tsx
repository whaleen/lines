import { useRef, useState } from "react";
import { useProjectStore } from "../store/project-store";
import type { ComponentEntry, Project } from "../types/project";

type ProjectScreenProps = {
  project: Project;
  components: ComponentEntry[];
};

type CardProps = {
  project: Project;
  component: ComponentEntry;
};

function ComponentCard({ project, component }: CardProps) {
  const { openComponent, deleteComponent, renameComponent } = useProjectStore();
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(component.name);
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(component.name);
    setRenaming(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 30);
  };

  const commitRename = async () => {
    setRenaming(false);
    await renameComponent(project, component, renameValue);
    setRenameValue(component.name);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") { setRenaming(false); setRenameValue(component.name); }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
  };

  const confirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteComponent(project, component);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  if (confirming) {
    return (
      <div className="component-card component-card--confirming">
        <div className="component-card-confirm-text">Delete {component.name}?</div>
        <div className="component-card-confirm-actions">
          <button className="component-card-confirm-btn danger" onClick={confirmDelete} type="button">Delete</button>
          <button className="component-card-confirm-btn" onClick={cancelDelete} type="button">Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="component-card-wrap">
      <button
        className="component-card"
        onClick={() => !renaming && openComponent(project, component)}
        type="button"
      >
        <div className="component-card-preview">
          <svg viewBox="0 0 80 60" width="80" height="60" aria-hidden="true">
            <rect width="80" height="60" fill="transparent" />
            {!component.hasData && (
              <text x="40" y="33" textAnchor="middle" fontSize="9" fill="rgba(216,224,240,0.2)">no data</text>
            )}
          </svg>
        </div>

        {renaming ? (
          <input
            ref={inputRef}
            className="component-card-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            spellCheck={false}
          />
        ) : (
          <div className="component-card-name">{component.name}</div>
        )}

        {!component.hasData && (
          <div className="component-card-warning">missing .lines.json</div>
        )}
      </button>

      <div className="component-card-actions">
        <button
          className="component-card-action-btn"
          onClick={startRename}
          title="Rename"
          type="button"
        >
          ✎
        </button>
        <button
          className="component-card-action-btn danger"
          onClick={handleDelete}
          title="Delete"
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export function ProjectScreen({ project, components }: ProjectScreenProps) {
  const { goToLaunch, newComponent, goToProject } = useProjectStore();

  return (
    <div className="project-screen">
      <header className="project-topbar">
        <button className="project-back-btn" onClick={goToLaunch} type="button" title="All projects">
          ←
        </button>
        <span className="project-name">{project.name}</span>
        <span className={`project-mode-badge ${project.mode}`}>{project.mode}</span>
        <div className="project-topbar-spacer" />
        <button className="project-refresh-btn" onClick={() => goToProject(project)} type="button" title="Refresh">
          ↺
        </button>
        <button className="project-new-btn" onClick={() => newComponent(project)} type="button">
          New Component
        </button>
      </header>

      <div className="project-content">
        {components.length === 0 ? (
          <div className="project-empty">
            <p className="project-empty-hint">No components yet.</p>
            <button className="launch-btn primary" onClick={() => newComponent(project)} type="button">
              New Component
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {components.map((component) => (
              <ComponentCard key={component.tsxPath} project={project} component={component} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
