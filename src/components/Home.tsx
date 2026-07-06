import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Play, 
  Settings,
  Info,
  HelpCircle,
  Check,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GameMode, GameConfig } from "../App";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface HomeProps {
  onStart: (mode: GameMode) => void;
  config: GameConfig;
  setConfig: React.Dispatch<React.SetStateAction<GameConfig>>;
}

const PADDLE_COLORS = [
  "#22d3ee", "#f472b6", "#a855f7", "#22c55e", "#ef4444", 
  "#f59e0b", "#ffffff", "#3b82f6", "#eab308", "#ec4899"
];

const BG_COLORS = [
  "#020617", "#0f172a", "#1e1b4b", "#064e3b", "#450a0a",
  "#1c1917", "#082f49", "#312e81"
];

const TABLE_COLORS = [
  "#ffffff", "#22d3ee", "#f472b6", "#4ade80", "#fbbf24",
  "#a78bfa", "#f87171", "#38bdf8", "#818cf8", "#94a3b8"
];

export default function Home({ onStart, config, setConfig }: HomeProps) {
  const [activeTab, setActiveTab] = useState<"play" | "rules" | "help" | "difficulty" | "settings">("play");
  const [showCustomization, setShowCustomization] = useState<GameMode | null>(null);
  const [subMenu, setSubMenu] = useState<"bg" | "table" | null>(null);

  const updateConfig = (key: keyof GameConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 overflow-hidden relative transition-colors duration-500" style={{ backgroundColor: config.bgColor }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 w-full max-w-4xl h-[600px] bg-slate-900/30 backdrop-blur-2xl rounded-[2rem] overflow-hidden flex shadow-2xl transition-all duration-500"
        style={{ border: `4px solid ${config.bgColor}` }}
      >
        {/* Sidebar */}
        <div className="w-64 flex flex-col bg-slate-900/60 pt-8 transition-all duration-500" style={{ borderRight: `2px solid ${config.bgColor}` }}>
          <nav className="flex-grow flex flex-col">
            {[
              { id: "play", label: "Play", icon: Play },
              { id: "difficulty", label: "Difficulty", icon: Clock },
              { id: "rules", label: "Rules", icon: Info },
              { id: "help", label: "Help", icon: HelpCircle },
              { id: "settings", label: "Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-4 px-8 py-6 text-sm font-extrabold uppercase tracking-widest transition-all border-l-4",
                  activeTab === tab.id 
                    ? "text-[#87CEEB] bg-white/5 border-[#87CEEB]" 
                    : "text-slate-400 border-transparent hover:text-black hover:bg-[#87CEEB]"
                )}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-grow p-12 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {activeTab === "play" && (
              <motion.div
                key="play"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col items-center justify-center max-w-md mx-auto text-center"
              >
                <h2 className="text-7xl font-black italic tracking-tighter mb-2 uppercase leading-none">
                  <span className="text-slate-500">SMASH</span><span className="text-[#87CEEB]">ZONE</span>
                </h2>
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.5em] mb-12 font-black">Pro League Edition</p>
                
                <div className="space-y-4 w-full">
                  <Button 
                    onClick={() => setShowCustomization("ai")}
                    className="w-full h-16 bg-white text-black hover:bg-[#87CEEB] hover:text-black font-extrabold text-lg rounded-xl shadow-xl transition-all hover:-translate-y-1"
                  >
                    SINGLE PLAYER
                  </Button>
                  <Button 
                    onClick={() => setShowCustomization("pvp")}
                    variant="outline"
                    className="w-full h-16 bg-white/5 border-2 border-white/10 text-white hover:bg-[#87CEEB] hover:text-black hover:border-[#87CEEB] font-extrabold text-lg rounded-xl transition-all hover:-translate-y-1"
                  >
                    LOCAL MULTIPLAYER
                  </Button>
                </div>
              </motion.div>
            )}

            {activeTab === "rules" && (
              <motion.div
                key="rules"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md space-y-8 h-full flex flex-col justify-center mx-auto"
              >
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-cyan-400">Pro Rules</h3>
                <div className="space-y-6">
                  {[
                    { id: "01", text: "Match is played as Best of 3 Sets." },
                    { id: "02", text: `Reach ${config.difficulty === "easy" ? 7 : config.difficulty === "medium" ? 9 : 11} Points to win a set.` },
                    { id: "03", text: "Win 2 Sets to secure the Match victory." },
                    { id: "04", text: "Speed increases slightly with each hit." },
                  ].map((rule) => (
                    <div key={rule.id} className="flex items-start gap-6">
                      <span className="text-2xl font-black italic text-cyan-400">{rule.id}.</span>
                      <p className="text-slate-200 font-bold leading-relaxed">{rule.text}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "help" && (
              <motion.div
                key="help"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-md space-y-8 h-full flex flex-col justify-center mx-auto"
              >
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-cyan-400">How to Play</h3>
                <div className="space-y-6 text-slate-200">
                  <div className="bg-white/5 p-6 rounded-xl border-2 border-white/5">
                    <p className="text-cyan-400 uppercase text-[10px] font-black mb-4 tracking-widest">Movement Controls</p>
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-white font-black text-xs mb-2">PLAYER 1 (LEFT)</p>
                        <p className="text-[11px] text-slate-400">Use <kbd className="px-2 py-1 bg-slate-700 rounded text-white mx-1">W</kbd> to go Up</p>
                        <p className="text-[11px] text-slate-400 mt-1">Use <kbd className="px-2 py-1 bg-slate-700 rounded text-white mx-1">S</kbd> to go Down</p>
                      </div>
                      <div>
                        <p className="text-white font-black text-xs mb-2">PLAYER 2 (RIGHT)</p>
                        <p className="text-[11px] text-slate-400">Use <kbd className="px-2 py-1 bg-slate-700 rounded text-white mx-1">↑</kbd> Arrow for Up</p>
                        <p className="text-[11px] text-slate-400 mt-1">Use <kbd className="px-2 py-1 bg-slate-700 rounded text-white mx-1">↓</kbd> Arrow for Down</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 p-6 rounded-xl border-2 border-white/5">
                    <p className="text-pink-400 uppercase text-[10px] font-black mb-2 tracking-widest">The Goal</p>
                    <p className="text-xs leading-relaxed font-bold">Deflect the ball using your paddle. If the ball passes the opponent's boundary, you score a point. Hit the ball with the edges of your paddle to add spin!</p>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "difficulty" && (
              <motion.div
                key="difficulty"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 h-full flex flex-col justify-center max-w-sm mx-auto"
              >
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-cyan-400">Difficulty</h3>
                <div className="space-y-4">
                  {(["easy", "medium", "hard"] as const).map((level) => (
                    <Button
                      key={level}
                      onClick={() => updateConfig("difficulty", level)}
                      className={cn(
                        "w-full h-14 font-black text-lg rounded-xl transition-all uppercase tracking-widest",
                        config.difficulty === level
                          ? "bg-[#87CEEB] text-black shadow-[0_0_20px_rgba(135,206,235,0.4)]"
                          : "bg-white/5 text-white border-2 border-white/10 hover:bg-[#87CEEB] hover:text-black hover:border-[#87CEEB]"
                      )}
                    >
                      {level}
                      {config.difficulty === level && <Check className="ml-2 h-5 w-5" />}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "settings" && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8 h-full flex flex-col justify-center max-w-sm mx-auto"
              >
                <h3 className="text-3xl font-black uppercase italic tracking-tighter text-cyan-400">Match Config</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border-2 border-white/5">
                    <span className="text-sm uppercase tracking-widest text-slate-300 font-black">Enable Sound</span>
                    <Switch 
                      checked={config.soundEnabled} 
                      onCheckedChange={(val) => updateConfig("soundEnabled", val)} 
                    />
                  </div>

                  <Button 
                    variant="outline"
                    onClick={() => setSubMenu(subMenu === "bg" ? null : "bg")}
                    className="w-full h-14 bg-white/5 border-2 border-white/10 text-white hover:bg-[#87CEEB] hover:text-black hover:border-[#87CEEB] font-extrabold rounded-xl"
                  >
                    CHANGE BACKGROUND
                  </Button>

                  <Button 
                    variant="outline"
                    onClick={() => setSubMenu(subMenu === "table" ? null : "table")}
                    className="w-full h-14 bg-white/5 border-2 border-white/10 text-white hover:bg-[#87CEEB] hover:text-black hover:border-[#87CEEB] font-extrabold rounded-xl"
                  >
                    CHANGE TABLE LOOK
                  </Button>
                  
                  <AnimatePresence>
                    {subMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="bg-slate-800/90 p-6 rounded-xl border-2 border-white/10"
                      >
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-4 text-center tracking-widest">
                          {subMenu === "bg" ? "Pick Arena Shade" : "Pick Surface Glow"}
                        </p>
                        <div className="flex flex-wrap gap-3 justify-center">
                          {(subMenu === "bg" ? BG_COLORS : TABLE_COLORS).map(color => (
                            <button
                              key={color}
                              onClick={() => updateConfig(subMenu === "bg" ? "bgColor" : "tableColor", color)}
                              className={cn(
                                "w-8 h-8 rounded-lg transition-all hover:scale-110 border-2 border-transparent",
                                (subMenu === "bg" ? config.bgColor : config.tableColor) === color && "border-white shadow-[0_0_10px_white]"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Customization Modal */}
      <AnimatePresence>
        {showCustomization && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900/95 p-10 rounded-[2rem] border-2 border-white/10 shadow-2xl w-full max-w-md text-center"
            >
              <h2 className="text-4xl font-black mb-8 uppercase italic tracking-tighter">Gear Up</h2>
              <div className="space-y-8 mb-10 text-left">
                <div>
                  <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-4">P1 Paddle Aura</p>
                  <div className="flex flex-wrap gap-3">
                    {PADDLE_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => updateConfig("p1Color", color)}
                        className={cn(
                          "w-8 h-8 rounded-lg transition-all hover:scale-110 border-2 border-transparent",
                          config.p1Color === color && "border-white shadow-[0_0_10px_white]"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                {showCustomization === "pvp" && (
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-4">P2 Paddle Aura</p>
                    <div className="flex flex-wrap gap-3">
                      {PADDLE_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => updateConfig("p2Color", color)}
                          className={cn(
                            "w-8 h-8 rounded-lg transition-all hover:scale-110 border-2 border-transparent",
                            config.p2Color === color && "border-white shadow-[0_0_10px_white]"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
                <div className="space-y-4">
                  <Button 
                    onClick={() => onStart(showCustomization)}
                    className="w-full h-16 bg-white text-black hover:bg-[#87CEEB] hover:text-black font-black text-xl rounded-xl"
                  >
                    ENTER ARENA
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setShowCustomization(null)}
                    className="w-full h-14 text-white hover:bg-sky-400 hover:text-black font-black text-lg rounded-xl transition-colors"
                  >
                    BACK
                  </Button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {config.soundEnabled && <audio src="/mamta.mp3" autoPlay loop />}
    </div>
  );
}
