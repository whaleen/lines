import { useEffect } from "react";
import { ColorModePicker } from "./components/ColorModePicker";
import { EditorScreen } from "./screens/EditorScreen";
import { LaunchScreen } from "./screens/LaunchScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { applyTheme } from "./lib/theme";
import { useProjectStore } from "./store/project-store";

function App() {
  const screen = useProjectStore((state) => state.screen);
  const colorMode = useProjectStore((state) => state.colorMode);

  const activeProject =
    screen.id === "project" || screen.id === "editor" ? screen.project : null;

  useEffect(() => {
    applyTheme(colorMode, activeProject);
  }, [colorMode, activeProject]);

  return (
    <>
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
