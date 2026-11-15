import { GameScreen } from "./components/GameScreen";
import { Lobby, Searching, UsernameScreen } from "./components/Screens";
import { useStore } from "./store";

export default function App() {
  const screen = useStore((s) => s.screen);
  return (
    <main className="app">
      <h1 className="title">Chain Reaction</h1>
      {screen === "username" && <UsernameScreen />}
      {screen === "lobby" && <Lobby />}
      {screen === "searching" && <Searching />}
      {screen === "game" && <GameScreen />}
    </main>
  );
}
