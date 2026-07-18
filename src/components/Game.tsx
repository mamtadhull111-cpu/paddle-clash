import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trophy, Pause, Play, LogOut, RotateCcw, Clock } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { GameMode, GameConfig } from "../App";
import TennisScene from "./TennisScene";
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

const VIRTUAL_WIDTH = 950;
const VIRTUAL_HEIGHT = 475;

export default function Game({ mode, config, onBack }: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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

  const PADDLE_H = 80;
  const PADDLE_W = 12;
  const POINTS_TO_WIN_SET = config.difficulty === "easy" ? 7 : config.difficulty === "medium" ? 9 : 11;

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
  
  // Advanced Shot State
  const [activeShot, setActiveShot] = useState<"flat" | "topspin" | "slice" | "lob" | "drop" | "serve">("flat");
  const activeShotRef = useRef<"flat" | "topspin" | "slice" | "lob" | "drop" | "serve">("flat");
  
  const changeActiveShot = (shot: typeof activeShot) => {
    setActiveShot(shot);
    activeShotRef.current = shot;
  };

  const [flashMessage, setFlashMessage] = useState("");
  const flashTimeoutRef = useRef<number | null>(null);
  
  const showFlashMessage = (msg: string) => {
    setFlashMessage(msg);
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashMessage("");
    }, 1500);
  };

  const [servePower, setServePower] = useState(50);

  // Game state refs for physics
  const ballRef = useRef({ 
    x: 475, y: 237.5, 
    dx: 0, dy: 0, 
    speed: 7, 
    radius: 7,
    zHeight: 0,
    vHeight: 0,
    topspin: 0, // positive = topspin, negative = backspin
    sidespin: 0, // lateral curve
    lastHitBy: 0, // 0 = Player 1, 1 = Player 2
    bounces: 0, // bounce count on current side
    inServeState: true,
    servingPlayer: 0, // 0 = Player 1, 1 = Player 2
    servePower: 50,
    servePowerDir: 1,
    serveAngle: 0, // aiming direction
    serveAimPoints: [] as { x: number; y: number; z: number }[]
  });
  
  const paddle1Y = useRef(VIRTUAL_HEIGHT / 2 - PADDLE_H / 2);
  const paddle2Y = useRef(VIRTUAL_HEIGHT / 2 - PADDLE_H / 2);
  const keysPressed = useRef<Set<string>>(new Set());
  const aiServeTicks = useRef(0);

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

  // Serve trigger handler
  const triggerServe = () => {
    const ball = ballRef.current;
    if (!ball.inServeState) return;
    
    // Choose base speed multiplier by difficulty
    let speedMultiplier = 0.65;
    if (config.difficulty === "easy") speedMultiplier = 0.45;
    if (config.difficulty === "hard") speedMultiplier = 0.95;
    const baseSpeed = (VIRTUAL_WIDTH / 100) * speedMultiplier;
    
    // Power factor multiplier
    const powerFactor = 0.7 + (ball.servePower / 100) * 0.55;
    
    if (ball.servingPlayer === 0) {
      ball.inServeState = false;
      ball.bounces = 0;
      ball.lastHitBy = 0;
      ball.dx = baseSpeed * powerFactor * Math.cos(ball.serveAngle);
      ball.dy = baseSpeed * powerFactor * Math.sin(ball.serveAngle) * 0.7;
      
      const shot = activeShotRef.current;
      if (shot === "flat") {
        ball.vHeight = 2.4; ball.topspin = 0; ball.sidespin = 0;
      } else if (shot === "topspin") {
        ball.vHeight = 4.2; ball.topspin = 14; ball.sidespin = 0;
      } else if (shot === "slice") {
        ball.vHeight = 2.8; ball.topspin = -8; ball.sidespin = 5;
      } else if (shot === "lob") {
        ball.vHeight = 5.5; ball.topspin = -2; ball.sidespin = 0;
      } else if (shot === "drop") {
        ball.vHeight = 2.2; ball.topspin = -6; ball.sidespin = 0;
      }
      
      playSound(600);
      showFlashMessage("SERVE ACTIVE!");
    } else if (ball.servingPlayer === 1 && mode === "pvp") {
      // Human Player 2 Serve
      ball.inServeState = false;
      ball.bounces = 0;
      ball.lastHitBy = 1;
      ball.dx = -baseSpeed * powerFactor * Math.cos(ball.serveAngle);
      ball.dy = baseSpeed * powerFactor * Math.sin(ball.serveAngle) * 0.7;
      ball.vHeight = 2.4; ball.topspin = 0; ball.sidespin = 0;
      
      playSound(600);
      showFlashMessage("SERVE ACTIVE!");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        if (gameState !== "gameOver") {
          setGameState(prev => prev === "paused" ? "playing" : "paused");
        }
      }
      
      const lowerKey = e.key.toLowerCase();
      if (lowerKey === "f") {
        changeActiveShot("flat");
      } else if (lowerKey === "t") {
        changeActiveShot("topspin");
      } else if (lowerKey === "c") {
        changeActiveShot("slice");
      } else if (lowerKey === "l") {
        changeActiveShot("lob");
      } else if (lowerKey === "d") {
        changeActiveShot("drop");
      }
      
      if (e.key === " " || e.key === "Enter") {
        triggerServe();
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

  const resetBall = (width: number, height: number, nextServer?: number) => {
    const ball = ballRef.current;
    ball.zHeight = 1.8;
    ball.vHeight = 0;
    ball.topspin = 0;
    ball.sidespin = 0;
    ball.bounces = 0;
    ball.inServeState = true;
    
    const totalPoints = points[0] + points[1];
    const server = nextServer !== undefined ? nextServer : (Math.floor(totalPoints / 2) % 2 === 0 ? 0 : 1);
    ball.servingPlayer = server;
    
    ball.servePower = 50;
    ball.servePowerDir = 1;
    ball.serveAngle = 0;
    ball.serveAimPoints = [];
    
    if (server === 0) {
      ball.x = 130 + PADDLE_W + 15;
      ball.y = paddle1Y.current + PADDLE_H / 2;
      ball.lastHitBy = 0;
    } else {
      ball.x = 820 - 15;
      ball.y = paddle2Y.current + PADDLE_H / 2;
      ball.lastHitBy = 1;
    }
    
    ball.dx = 0;
    ball.dy = 0;
  };

  useEffect(() => {
    const container = containerRef.current;
    let animationFrameId: number;

    const initPositions = () => {
      paddle1Y.current = VIRTUAL_HEIGHT / 2 - PADDLE_H / 2;
      paddle2Y.current = VIRTUAL_HEIGHT / 2 - PADDLE_H / 2;
      resetBall(VIRTUAL_WIDTH, VIRTUAL_HEIGHT);
    };

    initPositions();

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const scaleX = VIRTUAL_WIDTH / rect.width;
      const scaleY = VIRTUAL_HEIGHT / rect.height;

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        // If in serve state, let touch tap target aim point and trigger serve!
        if (ballRef.current.inServeState && ballRef.current.servingPlayer === 0) {
          if (touchX > VIRTUAL_WIDTH / 2) {
            const dy = touchY - ballRef.current.y;
            const dx = touchX - ballRef.current.x;
            ballRef.current.serveAngle = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, dx)));
            triggerServe();
            return;
          }
        }

        if (touchX < VIRTUAL_WIDTH / 2) {
          paddle1Y.current = Math.max(0, Math.min(VIRTUAL_HEIGHT - PADDLE_H, touchY - PADDLE_H / 2));
        } else {
          if (mode === "pvp") {
            paddle2Y.current = Math.max(0, Math.min(VIRTUAL_HEIGHT - PADDLE_H, touchY - PADDLE_H / 2));
          }
        }
      }
    };

    if (container) {
      container.addEventListener("touchstart", handleTouch, { passive: false });
      container.addEventListener("touchmove", handleTouch, { passive: false });
    }

    // Main physics frame update
    const update = () => {
      if (gameState === "paused" || gameState === "gameOver") return;

      const ball = ballRef.current;
      const surface = config.courtSurface || "hard";
      const paddleSpeed = 8;

      // Player 1 movement keys
      if (keysPressed.current.has("w") || keysPressed.current.has("W")) {
        paddle1Y.current = Math.max(0, paddle1Y.current - paddleSpeed);
        if (ball.inServeState && ball.servingPlayer === 0) {
          ball.serveAngle = Math.max(-0.4, ball.serveAngle - 0.015);
        }
      }
      if (keysPressed.current.has("s") || keysPressed.current.has("S")) {
        paddle1Y.current = Math.min(VIRTUAL_HEIGHT - PADDLE_H, paddle1Y.current + paddleSpeed);
        if (ball.inServeState && ball.servingPlayer === 0) {
          ball.serveAngle = Math.min(0.4, ball.serveAngle + 0.015);
        }
      }

      // Player 2 movement keys
      if (mode === "pvp") {
        if (keysPressed.current.has("ArrowUp")) {
          paddle2Y.current = Math.max(0, paddle2Y.current - paddleSpeed);
          if (ball.inServeState && ball.servingPlayer === 1) {
            ball.serveAngle = Math.max(-0.4, ball.serveAngle - 0.015);
          }
        }
        if (keysPressed.current.has("ArrowDown")) {
          paddle2Y.current = Math.min(VIRTUAL_HEIGHT - PADDLE_H, paddle2Y.current + paddleSpeed);
          if (ball.inServeState && ball.servingPlayer === 1) {
            ball.serveAngle = Math.min(0.4, ball.serveAngle + 0.015);
          }
        }
      } else {
        // AI Logic: Smart anticipation and tracking
        let aiSpeed = 6.5;
        if (config.difficulty === "easy") aiSpeed = 4.5;
        if (config.difficulty === "hard") aiSpeed = 9.5;

        if (!ball.inServeState && ball.dx > 0) {
          const targetY = ball.y - PADDLE_H / 2;
          const dist = targetY - paddle2Y.current;
          if (Math.abs(dist) > 5) {
            paddle2Y.current += Math.sign(dist) * aiSpeed;
          }
        }
        paddle2Y.current = Math.max(0, Math.min(VIRTUAL_HEIGHT - PADDLE_H, paddle2Y.current));
      }

      // Handle Serve State Updates
      if (ball.inServeState) {
        // Oscillator for serve power
        ball.servePower += ball.servePowerDir * 1.8;
        if (ball.servePower >= 100) { ball.servePower = 100; ball.servePowerDir = -1; }
        if (ball.servePower <= 20) { ball.servePower = 20; ball.servePowerDir = 1; }
        setServePower(Math.round(ball.servePower));

        // Follow active paddle position beautifully before hitting
        if (ball.servingPlayer === 0) {
          ball.y = paddle1Y.current + PADDLE_H / 2;
        } else {
          ball.y = paddle2Y.current + PADDLE_H / 2;
        }

        // Calculate Serve Visual Prediction Arc (only for User P1)
        if (ball.servingPlayer === 0) {
          const arcPoints: { x: number; y: number; z: number }[] = [];
          let simX = ball.x;
          let simY = ball.y;
          let simZ = ball.zHeight;
          
          let speedMultiplier = 0.65;
          if (config.difficulty === "easy") speedMultiplier = 0.45;
          if (config.difficulty === "hard") speedMultiplier = 0.95;
          const baseSpeed = (VIRTUAL_WIDTH / 100) * speedMultiplier;
          
          const powerFactor = 0.7 + (ball.servePower / 100) * 0.55;
          let simDx = baseSpeed * powerFactor * Math.cos(ball.serveAngle);
          let simDy = baseSpeed * powerFactor * Math.sin(ball.serveAngle) * 0.7;
          
          const activeS = activeShotRef.current;
          let simVHeight = 2.4;
          let simTopspin = 0;
          if (activeS === "topspin") { simVHeight = 4.2; simTopspin = 14; }
          else if (activeS === "slice") { simVHeight = 2.8; simTopspin = -8; }
          else if (activeS === "lob") { simVHeight = 5.5; simTopspin = -2; }
          else if (activeS === "drop") { simVHeight = 2.2; simTopspin = -6; }

          const simGravity = 0.08;
          const simDecay = 0.005;

          for (let i = 0; i < 40; i++) {
            simX += simDx;
            simY += simDy;
            simZ += simVHeight;
            
            const dynGravity = simGravity + simTopspin * 0.004;
            simVHeight -= dynGravity;

            simDx *= (1 - simDecay);
            simDy *= (1 - simDecay);

            // Mapping to 3D dimensions
            const courtWidth = 30;
            const courtLength = 16;
            const x3d = (simX / VIRTUAL_WIDTH) * courtWidth - courtWidth / 2;
            const z3d = (simY / VIRTUAL_HEIGHT) * courtLength - courtLength / 2;
            const y3d = simZ;

            arcPoints.push({ x: x3d, y: y3d, z: z3d });
            if (simZ <= 0) break;
          }
          ball.serveAimPoints = arcPoints;
        }

        // AI automated serving routine
        if (mode === "ai" && ball.servingPlayer === 1) {
          aiServeTicks.current++;
          if (aiServeTicks.current === 1) {
            ball.serveAngle = (Math.random() - 0.5) * 0.4;
            ball.servePower = 60 + Math.random() * 30;
          }
          if (aiServeTicks.current >= 60) {
            aiServeTicks.current = 0;
            ball.inServeState = false;
            ball.bounces = 0;
            ball.lastHitBy = 1;

            let speedMultiplier = 0.65;
            if (config.difficulty === "easy") speedMultiplier = 0.45;
            if (config.difficulty === "hard") speedMultiplier = 0.95;
            const baseSpeed = (VIRTUAL_WIDTH / 100) * speedMultiplier;

            const powerFactor = 0.7 + (ball.servePower / 100) * 0.55;
            ball.dx = -baseSpeed * powerFactor * Math.cos(ball.serveAngle);
            ball.dy = baseSpeed * powerFactor * Math.sin(ball.serveAngle) * 0.7;
            
            // Random AI serve spin style
            const aiShotRand = Math.random();
            if (aiShotRand < 0.5) {
              ball.vHeight = 2.4; ball.topspin = 0; ball.sidespin = 0;
            } else if (aiShotRand < 0.8) {
              ball.vHeight = 4.2; ball.topspin = 12; ball.sidespin = 0;
            } else {
              ball.vHeight = 2.8; ball.topspin = -8; ball.sidespin = -4;
            }
            playSound(600);
            showFlashMessage("CPU SERVED!");
          }
        }
        return;
      }

      // Live Play Dynamics & Physics
      let gravityVal = 0.08;
      let airDecay = 0.006;
      let restitution = 0.75;
      let speedRetention = 0.72;
      let spinKick = 1.0;

      if (surface === "clay") {
        airDecay = 0.007;
        restitution = 0.82;
        speedRetention = 0.58;
        spinKick = 1.4;
      } else if (surface === "grass") {
        airDecay = 0.005;
        restitution = 0.62;
        speedRetention = 0.82;
        spinKick = 0.7;
      }

      // Air resistance and spin curve logic
      const spinForce = ball.topspin * 0.004;
      const dynamicGravity = gravityVal + spinForce;
      
      // Magnus effect curves sideways
      ball.dy += ball.sidespin * 0.03 * Math.sign(ball.dx);

      ball.dx *= (1 - airDecay);
      ball.dy *= (1 - airDecay);

      const prevX = ball.x;
      const prevY = ball.y;

      ball.x += ball.dx;
      ball.y += ball.dy;
      ball.zHeight += ball.vHeight;
      ball.vHeight -= dynamicGravity;

      // Continuous Net Collision Detection (net at x = 475)
      if ((prevX < 475 && ball.x >= 475) || (prevX > 475 && ball.x <= 475)) {
        const t = (475 - prevX) / (ball.x - prevX);
        const netHitY = prevY + t * (ball.y - prevY);
        // Is the ball hitting the net height (< 1.55 units)?
        if (netHitY >= 50 && netHitY <= 425 && ball.zHeight < 1.55) {
          ball.dx = -ball.dx * 0.15;
          ball.dy *= 0.4;
          ball.vHeight = 1.0;
          ball.topspin = 0;
          ball.sidespin = 0;
          playSound(150);
          showFlashMessage("NET TOUCH!");
        }
      }

      // Floor Bounces
      if (ball.zHeight <= 0) {
        ball.zHeight = 0;

        const isWithinSidelines = ball.y >= 50 && ball.y <= 425;
        const isWithinLeftCourt = ball.x >= 100 && ball.x <= 475;
        const isWithinRightCourt = ball.x >= 475 && ball.x <= 850;
        const inCourt = isWithinSidelines && (isWithinLeftCourt || isWithinRightCourt);

        let correctSide = false;
        if (ball.lastHitBy === 0) {
          correctSide = isWithinRightCourt;
        } else {
          correctSide = isWithinLeftCourt;
        }

        if (inCourt && correctSide) {
          ball.bounces++;
          playSound(300);

          // Bounce kinematics
          ball.vHeight = -ball.vHeight * restitution;
          ball.dx *= speedRetention;
          
          // Spin responses
          ball.dx += ball.topspin * spinKick * 0.12;
          ball.dy += ball.sidespin * spinKick * 0.18;

          ball.topspin *= 0.4;
          ball.sidespin *= 0.4;

          if (ball.bounces >= 2) {
            const pointWinner = ball.lastHitBy;
            handleScoreLocal(pointWinner);
            showFlashMessage(pointWinner === 0 ? "P1 SCORES! (DOUBLE BOUNCE)" : "OPPONENT SCORES! (DOUBLE BOUNCE)");
          }
        } else {
          // Out of bounds or wrong side
          const pointWinner = ball.lastHitBy === 0 ? 1 : 0;
          handleScoreLocal(pointWinner);
          showFlashMessage(inCourt ? "FAULT! WRONG SIDE" : "OUT OF BOUNDS!");
        }
      }

      // Continuous Collision Detection (CCD) for Paddles
      const p1X = 130;
      const p2X = 820;

      // Paddle 1 (Left Player)
      if (ball.dx < 0 && prevX > p1X && ball.x <= p1X + PADDLE_W) {
        const t = (p1X + PADDLE_W - prevX) / (ball.x - prevX);
        const hitY = prevY + t * (ball.y - prevY);
        const hitZ = ball.zHeight;

        if (hitY >= paddle1Y.current && hitY <= paddle1Y.current + PADDLE_H && hitZ < 3.2) {
          let speedMultiplier = 0.65;
          if (config.difficulty === "easy") speedMultiplier = 0.45;
          if (config.difficulty === "hard") speedMultiplier = 0.95;
          const baseSpeed = (VIRTUAL_WIDTH / 100) * speedMultiplier;

          const shot = activeShotRef.current;
          let speedFactor = 1.0;
          let topspinVal = 0;
          let sidespinVal = 0;
          let launchVHeight = 2.0;

          if (shot === "flat") {
            speedFactor = 1.3; topspinVal = 0; sidespinVal = 0; launchVHeight = 1.8;
          } else if (shot === "topspin") {
            speedFactor = 1.05; topspinVal = 14; sidespinVal = 0; launchVHeight = 4.2;
          } else if (shot === "slice") {
            speedFactor = 0.85; topspinVal = -12; sidespinVal = 5; launchVHeight = 2.4;
          } else if (shot === "lob") {
            speedFactor = 0.6; topspinVal = -2; sidespinVal = 0; launchVHeight = 11.5;
          } else if (shot === "drop") {
            speedFactor = 0.45; topspinVal = -10; sidespinVal = -2; launchVHeight = 3.2;
          }

          const relativeIntersectY = (hitY - (paddle1Y.current + PADDLE_H / 2)) / (PADDLE_H / 2);
          
          // Additional spin if player is moving at hit
          const userMovingUp = keysPressed.current.has("w") || keysPressed.current.has("W");
          const userMovingDown = keysPressed.current.has("s") || keysPressed.current.has("S");
          if (userMovingUp) { topspinVal += 4; sidespinVal -= 2; }
          if (userMovingDown) { topspinVal -= 4; sidespinVal += 2; }

          ball.dy = relativeIntersectY * 5.5 + (userMovingUp ? -1.5 : (userMovingDown ? 1.5 : 0));
          ball.dx = baseSpeed * speedFactor;
          ball.vHeight = launchVHeight;
          ball.topspin = topspinVal;
          ball.sidespin = sidespinVal;
          ball.bounces = 0;
          ball.lastHitBy = 0;
          ball.x = p1X + PADDLE_W + 5;
          playSound(600);
          showFlashMessage(shot.toUpperCase() + " SHOT!");
        }
      }

      // Paddle 2 (Right Player / AI)
      if (ball.dx > 0 && prevX < p2X && ball.x >= p2X) {
        const t = (p2X - prevX) / (ball.x - prevX);
        const hitY = prevY + t * (ball.y - prevY);
        const hitZ = ball.zHeight;

        if (hitY >= paddle2Y.current && hitY <= paddle2Y.current + PADDLE_H && hitZ < 3.2) {
          let speedMultiplier = 0.65;
          if (config.difficulty === "easy") speedMultiplier = 0.45;
          if (config.difficulty === "hard") speedMultiplier = 0.95;
          const baseSpeed = (VIRTUAL_WIDTH / 100) * speedMultiplier;

          let aiShot: "flat" | "topspin" | "slice" | "lob" | "drop" = "flat";
          
          if (mode === "ai") {
            // Intelligent AI shot choice based on user position
            const userDistToNet = paddle1Y.current;
            if (userDistToNet < 100 && Math.random() < 0.6) {
              aiShot = "lob";
            } else if (userDistToNet > 300 && Math.random() < 0.45) {
              aiShot = "drop";
            } else {
              const randVal = Math.random();
              aiShot = randVal < 0.4 ? "flat" : (randVal < 0.8 ? "topspin" : "slice");
            }
          }

          let speedFactor = 1.0;
          let topspinVal = 0;
          let sidespinVal = 0;
          let launchVHeight = 2.0;

          if (aiShot === "flat") {
            speedFactor = 1.3; topspinVal = 0; sidespinVal = 0; launchVHeight = 1.8;
          } else if (aiShot === "topspin") {
            speedFactor = 1.05; topspinVal = 14; sidespinVal = 0; launchVHeight = 4.2;
          } else if (aiShot === "slice") {
            speedFactor = 0.85; topspinVal = -12; sidespinVal = -5; launchVHeight = 2.4;
          } else if (aiShot === "lob") {
            speedFactor = 0.6; topspinVal = -2; sidespinVal = 0; launchVHeight = 11.5;
          } else if (aiShot === "drop") {
            speedFactor = 0.45; topspinVal = -10; sidespinVal = 2; launchVHeight = 3.2;
          }

          const relativeIntersectY = (hitY - (paddle2Y.current + PADDLE_H / 2)) / (PADDLE_H / 2);
          ball.dy = relativeIntersectY * 5.5;
          ball.dx = -baseSpeed * speedFactor;
          ball.vHeight = launchVHeight;
          ball.topspin = topspinVal;
          ball.sidespin = sidespinVal;
          ball.bounces = 0;
          ball.lastHitBy = 1;
          ball.x = p2X - 5;
          playSound(600);
          showFlashMessage(mode === "ai" ? `CPU ${aiShot.toUpperCase()}!` : "P2 RETURN!");
        }
      }

      // Check baseline missed score
      if (ball.x < 50 || ball.x > 900) {
        if (ball.bounces === 0) {
          const pointWinner = ball.lastHitBy === 0 ? 1 : 0;
          handleScoreLocal(pointWinner);
          showFlashMessage("OUT OF BOUNDS!");
        } else {
          const pointWinner = ball.lastHitBy;
          handleScoreLocal(pointWinner);
          showFlashMessage("POINT SECURED!");
        }
      }
    };

    const handleScoreLocal = (scoringPlayer: number) => {
      playSound(200);
      handleScore(scoringPlayer);
      const nextServer = scoringPlayer === 0 ? 1 : 0;
      resetBall(VIRTUAL_WIDTH, VIRTUAL_HEIGHT, nextServer);
    };

    const loop = () => {
      update();
      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (container) {
        container.removeEventListener("touchstart", handleTouch);
        container.removeEventListener("touchmove", handleTouch);
      }
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
        ref={containerRef}
        className="relative w-full max-w-[950px] aspect-[4/3] md:aspect-[2/1] bg-slate-900/30 rounded-[20px] overflow-hidden shadow-2xl transition-all duration-500"
        style={{ border: `4px solid ${config.bgColor}` }}
      >
        <TennisScene
          ballRef={ballRef}
          paddle1Y={paddle1Y}
          paddle2Y={paddle2Y}
          virtualWidth={VIRTUAL_WIDTH}
          virtualHeight={VIRTUAL_HEIGHT}
          config={config}
          mode={mode}
          gameState={gameState}
          PADDLE_H={PADDLE_H}
          PADDLE_W={PADDLE_W}
        />

        {/* Serve Power Charging HUD Indicator */}
        <AnimatePresence>
          {ballRef.current.inServeState && ballRef.current.servingPlayer === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 10, x: "-50%" }}
              className="absolute top-4 left-1/2 flex flex-col items-center bg-black/85 backdrop-blur-md px-6 py-2.5 rounded-2xl border border-cyan-500/30 z-30 gap-1.5 min-w-[260px] shadow-lg"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[9px] uppercase font-black text-cyan-400 tracking-wider">Toss & Charge Power</span>
                <span className="text-[10px] font-mono text-cyan-300 font-bold">{servePower}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-white/5 p-[1px]">
                <div 
                  className="h-full rounded-full transition-all duration-75"
                  style={{ 
                    width: `${servePower}%`,
                    background: `linear-gradient(90deg, #22d3ee ${servePower * 0.7}%, #ef4444 100%)`
                  }}
                />
              </div>
              <p className="text-[8px] text-slate-400 uppercase font-black tracking-widest">Press SPACE / Enter or Click Court to Strike</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tactical Shot Selection HUD Bar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center bg-black/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 gap-1.5 z-30 max-w-[90%] overflow-x-auto scrollbar-none shadow-lg">
          <span className="text-[9px] uppercase font-black text-slate-500 mr-1 hidden sm:inline">Shot:</span>
          {[
            { id: "flat", label: "Flat", shortcut: "F", color: "border-cyan-500 text-cyan-400 bg-cyan-950/20" },
            { id: "topspin", label: "Topspin", shortcut: "T", color: "border-emerald-500 text-emerald-400 bg-emerald-950/20" },
            { id: "slice", label: "Slice", shortcut: "C", color: "border-purple-500 text-purple-400 bg-purple-950/20" },
            { id: "lob", label: "Lob", shortcut: "L", color: "border-amber-500 text-amber-400 bg-amber-950/20" },
            { id: "drop", label: "Drop", shortcut: "D", color: "border-rose-500 text-rose-400 bg-rose-950/20" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => changeActiveShot(s.id as any)}
              className={cn(
                "px-2.5 py-1 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-1 min-w-[62px] justify-center",
                activeShot === s.id
                  ? `${s.color} scale-105 shadow-[0_0_10px_rgba(255,255,255,0.1)]`
                  : "border-transparent text-slate-400 hover:text-white"
              )}
            >
              <span>{s.label}</span>
              <kbd className="hidden md:inline px-1 bg-white/10 rounded text-[8px] text-white font-mono">{s.shortcut}</kbd>
            </button>
          ))}
        </div>

        {/* Live Game Event Alerts */}
        <AnimatePresence>
          {flashMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: -10, x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, scale: 0.8, y: 10, x: "-50%" }}
              className="absolute top-1/4 left-1/2 z-30 bg-black/85 backdrop-blur-md px-5 py-2.5 rounded-xl border border-white/10 shadow-xl pointer-events-none"
            >
              <h3 className="text-sm md:text-base font-black italic uppercase tracking-wider text-center text-[#87CEEB]">
                {flashMessage}
              </h3>
            </motion.div>
          )}
        </AnimatePresence>
        
        <AnimatePresence>
          {gameState === "paused" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-xl z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-slate-900/90 p-4 md:p-12 rounded-2xl border-2 border-white/10 shadow-2xl flex flex-col items-center w-full max-w-xs md:max-w-sm text-center"
              >
                <h1 className="text-2xl md:text-4xl mb-4 md:mb-8 font-black italic uppercase tracking-tighter">Match Paused</h1>
                <div className="flex flex-col gap-2 md:gap-3 w-full">
                  <Button onClick={() => setGameState("playing")} className="btn-primary h-10 md:h-14 text-sm md:text-base">
                    RESUME GAME
                  </Button>
                  <Button variant="outline" onClick={resetGame} className="btn-secondary h-10 md:h-14 text-sm md:text-base">
                    RESTART MATCH
                  </Button>
                  <Button variant="outline" onClick={onBack} className="btn-secondary h-10 md:h-14 text-sm md:text-base !mb-0">
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
              className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-xl z-50 p-4"
            >
              <motion.div 
                initial={{ scale: 0.5, rotate: -10 }}
                animate={{ scale: 1, rotate: 0 }}
                className="text-center bg-slate-900/95 p-4 md:p-6 rounded-2xl border-2 border-white/10 w-full max-w-[280px] md:max-w-[320px] shadow-[0_0_60px_rgba(135,206,235,0.25)] flex flex-col items-center"
              >
                <p className="text-[8px] md:text-[10px] uppercase text-[#87CEEB] tracking-[0.3em] mb-0.5 md:mb-1 font-black">HURRAYYY!</p>
                <h1 className="text-base md:text-xl text-white mb-0.5 md:mb-1 font-light italic">CONGRATULATIONS!</h1>
                <h2 className="text-2xl md:text-3xl mb-2 md:mb-4 font-black tracking-tighter uppercase italic" style={{ color: winner === 0 ? config.p1Color : config.p2Color }}>
                  {winner === 0 ? "P1" : (mode === "ai" ? "CPU" : "P2")} WINS!
                </h2>
                
                <div className="bg-white/5 rounded-xl p-3 md:p-4 mb-3 md:mb-5 border border-white/10 w-full">
                  <p className="text-[8px] md:text-[9px] uppercase text-slate-500 mb-1 md:mb-2 font-black tracking-widest">Final Score Card</p>
                  <p className="text-xl md:text-2xl font-black mb-0.5 md:mb-1 italic">SETS: {games[0]} - {games[1]}</p>
                  <div className="text-[9px] md:text-[10px] text-slate-400 font-bold flex justify-center gap-3 md:gap-4 mb-1 md:mb-2">
                    {setHistory.map((set, i) => (
                      <span key={i}>SET {i+1}: {set.p1}-{set.p2}</span>
                    ))}
                  </div>
                  <p className="text-[#87CEEB] text-[9px] md:text-[10px] font-black mt-2 md:mt-3 border-t border-white/10 pt-2 md:pt-3 tracking-widest uppercase">Time: {formatTime(time)}</p>
                </div>
                
                <div className="flex flex-col gap-1.5 md:gap-2 w-full">
                  <Button onClick={resetGame} className="btn-primary !py-1 md:!py-2 !text-xs md:!text-sm h-10 md:h-12">
                    REMATCH
                  </Button>
                  <Button variant="outline" onClick={onBack} className="btn-secondary !mb-0 !py-1 md:!py-2 !text-xs md:!text-sm h-10 md:h-12">
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
        @media (max-width: 640px) {
          .real-scoreboard {
            padding: 6px 14px;
            gap: 10px;
            margin-bottom: 10px;
            border-radius: 10px;
          }
          .active-set {
            font-size: 1rem !important;
          }
          .real-scoreboard span {
            font-size: 8px !important;
          }
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


