import { useProjectStore } from "../store/project-store";
import type { ComponentEntry, Project } from "../types/project";

type ProjectScreenProps = {
  project: Project;
  components: ComponentEntry[];
};

export function ProjectScreen({ project, components }: ProjectScreenProps) {
  const { goToLaunch, openComponent, newComponent, goToProject } = useProjectStore();

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
            {components.map((component: ComponentEntry) => (
              <button
                key={component.tsxPath}
                className="component-card"
                onClick={() => openComponent(project, component)}
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
                <div className="component-card-name">{component.name}</div>
                {!component.hasData && (
                  <div className="component-card-warning">missing .lines.json</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
