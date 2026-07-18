import { useState } from "react";
import Home from "./components/Home";
import Game from "./components/Game";

export type GameMode = "ai" | "pvp";

export interface GameConfig {
  p1Color: string;
  p2Color: string;
  bgColor: string;
  tableColor: string;
  soundEnabled: boolean;
  difficulty: "easy" | "medium" | "hard";
  courtSurface: "hard" | "clay" | "grass";
}

export default function App() {
  const [view, setView] = useState<"home" | "game">("home");
  const [gameMode, setGameMode] = useState<GameMode>("pvp");
  const [config, setConfig] = useState<GameConfig>({
    p1Color: "#22d3ee", // Cyan
    p2Color: "#f472b6", // Pink
    bgColor: "#020617", // Dark Slate
    tableColor: "#1e40af", // Default hard court deep blue
    soundEnabled: true,
    difficulty: "medium",
    courtSurface: "hard",
  });

  return (
    <main className="min-h-screen transition-colors duration-500" style={{ backgroundColor: config.bgColor }}>
      {view === "home" && (
        <Home 
          config={config}
          setConfig={setConfig}
          onStart={(mode) => {
            setGameMode(mode);
            setView("game");
          }}
        />
      )}
      {view === "game" && (
        <Game 
          mode={gameMode} 
          config={config}
          onBack={() => setView("home")} 
        />
      )}
    </main>
  );
}
