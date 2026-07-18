import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GameConfig, GameMode } from "../App";

interface TennisSceneProps {
  ballRef: React.MutableRefObject<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    speed: number;
    radius: number;
  }>;
  paddle1Y: React.MutableRefObject<number>;
  paddle2Y: React.MutableRefObject<number>;
  virtualWidth: number;
  virtualHeight: number;
  config: GameConfig;
  mode: GameMode;
  gameState: "playing" | "paused" | "gameOver";
  PADDLE_H: number;
  PADDLE_W: number;
}

// ==========================================
// 1. DYNAMIC ASSET BUILDERS & FACTORIES
// ==========================================

// Creates a realistic furry neon-yellow felt texture for the tennis ball with curved seams
function createBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // base felt neon color
    ctx.fillStyle = "#ccff00";
    ctx.fillRect(0, 0, 256, 256);

    // felt texture grain noise
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const size = Math.random() * 1.5;
      ctx.fillStyle = Math.random() > 0.5 ? "#b1db00" : "#d7ff2e";
      ctx.fillRect(x, y, size, size);
    }

    // draw seam lines (the classic curved seam of a tennis ball)
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.shadowBlur = 4;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    
    ctx.beginPath();
    ctx.arc(0, 128, 90, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(256, 128, 90, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// Creates an ultra-sharp transparent grid texture for the tennis net
function createNetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);

    // Dark grid patterns
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2.5;
    
    // Draw horizontal lines
    for (let y = 0; y < 128; y += 16) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
    // Draw vertical lines
    for (let x = 0; x < 128; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(24, 4); // tiles perfectly across the plane
  return texture;
}

// Creates a high-res acrylic/hard-court material with noise grain and perfect markings
function createCourtTexture(innerColor: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Fill outer run-off area with deep classic green
    ctx.fillStyle = "#275e3a";
    ctx.fillRect(0, 0, 2048, 1024);

    const marginX = 124;
    const marginY = 112;
    const cw = 2048 - 2 * marginX; // 1800
    const cl = 1024 - 2 * marginY; // 800

    // Draw inner court base with customized color overlay
    ctx.fillStyle = innerColor;
    ctx.fillRect(marginX, marginY, cw, cl);

    // Apply fine acrylic concrete noise grain
    const imgData = ctx.getImageData(0, 0, 2048, 1024);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i+1] = Math.min(255, Math.max(0, data[i+1] + noise));
      data[i+2] = Math.min(255, Math.max(0, data[i+2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Set line configuration
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 12;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0,0,0,0.2)";

    // Outer Court Boundary
    ctx.strokeRect(marginX, marginY, cw, cl);

    // Singles sideline offsets (4.5 feet alley on each side of 36 feet doubles court)
    const alleyHeight = cl * 0.125;
    
    // Singles sidelines
    ctx.beginPath();
    ctx.moveTo(marginX, marginY + alleyHeight);
    ctx.lineTo(marginX + cw, marginY + alleyHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(marginX, marginY + cl - alleyHeight);
    ctx.lineTo(marginX + cw, marginY + cl - alleyHeight);
    ctx.stroke();

    // Center divider / Net line
    const midX = marginX + cw / 2;
    ctx.beginPath();
    ctx.moveTo(midX, marginY);
    ctx.lineTo(midX, marginY + cl);
    ctx.stroke();

    // Service lines: 21 feet from net (total 39 feet half court) -> 53.8% distance
    const serviceDist = (cw / 2) * 0.538;
    
    // Left service line
    ctx.beginPath();
    ctx.moveTo(midX - serviceDist, marginY + alleyHeight);
    ctx.lineTo(midX - serviceDist, marginY + cl - alleyHeight);
    ctx.stroke();

    // Right service line
    ctx.beginPath();
    ctx.moveTo(midX + serviceDist, marginY + alleyHeight);
    ctx.lineTo(midX + serviceDist, marginY + cl - alleyHeight);
    ctx.stroke();

    // Center service line (divides service courts)
    ctx.beginPath();
    ctx.moveTo(midX - serviceDist, marginY + cl / 2);
    ctx.lineTo(midX + serviceDist, marginY + cl / 2);
    ctx.stroke();

    // Baselines center marks
    const markLength = 30;
    // Left baseline tick
    ctx.beginPath();
    ctx.moveTo(marginX, marginY + cl / 2);
    ctx.lineTo(marginX + markLength, marginY + cl / 2);
    ctx.stroke();
    // Right baseline tick
    ctx.beginPath();
    ctx.moveTo(marginX + cw, marginY + cl / 2);
    ctx.lineTo(marginX + cw - markLength, marginY + cl / 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 16;
  return texture;
}

// Helper to build 3D sponsor boards
function createSponsorCanvas(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0f172a"; // slate-900
    ctx.fillRect(0, 0, 512, 128);
    
    // Dynamic glowing cyan border
    ctx.strokeStyle = "#38bdf8"; // sky-400
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, 512, 128);

    // Text details
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 46px 'Space Grotesk', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

// ==========================================
// 2. HUMANOID PLAYER CLASS DEFINITION
// ==========================================
class HumanoidPlayer {
  group: THREE.Group;
  racketGroup: THREE.Group;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  rightLeg: THREE.Group;
  leftLeg: THREE.Group;
  head: THREE.Mesh;
  torso: THREE.Mesh;

  private lastZ = 0;
  private isP1: boolean;

  constructor(color: string, isP1: boolean) {
    this.isP1 = isP1;
    this.group = new THREE.Group();

    // Material assets
    const shirtMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.5,
      metalness: 0.1,
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xfcc397, // peach-pink realistic skin tone
      roughness: 0.6,
    });

    const shortsMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // slate grey shorts
      roughness: 0.8,
    });

    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
    });

    // Torso (Shirt)
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.22, 1.1, 16);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 1.15;
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.group.add(this.torso);

    // Shorts bottom
    const shortsGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.28, 16);
    const shorts = new THREE.Mesh(shortsGeo, shortsMat);
    shorts.position.y = -0.6;
    shorts.castShadow = true;
    this.torso.add(shorts);

    // Head
    const headGeo = new THREE.SphereGeometry(0.23, 16, 16);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 0.8;
    this.head.castShadow = true;
    this.torso.add(this.head);

    // Sports cap
    const capGeo = new THREE.SphereGeometry(0.24, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.02;
    cap.rotation.x = -0.08;
    cap.castShadow = true;
    this.head.add(cap);

    // Cap visor brim
    const brimGeo = new THREE.BoxGeometry(0.28, 0.02, 0.28);
    const brim = new THREE.Mesh(brimGeo, capMat);
    brim.position.set(0, 0.04, isP1 ? 0.22 : -0.22);
    brim.castShadow = true;
    this.head.add(brim);

    // Sport sunglasses
    const glassesGeo = new THREE.BoxGeometry(0.36, 0.07, 0.08);
    const glassesMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 0.04, isP1 ? 0.2 : -0.2);
    this.head.add(glasses);

    // Left Arm
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.4, 0.4, 0);
    const upperLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 8), shirtMat);
    upperLeft.position.y = -0.22;
    upperLeft.castShadow = true;
    this.leftArm.add(upperLeft);
    
    const lowerLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), skinMat);
    lowerLeft.position.y = -0.7;
    lowerLeft.castShadow = true;
    this.leftArm.add(lowerLeft);
    this.torso.add(this.leftArm);

    // Right Arm (Holding racket)
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.4, 0.4, 0);
    const upperRight = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.55, 8), shirtMat);
    upperRight.position.y = -0.22;
    upperRight.castShadow = true;
    this.rightArm.add(upperRight);

    const lowerRight = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.5, 8), skinMat);
    lowerRight.position.y = -0.7;
    lowerRight.castShadow = true;
    this.rightArm.add(lowerRight);
    this.torso.add(this.rightArm);

    // Racket Group attached to hand
    this.racketGroup = new THREE.Group();
    this.racketGroup.position.set(0, -0.9, 0);
    this.racketGroup.rotation.x = Math.PI / 2;
    lowerRight.add(this.racketGroup);

    // 3D Tennis Racket assets
    const racketFrameColor = new THREE.Color(color).multiplyScalar(1.2);
    const racketMat = new THREE.MeshStandardMaterial({
      color: racketFrameColor,
      metalness: 0.7,
      roughness: 0.2,
    });

    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.55, 8), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 }));
    handle.position.y = 0.2;
    handle.castShadow = true;
    this.racketGroup.add(handle);

    const frameGeo = new THREE.TorusGeometry(0.24, 0.022, 8, 32);
    const frame = new THREE.Mesh(frameGeo, racketMat);
    frame.scale.set(0.76, 1.1, 1);
    frame.position.y = 0.68;
    frame.rotation.x = Math.PI / 2;
    frame.castShadow = true;
    this.racketGroup.add(frame);

    const n1 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), racketMat);
    n1.position.set(-0.05, 0.44, 0);
    n1.rotation.z = -0.16;
    this.racketGroup.add(n1);

    const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.22, 8), racketMat);
    n2.position.set(0.05, 0.44, 0);
    n2.rotation.z = 0.16;
    this.racketGroup.add(n2);

    const stringsGeo = new THREE.PlaneGeometry(0.33, 0.48);
    const stringsMat = new THREE.MeshBasicMaterial({
      color: 0xf8fafc,
      wireframe: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    const strings = new THREE.Mesh(stringsGeo, stringsMat);
    strings.position.set(0, 0.68, 0);
    this.racketGroup.add(strings);

    // Left Leg
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.16, -0.7, 0);
    const thighL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.45, 8), skinMat);
    thighL.position.y = -0.22;
    thighL.castShadow = true;
    this.leftLeg.add(thighL);

    const calfL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), skinMat);
    calfL.position.y = -0.67;
    calfL.castShadow = true;
    this.leftLeg.add(calfL);

    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.26), shoeMat);
    shoeL.position.set(0, -0.92, isP1 ? 0.04 : -0.04);
    shoeL.castShadow = true;
    this.leftLeg.add(shoeL);
    this.torso.add(this.leftLeg);

    // Right Leg
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.16, -0.7, 0);
    const thighR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.45, 8), skinMat);
    thighR.position.y = -0.22;
    thighR.castShadow = true;
    this.rightLeg.add(thighR);

    const calfR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 8), skinMat);
    calfR.position.y = -0.67;
    calfR.castShadow = true;
    this.rightLeg.add(calfR);

    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.26), shoeMat);
    shoeR.position.set(0, -0.92, isP1 ? 0.04 : -0.04);
    shoeR.castShadow = true;
    this.rightLeg.add(shoeR);
    this.torso.add(this.rightLeg);

    // Apply recursive shadows to player meshes
    this.group.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }
    });
  }

  // Animates player and computes dynamic high-precision racket swinging motions
  update(time: number, currentZ: number, ballX: number, ballZ: number, ballDirX: number) {
    const deltaZ = currentZ - this.lastZ;
    this.lastZ = currentZ;
    const isMoving = Math.abs(deltaZ) > 0.008;

    // Body bobbing/breathing oscillation
    const oscFreq = isMoving ? 16 : 4;
    const oscAmp = isMoving ? 0.08 : 0.03;
    const bodyBob = Math.sin(time * oscFreq) * oscAmp;
    this.torso.position.y = 1.15 + bodyBob;

    if (isMoving) {
      const legSwing = Math.sin(time * 16);
      this.leftLeg.rotation.x = legSwing * 0.55;
      this.rightLeg.rotation.x = -legSwing * 0.55;
      
      this.torso.rotation.z = Math.sin(time * 16) * 0.045;
      this.torso.rotation.x = 0.12; // run lean
    } else {
      // Idle pose
      this.leftLeg.rotation.x = Math.sin(time * 2.2) * 0.06;
      this.rightLeg.rotation.x = -Math.sin(time * 2.2) * 0.06;
      this.torso.rotation.z = 0;
      this.torso.rotation.x = 0;
    }

    // Dynamic Strike Swing System!
    const isBallApproaching = ballDirX < 0;
    const isMyTurn = (this.isP1 && isBallApproaching) || (!this.isP1 && !isBallApproaching);
    const targetX = this.isP1 ? -14.2 : 14.2;
    const ballDistanceX = Math.abs(ballX - targetX);

    if (isMyTurn && ballDistanceX < 6.5) {
      const swingProgress = Math.max(0, Math.min(1, (6.5 - ballDistanceX) / 6.0));
      
      let rotX = 0;
      let rotY = 0;
      let rotZ = 0;

      if (swingProgress < 0.3) {
        // Backswing loading
        const factor = swingProgress / 0.3;
        rotX = -0.6 * factor;
        rotY = this.isP1 ? -0.5 * factor : 0.5 * factor;
        rotZ = -0.3 * factor;
      } else if (swingProgress < 0.75) {
        // Full striking sweep forward
        const factor = (swingProgress - 0.3) / 0.45;
        rotX = -0.6 + 2.1 * factor;
        rotY = this.isP1 ? -0.5 + 1.3 * factor : 0.5 - 1.3 * factor;
        rotZ = -0.3 + 0.6 * factor;
      } else {
        // High finish follow-through
        const factor = (swingProgress - 0.75) / 0.25;
        rotX = 1.5 - 0.25 * factor;
        rotY = this.isP1 ? 0.8 - 0.15 * factor : -0.8 + 0.15 * factor;
        rotZ = 0.3 + 0.1 * factor;
      }

      this.rightArm.rotation.set(rotX, rotY, rotZ);
      this.leftArm.rotation.set(-rotX * 0.3, -rotY * 0.3, 0.1);
    } else {
      // Natural resting/anticipating arm swing pose
      this.rightArm.rotation.set(
        0.25 + Math.sin(time * 2.5) * 0.05,
        this.isP1 ? -0.22 : 0.22,
        -0.12
      );
      this.leftArm.rotation.set(
        -0.25 + Math.sin(time * 2.5) * 0.05,
        this.isP1 ? 0.22 : -0.22,
        0.12
      );
    }
  }
}

