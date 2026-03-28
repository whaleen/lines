import { useEffect } from "react";
import { ColorModePicker } from "./components/ColorModePicker";
import { EditorScreen } from "./screens/EditorScreen";
import { LaunchScreen } from "./screens/LaunchScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { useUpdater } from "./hooks/useUpdater";
import { applyTheme } from "./lib/theme";
import { useProjectStore } from "./store/project-store";

function App() {
  const screen = useProjectStore((state) => state.screen);
  const colorMode = useProjectStore((state) => state.colorMode);
  const { state: updateState, install, relaunchApp } = useUpdater();

  const activeProject =
    screen.id === "project" || screen.id === "editor" ? screen.project : null;

  useEffect(() => {
    applyTheme(colorMode, activeProject);
  }, [colorMode, activeProject]);

  return (
    <>
      {updateState.status === "available" && (
        <div className="update-banner">
          <span>lines {updateState.version} is available</span>
          <button className="update-banner-btn" onClick={install} type="button">Install update</button>
        </div>
      )}
      {updateState.status === "downloading" && (
        <div className="update-banner">
          <span>Downloading… {updateState.progress}%</span>
          <div className="update-progress-bar"><div className="update-progress-fill" style={{ width: `${updateState.progress}%` }} /></div>
        </div>
      )}
      {updateState.status === "ready" && (
        <div className="update-banner update-banner--ready">
          <span>Update ready</span>
          <button className="update-banner-btn" onClick={relaunchApp} type="button">Relaunch</button>
        </div>
      )}
      {screen.id === "project" && (
        <ProjectScreen project={screen.project} components={screen.components} />
      )}
      {screen.id === "editor" && (
        <EditorScreen project={screen.project} component={screen.component} />
      )}
      {screen.id === "launch" && <LaunchScreen />}
      <ColorModePicker />
    </>
  );
}

export default App;
