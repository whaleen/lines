import { useEffect } from "react";
import { useProjectStore } from "../store/project-store";
import type { Project } from "../types/project";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LaunchScreen() {
  const { recentProjects, loadRecents, openProjectFolder, openProject } = useProjectStore();

  useEffect(() => {
    loadRecents();
  }, [loadRecents]);

  return (
    <div className="launch-screen">
      <div className="launch-identity">
        <span className="launch-logo">lines</span>
        <span className="launch-tagline">SVG tracing for React</span>
      </div>

      <div className="launch-actions">
        <button className="launch-btn primary" onClick={openProjectFolder} type="button">
          Open Project
        </button>
      </div>

      {recentProjects.length > 0 && (
        <div className="launch-recents">
          <div className="launch-recents-label">Recent</div>
          <div className="launch-recents-list">
            {recentProjects.map((project: Project) => (
              <button
                key={project.id}
                className="launch-recent-item"
                onClick={() => openProject(project)}
                type="button"
              >
                <div className="launch-recent-name">{project.name}</div>
                <div className="launch-recent-meta">
                  <span className={`launch-recent-mode ${project.mode}`}>{project.mode}</span>
                  <span className="launch-recent-time">{timeAgo(project.lastOpened)}</span>
                </div>
                <div className="launch-recent-path">{project.path}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
