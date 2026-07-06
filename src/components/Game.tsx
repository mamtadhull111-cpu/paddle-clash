import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Pause, Play, LogOut, RotateCcw, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { GameMode, GameConfig } from "../App";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface GameProps {
  mode: GameMode;
  config: GameConfig;
  onBack: () => void;
}

export default function Game({ mode, config, onBack }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState([0, 0]);
  const [games, setGames] = useState([0, 0]);
  const [setHistory, setSetHistory] = useState<{p1: number, p2: number}[]>([]);
  const [gameState, setGameState] = useState<"playing" | "paused" | "gameOver">("playing");
  const [winner, setWinner] = useState<number | null>(null);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const [time, setTime] = useState(0);

  const handleScore = (scoringPlayer: number) => {
    setPoints(prev => {
      const newPoints = [...prev];
      newPoints[scoringPlayer]++;
      return newPoints;
    });
  };

  // Monitor points for set wins
  useEffect(() => {
    const [p1, p2] = points;
    if (p1 >= POINTS_TO_WIN_SET || p2 >= POINTS_TO_WIN_SET) {
      const gameWinner = p1 > p2 ? 0 : 1;
      setSetHistory(prev => [...prev, { p1, p2 }]);
      setGames(prev => {
        const newGames = [...prev];
        newGames[gameWinner]++;
        if (newGames[gameWinner] >= 2) {
          setWinner(gameWinner);
          setGameState("gameOver");
        }
        return newGames;
      });
      setPoints([0, 0]);
    }
  }, [points]);
  
  // Game state refs for physics
  const ballRef = useRef({ 
    x: 400, y: 300, 
    dx: 0, dy: 0, 
    speed: 7, 
    radius: 7
  });
  const paddle1Y = useRef(250);
  const paddle2Y = useRef(250);
  const keysPressed = useRef<Set<string>>(new Set());

  const PADDLE_H = 80;
  const PADDLE_W = 12;
  const POINTS_TO_WIN_SET = config.difficulty === "easy" ? 7 : config.difficulty === "medium" ? 9 : 11;

  const playSound = (freq: number) => {
    if (!config.soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      console.error("Audio error:", e);
    }
  };

  // Timer effect
  useEffect(() => {
    let interval: number;
    if (gameState === "playing") {
      interval = window.setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameState]);

  // Celebration effect
  useEffect(() => {
    if (gameState === "gameOver") {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const interval: any = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (gameState !== "gameOver") {
          setGameState(prev => prev === "paused" ? "playing" : "paused");
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.key);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  const resetBall = (canvasWidth: number, canvasHeight: number) => {
    ballRef.current.x = canvasWidth / 2;
    ballRef.current.y = canvasHeight / 2;
    
    let speedMultiplier = 0.65; // medium (easy + 30% = 0.5 * 1.3)
    if (config.difficulty === "easy") speedMultiplier = 0.5; // 50%
    if (config.difficulty === "hard") speedMultiplier = 0.975; // medium + 50% = 0.65 * 1.5
    
    const speed = (canvasWidth / 110) * speedMultiplier;
    ballRef.current.dx = (Math.random() > 0.5 ? 1 : -1) * speed;
    ballRef.current.dy = (Math.random() - 0.5) * speed;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;

    const initPositions = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      paddle1Y.current = canvas.height / 2 - PADDLE_H / 2;
      paddle2Y.current = canvas.height / 2 - PADDLE_H / 2;
      resetBall(canvas.width, canvas.height);
    };

    initPositions();

    const update = () => {
      if (gameState === "paused" || gameState === "gameOver") return;

      // Paddle movement
      const paddleSpeed = 8;

      // Player 1 (W/S)
      if (keysPressed.current.has("w") || keysPressed.current.has("W")) {
        paddle1Y.current = Math.max(0, paddle1Y.current - paddleSpeed);
      }
      if (keysPressed.current.has("s") || keysPressed.current.has("S")) {
        paddle1Y.current = Math.min(canvas.height - PADDLE_H, paddle1Y.current + paddleSpeed);
      }

      // Player 2 / AI (Arrows)
      if (mode === "pvp") {
        if (keysPressed.current.has("ArrowUp")) {
          paddle2Y.current = Math.max(0, paddle2Y.current - paddleSpeed);
        }
        if (keysPressed.current.has("ArrowDown")) {
          paddle2Y.current = Math.min(canvas.height - PADDLE_H, paddle2Y.current + paddleSpeed);
        }
      } else {
        // AI Logic: Predictive
        let aiSpeed = 6.5;
        if (config.difficulty === "easy") aiSpeed = 4.5;
        if (config.difficulty === "hard") aiSpeed = 8.5;

        if (ballRef.current.dx > 0) {
          const targetY = ballRef.current.y - PADDLE_H / 2;
          const dist = targetY - paddle2Y.current;
          if (Math.abs(dist) > 5) {
            paddle2Y.current += Math.sign(dist) * aiSpeed;
          }
        }
        paddle2Y.current = Math.max(0, Math.min(canvas.height - PADDLE_H, paddle2Y.current));
      }

      // Ball physics
      const ball = ballRef.current;
      ball.x += ball.dx;
      ball.y += ball.dy;

      // Wall bounce
      if (ball.y <= 0 || ball.y >= canvas.height) {
        ball.dy *= -1;
        playSound(400);
      }

      // Paddle collision
      const p1X = 30;
      const p2X = canvas.width - 30 - PADDLE_W;

      // Paddle 1
      if (ball.dx < 0 && ball.x <= p1X + PADDLE_W && ball.x >= p1X && ball.y >= paddle1Y.current && ball.y <= paddle1Y.current + PADDLE_H) {
        ball.dx = Math.abs(ball.dx) * 1.05; // Speed up
        ball.dy = (ball.y - (paddle1Y.current + PADDLE_H / 2)) * 0.25;
        playSound(600);
      }

      // Paddle 2
      if (ball.dx > 0 && ball.x >= p2X - ball.radius && ball.x <= p2X + PADDLE_W && ball.y >= paddle2Y.current && ball.y <= paddle2Y.current + PADDLE_H) {
        ball.dx = -Math.abs(ball.dx) * 1.05; // Speed up
        ball.dy = (ball.y - (paddle2Y.current + PADDLE_H / 2)) * 0.25;
        playSound(600);
      }

      // Scoring
      if (ball.x < 0 || ball.x > canvas.width) {
        const scoringPlayer = ball.x < 0 ? 1 : 0;
        handleScoreLocal(scoringPlayer);
      }
    };

    const handleScoreLocal = (scoringPlayer: number) => {
      playSound(200);
      handleScore(scoringPlayer);
      resetBall(canvas.width, canvas.height);
    };

    const render = () => {
      update();
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Table Surface
      const p1X = 30;
      const p2X = canvas.width - 30 - PADDLE_W;
      
      ctx.fillStyle = config.tableColor;
      ctx.globalAlpha = 0.2; // Apply color with moderate visibility
      ctx.fillRect(p1X, 0, p2X - p1X + PADDLE_W, canvas.height);
      ctx.globalAlpha = 1.0;
      
      // Center Net
      ctx.setLineDash([8, 12]);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 0);
      ctx.lineTo(canvas.width / 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Paddles
      const drawPaddle = (x: number, y: number, color: string) => {
        ctx.fillStyle = color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.roundRect(x, y, PADDLE_W, PADDLE_H, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
      };

      drawPaddle(30, paddle1Y.current, config.p1Color); 
      drawPaddle(canvas.width - 30 - PADDLE_W, paddle2Y.current, config.p2Color); 

      // Ball
      const ball = ballRef.current;
      ctx.fillStyle = "white";
      ctx.shadowColor = "white";
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, mode, config]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const resetGame = () => {
    setPoints([0, 0]);
    setGames([0, 0]);
    setSetHistory([]);
    setTime(0);
    setWinner(null);
    setGameState("playing");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-white p-4 overflow-hidden relative">
      {/* Real HUD Scoreboard */}
      <div className="real-scoreboard">
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase text-slate-400 font-black">Player 1</span>
          <div className="flex items-center">
            <div className="flex gap-1 mr-2 text-[10px] text-slate-600 font-bold">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn(setHistory[i] ? "text-white" : "opacity-20")}>
                  {setHistory[i] ? setHistory[i].p1 : 0}
                </span>
              ))}
            </div>
            <span className="active-set tabular-nums" style={{ color: config.p1Color }}>{points[0]}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center px-4 border-x border-white/20">
          <span className="text-sm font-black text-cyan-400 font-mono">{formatTime(time)}</span>
          <span className="text-[9px] font-black uppercase tracking-tighter mt-1 opacity-60">Set {games[0] + games[1] + 1}</span>
        </div>

        <div className="flex flex-col items-start">
          <span className="text-[10px] uppercase text-slate-400 font-black">{mode === "ai" ? "COMPUTER" : "PLAYER 2"}</span>
          <div className="flex items-center">
            <span className="active-set mr-2 tabular-nums" style={{ color: config.p2Color }}>{points[1]}</span>
            <div className="flex gap-1 text-[10px] text-slate-600 font-bold">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn(setHistory[i] ? "text-white" : "opacity-20")}>
                  {setHistory[i] ? setHistory[i].p2 : 0}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Pause Button */}
      <div className="absolute bottom-6 right-6 z-20">
        <button 
          className="w-12 h-12 bg-white/10 border-2 border-white/20 rounded-full flex items-center justify-center hover:bg-[#87CEEB] hover:text-black transition-all shadow-lg" 
          onClick={() => setGameState("paused")}
        >
          <Pause className="h-6 w-6" />
        </button>
      </div>

      <div 
        className="relative w-full max-w-[950px] aspect-[2/1] bg-slate-900/30 rounded-[20px] overflow-hidden shadow-2xl transition-all duration-500"
        style={{ border: `4px solid ${config.bgColor}` }}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
        
        <AnimatePresence>
          {gameState === "paused" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl z-50"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900/90 p-12 rounded-2xl border-2 border-white/10 shadow-2xl flex flex-col items-center w-full max-w-sm text-center"
              >
                <h1 className="text-4xl mb-8 font-black italic uppercase tracking-tighter">Match Paused</h1>
                <div className="flex flex-col gap-3 w-full">
                  <Button onClick={() => setGameState("playing")} className="btn-primary h-14">
                    RESUME GAME
                  </Button>
                  <Button variant="outline" onClick={resetGame} className="btn-secondary h-14">
                    RESTART MATCH
                  </Button>
                  <Button variant="outline" onClick={onBack} className="btn-secondary h-14 !mb-0">
                    EXIT TO MENU
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {gameState === "gameOver" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl z-50"
            >
              <motion.div 
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="text-center bg-slate-900/95 p-6 rounded-2xl border-2 border-white/10 w-full max-w-[320px] shadow-[0_0_60px_rgba(135,206,235,0.25)] flex flex-col items-center"
              >
                <p className="text-[10px] uppercase text-[#87CEEB] tracking-[0.3em] mb-1 font-black">HURRAYYY!</p>
                <h1 className="text-xl text-white mb-1 font-light italic">CONGRATULATIONS!</h1>
                <h2 className="text-3xl mb-4 font-black tracking-tighter uppercase italic" style={{ color: winner === 0 ? config.p1Color : config.p2Color }}>
                  {winner === 0 ? "P1" : (mode === "ai" ? "CPU" : "P2")} WINS!
                </h2>
                
                <div className="bg-white/5 rounded-xl p-4 mb-5 border border-white/10 w-full">
                  <p className="text-[9px] uppercase text-slate-500 mb-2 font-black tracking-widest">Final Score Card</p>
                  <p className="text-2xl font-black mb-1 italic">SETS: {games[0]} - {games[1]}</p>
                  <div className="text-[10px] text-slate-400 font-bold flex justify-center gap-4 mb-2">
                    {setHistory.map((set, i) => (
                      <span key={i}>SET {i+1}: {set.p1}-{set.p2}</span>
                    ))}
                  </div>
                  <p className="text-[#87CEEB] text-[10px] font-black mt-3 border-t border-white/10 pt-3 tracking-widest uppercase">Time: {formatTime(time)}</p>
                </div>
                
                <div className="flex flex-col gap-2 w-full">
                  <Button onClick={resetGame} className="btn-primary !py-2 !text-sm h-12">
                    REMATCH
                  </Button>
                  <Button variant="outline" onClick={onBack} className="btn-secondary !mb-0 !py-2 !text-sm h-12">
                    MAIN MENU
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style>{`
        .real-scoreboard {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.85);
          border: 2px solid rgba(255, 255, 255, 0.15);
          padding: 10px 25px;
          border-radius: 15px;
          gap: 20px;
          margin-bottom: 20px;
        }
        .active-set {
          font-size: 1.5rem;
          font-weight: 800;
        }
        .btn-primary {
          background: white !important;
          color: black !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          border-radius: 12px !important;
          transition: all 0.3s ease !important;
        }
        .btn-primary:hover {
          background: #87CEEB !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 5px 15px rgba(135, 206, 235, 0.3) !important;
        }
        .btn-secondary {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 2px solid rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          font-weight: 800 !important;
          text-transform: uppercase !important;
          border-radius: 12px !important;
          transition: all 0.3s ease !important;
          margin-bottom: 1rem;
        }
        .btn-secondary:hover {
          background: #87CEEB !important;
          color: black !important;
          border-color: #87CEEB !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 5px 15px rgba(135, 206, 235, 0.3) !important;
        }
      `}</style>
    </div>
  );
}