// ==========================================
// 3. MAIN TENNISSENE EXPORT COMPONENT
// ==========================================
export default function TennisScene({
  ballRef,
  paddle1Y,
  paddle2Y,
  virtualWidth,
  virtualHeight,
  config,
  mode,
  gameState,
  PADDLE_H,
  PADDLE_W,
}: TennisSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#4382c4"); // high-contrast deep sky blue
    scene.fog = new THREE.FogExp2("#4382c4", 0.015);

    // Create Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    // Dynamic cinematic sports broadcast perspective
    camera.position.set(0, 16, 21);
    camera.lookAt(0, -1, 0);

    // Create Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // OrbitControls for development view tuning
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.08; // restrict below floor view

    // Ambient Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    // High quality directional light to cast crisp and soft realistic shadows
    const dirLight = new THREE.DirectionalLight(0xfffdf2, 1.1); // warm white sunlight
    dirLight.position.set(12, 28, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.bias = -0.0003;
    
    const d = 20;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Subtle helper blue rim skylight
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x4382c4, 0.3);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    // Stadium Concrete Floor Around Court
    const stadiumFloorGeo = new THREE.PlaneGeometry(62, 42);
    const stadiumFloorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // elegant charcoal concrete slate floor
      roughness: 0.95,
      metalness: 0.1,
    });
    const stadiumFloor = new THREE.Mesh(stadiumFloorGeo, stadiumFloorMat);
    stadiumFloor.rotation.x = -Math.PI / 2;
    stadiumFloor.position.y = -0.02;
    stadiumFloor.receiveShadow = true;
    scene.add(stadiumFloor);

    // Core Tennis Court Size mapping (Width 30 units, Length 16 units)
    const courtWidth = 30;
    const courtLength = 16;
    const margin = 2.4;

    const courtTexture = createCourtTexture(config.tableColor);
    const courtGeo = new THREE.PlaneGeometry(courtWidth + margin, courtLength + margin);
    const courtMat = new THREE.MeshStandardMaterial({
      map: courtTexture,
      roughness: 0.85,
      metalness: 0.05,
    });
    const court = new THREE.Mesh(courtGeo, courtMat);
    court.rotation.x = -Math.PI / 2;
    court.receiveShadow = true;
    scene.add(court);

    // 3D Grid Tennis Net
    const netHeight = 1.55;
    const netTexture = createNetTexture();
    const netGeo = new THREE.PlaneGeometry(courtLength, netHeight);
    const netMat = new THREE.MeshStandardMaterial({
      map: netTexture,
      transparent: true,
      alphaTest: 0.2, // crisp grid borders with transparency
      side: THREE.DoubleSide,
      roughness: 0.9,
    });
    const net = new THREE.Mesh(netGeo, netMat);
    net.rotation.y = Math.PI / 2;
    net.position.set(0, netHeight / 2, 0);
    net.receiveShadow = true;
    net.castShadow = true;
    scene.add(net);

    // Realistic Net Top Canvas Band
    const bandGeo = new THREE.PlaneGeometry(courtLength, 0.09);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const netBand = new THREE.Mesh(bandGeo, bandMat);
    netBand.rotation.y = Math.PI / 2;
    netBand.position.set(0, netHeight - 0.04, 0);
    netBand.castShadow = true;
    scene.add(netBand);

    // Heavy Metal Net Posts
    const postGeo = new THREE.CylinderGeometry(0.08, 0.08, netHeight + 0.15, 16);
    const postMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // slate-700 metallic frame
      metalness: 0.85,
      roughness: 0.15,
    });

    const post1 = new THREE.Mesh(postGeo, postMat);
    post1.position.set(0, (netHeight + 0.15) / 2, -courtLength / 2 - 0.1);
    post1.castShadow = true;
    post1.receiveShadow = true;
    scene.add(post1);

    const post2 = new THREE.Mesh(postGeo, postMat);
    post2.position.set(0, (netHeight + 0.15) / 2, courtLength / 2 + 0.1);
    post2.castShadow = true;
    post2.receiveShadow = true;
    scene.add(post2);

    // 4 Corner Stadium High Light Towers
    const poleGeo = new THREE.CylinderGeometry(0.14, 0.22, 9, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const fixtureGeo = new THREE.BoxGeometry(1.3, 0.45, 0.65);
    const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const createLightPole = (x: number, z: number, rotationY: number) => {
      const poleGroup = new THREE.Group();
      poleGroup.position.set(x, 0, z);

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.y = 4.5;
      pole.castShadow = true;
      poleGroup.add(pole);

      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);
      fixture.position.set(0, 9, 0);
      fixture.rotation.y = rotationY;
      fixture.castShadow = true;
      poleGroup.add(fixture);

      const bulb = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.55), bulbMat);
      bulb.position.set(0, 8.76, 0.01);
      bulb.rotation.x = Math.PI / 2;
      poleGroup.add(bulb);

      scene.add(poleGroup);
    };

    createLightPole(-26, -16, Math.PI / 4);
    createLightPole(26, -16, -Math.PI / 4);
    createLightPole(-26, 16, 3 * Math.PI / 4);
    createLightPole(26, 16, -3 * Math.PI / 4);

    // Realistic Surrounding Sponsor/Billboard Walls
    const createBillboard = (x: number, z: number, titleText: string, angleY: number) => {
      const texture = createSponsorCanvas(titleText);
      const boardGeo = new THREE.PlaneGeometry(7.5, 1.8);
      const boardMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.set(x, 1.5, z);
      board.rotation.y = angleY;
      board.castShadow = true;
      scene.add(board);

      // Support metallic posts
      const standGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.5, 8);
      const standMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7 });
      
      const p1 = new THREE.Mesh(standGeo, standMat);
      p1.position.set(x - 2.5 * Math.cos(angleY), 0.75, z + 2.5 * Math.sin(angleY));
      p1.castShadow = true;
      scene.add(p1);

      const p2 = new THREE.Mesh(standGeo, standMat);
      p2.position.set(x + 2.5 * Math.cos(angleY), 0.75, z - 2.5 * Math.sin(angleY));
      p2.castShadow = true;
      scene.add(p2);
    };

    createBillboard(-11, -19.5, "SMASHZONE PRO", 0);
    createBillboard(11, -19.5, "THREE.JS STADIUM", 0);
    createBillboard(-28, -6, "GRAND SLAM AI", Math.PI / 2);
    createBillboard(28, -6, "VITE ENGINE", -Math.PI / 2);
    createBillboard(-28, 6, "PVP ARENA", Math.PI / 2);
    createBillboard(28, 6, "SERVE MASTER", -Math.PI / 2);

    // Textured Furry Tennis Ball Setup
    const ballTexture = createBallTexture();
    const ballGeo = new THREE.SphereGeometry(0.36, 32, 32);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTexture,
      roughness: 0.95, // matte wool felt
      metalness: 0.02,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballMesh.castShadow = true;
    ballMesh.receiveShadow = true;
    scene.add(ballMesh);

    // Serve Prediction Line
    const predictionLineGeo = new THREE.BufferGeometry();
    const predictionLineMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.8,
    });
    const predictionLine = new THREE.Line(predictionLineGeo, predictionLineMat);
    scene.add(predictionLine);

    // Humanoid Player 1 (Left side)
    const p1 = new HumanoidPlayer(config.p1Color, true);
    scene.add(p1.group);

    // Humanoid Player 2 (Right side)
    const p2 = new HumanoidPlayer(config.p2Color, false);
    scene.add(p2.group);

    // Animation Tick Variables
    const clock = new THREE.Clock();

    // Map the 2D game state coordinates flawlessly into 3D objects
    const update3DObjects = () => {
      const ball = ballRef.current as any;
      const p1YVal = paddle1Y.current;
      const p2YVal = paddle2Y.current;
      const time = clock.getElapsedTime();

      // Ball Trajectory mapping: Width is X, Length is Z
      const ballX_3d = (ball.x / virtualWidth) * courtWidth - courtWidth / 2;
      const ballZ_3d = (ball.y / virtualHeight) * courtLength - courtLength / 2;
      
      // Use actual calculated physics height for realistic ball trajectory mapping
      ballMesh.position.set(ballX_3d, 0.36 + (ball.zHeight || 0), ballZ_3d);

      // Serve Prediction Arc
      if (ball.inServeState && ball.servingPlayer === 0 && ball.serveAimPoints && ball.serveAimPoints.length > 0) {
        predictionLine.visible = true;
        const pts = ball.serveAimPoints;
        const positions = new Float32Array(pts.length * 3);
        for (let i = 0; i < pts.length; i++) {
          positions[i * 3] = pts[i].x;
          positions[i * 3 + 1] = pts[i].y;
          positions[i * 3 + 2] = pts[i].z;
        }
        predictionLineGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        predictionLineGeo.setDrawRange(0, pts.length);
        predictionLineGeo.computeBoundingSphere();
      } else {
        predictionLine.visible = false;
      }

      // Rotate tennis ball realistically based on speed direction
      const bdx = ball.dx;
      const bdy = ball.dy;
      const ballSpeed = Math.sqrt(bdx * bdx + bdy * bdy);
      if (ballSpeed > 0.05) {
        // Rotate around secondary perpendicular axis
        const axis = new THREE.Vector3(bdy, 0, -bdx).normalize();
        ballMesh.rotateOnAxis(axis, ballSpeed * 0.015);
      }

      // Map dynamic player Z coordinates (center-aligned)
      const p1Y_center = p1YVal + PADDLE_H / 2;
      const p2Y_center = p2YVal + PADDLE_H / 2;

      const p1Z_3d = (p1Y_center / virtualHeight) * courtLength - courtLength / 2;
      const p2Z_3d = (p2Y_center / virtualHeight) * courtLength - courtLength / 2;

      // Position humanoid players
      p1.group.position.set(-courtWidth / 2 + 1.0, 0, p1Z_3d);
      p2.group.position.set(courtWidth / 2 - 1.0, 0, p2Z_3d);

      // Trigger skeletal running and racket swinging animations
      p1.update(time, p1Z_3d, ballX_3d, ballZ_3d, ball.dx);
      p2.update(time, p2Z_3d, ballX_3d, ballZ_3d, ball.dx);
    };

    // Main Renderer Animation Frame Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      update3DObjects();
      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // High performance container aspect resize handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Proper asset and memory disposal on component unmount
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      predictionLineGeo.dispose();
      predictionLineMat.dispose();
      
      // Dispose materials & geometries recursively
      scene.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      // Dispose generated textures
      courtTexture.dispose();
      netTexture.dispose();
      ballTexture.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [
    config.p1Color,
    config.p2Color,
    config.tableColor,
    PADDLE_H,
    virtualWidth,
    virtualHeight,
    ballRef,
    paddle1Y,
    paddle2Y
  ]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full absolute inset-0 bg-[#4382c4]"
      id="3d-tennis-container"
    />
  );
}
