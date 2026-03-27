import { EditorScreen } from "./screens/EditorScreen";
import { LaunchScreen } from "./screens/LaunchScreen";
import { ProjectScreen } from "./screens/ProjectScreen";
import { useProjectStore } from "./store/project-store";

function App() {
  const screen = useProjectStore((state) => state.screen);

  if (screen.id === "project") {
    return <ProjectScreen project={screen.project} components={screen.components} />;
  }

  if (screen.id === "editor") {
    return <EditorScreen project={screen.project} component={screen.component} />;
  }

  return <LaunchScreen />;
}

export default App;
