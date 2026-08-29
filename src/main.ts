import "./style.css";
import { CubeField, STAGE_H, STAGE_W, SIM_DT, makeProjection, horizonY } from "./cubefield";
import { Input } from "./input";
import { Model } from "./model";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const maybeCtx = canvas.getContext("2d", { alpha: false, desynchronized: true });
if (maybeCtx === null) {
  throw new Error("Canvas 2D is not available");
}
const ctx: CanvasRenderingContext2D = maybeCtx;

const input = new Input();
const field = new CubeField(makeProjection(), 70, input);

function stageXFromEvent(e: PointerEvent): number {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0) {
    return STAGE_W / 2;
  }
  return ((e.clientX - rect.left) / rect.width) * STAGE_W;
}

function pointerShouldSteer(e: PointerEvent): boolean {
  return e.pointerType !== "mouse" || e.buttons > 0;
}

canvas.addEventListener("pointerdown", (e) => {
  field.notePointerDown();
  canvas.focus();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    // Pointer capture is optional.
  }
  if (pointerShouldSteer(e)) {
    input.setPointerSteer(stageXFromEvent(e));
  }
  e.preventDefault();
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointerShouldSteer(e)) {
    return;
  }
  input.setPointerSteer(stageXFromEvent(e));
});

function endPointer(): void {
  input.setPointerSteer(null);
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("lostpointercapture", endPointer);

document.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);
document.addEventListener("gesturestart", (e) => {
  e.preventDefault();
});

function viewportSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  if (vv != null && vv.width > 0 && vv.height > 0) {
    return { w: Math.floor(vv.width), h: Math.floor(vv.height) };
  }
  return { w: Math.floor(window.innerWidth), h: Math.floor(window.innerHeight) };
}

function logicalStage(cssW: number, cssH: number): { w: number; h: number } {
  return { w: cssW, h: cssH };
}

function resize(): void {
  const { w: cssW, h: cssH } = viewportSize();
  const vv = window.visualViewport;
  canvas.style.left = `${Math.floor(vv?.offsetLeft ?? 0)}px`;
  canvas.style.top = `${Math.floor(vv?.offsetTop ?? 0)}px`;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.floor(cssW * dpr));
  const bh = Math.max(1, Math.floor(cssH * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const logical = logicalStage(Math.max(1, cssW), Math.max(1, cssH));
  field.setViewSize(logical.w, logical.h);
  input.viewWidth = logical.w;
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
window.visualViewport?.addEventListener("resize", resize);
window.visualViewport?.addEventListener("scroll", resize);
resize();
canvas.focus();

for (let i = 0; i < 18; i++) {
  field.Update();
}

let acc = 0;
let last = performance.now();
const MAX_FRAME = 0.1;

function frame(now: number): void {
  const dt = Math.min(MAX_FRAME, (now - last) / 1000);
  last = now;
  acc += dt;
  let steps = 0;
  while (acc >= SIM_DT && steps < 2) {
    field.Update();
    acc -= SIM_DT;
    steps++;
  }
  if (acc > SIM_DT * 2) {
    acc = 0;
  }
  draw(ctx);
  requestAnimationFrame(frame);
}

interface WorldPalette {
  skyTop: string;
  skyHorizon: string;
  groundFar: string;
  groundNear: string;
  haze: string;
  night: boolean;
}

function palette(): WorldPalette {
  switch (field.style) {
    case 1:
      return {
        skyTop: "#07080c",
        skyHorizon: "#161821",
        groundFar: "#101218",
        groundNear: "#1c1e26",
        haze: "rgba(80, 220, 120, 0.12)",
        night: true,
      };
    case 2:
      return {
        skyTop: "#f4f0ea",
        skyHorizon: "#ffffff",
        groundFar: "#cfc8be",
        groundNear: "#9e968c",
        haze: "rgba(255,255,255,0.35)",
        night: false,
      };
    case 3:
      return {
        skyTop: "#f6e9f0",
        skyHorizon: "#fff6fa",
        groundFar: "#d7c2cc",
        groundNear: "#b89aaa",
        haze: "rgba(255, 80, 140, 0.14)",
        night: false,
      };
    default:
      return {
        skyTop: "#9eb6d4",
        skyHorizon: "#f3efe6",
        groundFar: "#c5ccd4",
        groundNear: "#8b949e",
        haze: "rgba(255, 170, 90, 0.16)",
        night: false,
      };
  }
}

function withWorldBank(g: CanvasRenderingContext2D, fn: () => void): void {
  const cx = STAGE_W / 2;
  const cy = horizonY();
  g.save();
  g.translate(cx, cy);
  g.rotate((field.bankRotation * Math.PI) / 180);
  g.translate(-cx, -cy);
  fn();
  g.restore();
}

function drawWorld(g: CanvasRenderingContext2D): void {
  const p = palette();
  const horizon = horizonY();
  const pad = Math.max(STAGE_W, STAGE_H);
  const sky = g.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, p.skyTop);
  sky.addColorStop(0.72, p.skyHorizon);
  sky.addColorStop(1, p.haze);
  g.fillStyle = sky;
  g.fillRect(-pad, -pad, STAGE_W + pad * 2, horizon + pad);

  const ground = g.createLinearGradient(0, horizon, 0, STAGE_H + 40);
  ground.addColorStop(0, p.groundFar);
  ground.addColorStop(1, p.groundNear);
  g.fillStyle = ground;
  g.fillRect(-pad, horizon, STAGE_W + pad * 2, STAGE_H + pad);

  const glowR = Math.max(220, Math.min(STAGE_W, STAGE_H) * 0.55);
  const glow = g.createRadialGradient(STAGE_W / 2, horizon, 8, STAGE_W / 2, horizon, glowR);
  glow.addColorStop(0, p.haze);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = glow;
  g.fillRect(0, horizon - 50, STAGE_W, 100);

  g.strokeStyle = p.night ? "rgba(180,255,200,0.18)" : "rgba(255,255,255,0.28)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-40, horizon);
  g.lineTo(STAGE_W + 40, horizon);
  g.stroke();
}

function drawVignette(g: CanvasRenderingContext2D): void {
  const vr = Math.hypot(STAGE_W, STAGE_H) * 0.52;
  const v = g.createRadialGradient(
    STAGE_W / 2,
    STAGE_H * 0.55,
    Math.min(STAGE_W, STAGE_H) * 0.18,
    STAGE_W / 2,
    STAGE_H * 0.55,
    vr,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = v;
  g.fillRect(0, 0, STAGE_W, STAGE_H);
}

function draw(g: CanvasRenderingContext2D): void {
  const sx = canvas.width / STAGE_W;
  const sy = canvas.height / STAGE_H;
  g.setTransform(sx, 0, 0, sy, 0, 0);
  g.imageSmoothingEnabled = true;

  g.fillStyle = "#000000";
  g.fillRect(0, 0, STAGE_W, STAGE_H);

  const worldAlpha = Math.max(0, field.surfaceAlpha) / 100;
  g.globalAlpha = worldAlpha;
  withWorldBank(g, () => {
    drawWorld(g);
    drawCubes(g, "low");
  });
  g.globalAlpha = 1;
  drawShip(g);
  g.globalAlpha = worldAlpha;
  withWorldBank(g, () => {
    drawCubes(g, "high");
  });
  g.globalAlpha = 1;
  drawVignette(g);
  drawHud(g);
}

function drawCubes(g: CanvasRenderingContext2D, surface: "low" | "high"): void {
  const skipFar =
    field.quality === "LOW" ? 1600 : field.quality === "MEDIUM" ? 2400 : 3200;
  const strokeNear = field.quality === "LOW" ? 400 : 1100;

  let node = field.cubes.Last;
  while (node !== null) {
    const cube: Model = node.Data;
    const z = cube.Position.Z;
    if (cube.Surface === surface && z < skipFar && cube.Alpha > 4 && field.inFrustum(cube)) {
      cube.Draw(g, z < strokeNear);
    }
    node = node.Prev;
  }
}

function drawShip(g: CanvasRenderingContext2D): void {
  const ship = field.ship;
  if (!ship.visible || ship.alpha <= 0) {
    return;
  }
  const halfW = 13;
  const height = 18;
  g.save();
  g.translate(STAGE_W / 2, ship.y);
  g.globalAlpha = Math.max(0, Math.min(1, ship.alpha / 100));
  g.fillStyle = "rgba(0,0,0,0.28)";
  g.beginPath();
  g.ellipse(0, 3, 16, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(0, -height);
  g.lineTo(-halfW, 0);
  g.lineTo(0, 0);
  g.closePath();
  g.fillStyle = "#6a6a6a";
  g.fill();
  g.beginPath();
  g.moveTo(0, -height);
  g.lineTo(halfW, 0);
  g.lineTo(0, 0);
  g.closePath();
  g.fillStyle = "#2f2f2f";
  g.fill();
  g.beginPath();
  g.moveTo(0, -height);
  g.lineTo(-halfW, 0);
  g.lineTo(halfW, 0);
  g.closePath();
  g.strokeStyle = "#111111";
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.moveTo(0, -height);
  g.lineTo(0, 0);
  g.strokeStyle = "#1a1a1a";
  g.stroke();
  g.restore();
}

function drawHud(g: CanvasRenderingContext2D): void {
  g.save();
  g.textBaseline = "top";
  g.textAlign = "center";
  const ink = field.scoreColor();
  const night = field.style === 1;
  const cx = STAGE_W / 2;

  if (!field.Idle && !field.Dead) {
    g.fillStyle = night ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.28)";
    g.font = "bold 22px Arial, Helvetica, sans-serif";
    g.fillText(String(Math.floor(field.Score)), cx + 1, 12);
    g.fillStyle = ink;
    g.fillText(String(Math.floor(field.Score)), cx, 11);
  }

  if (field.overlay.menuVisible) {
    const a = field.overlay.menuAlpha / 100;
    const menuW = Math.min(440, STAGE_W - 40);
    const menuH = 188;
    const menuX = (STAGE_W - menuW) / 2;
    const menuY = Math.max(20, Math.min(STAGE_H * 0.16, STAGE_H / 2 - menuH / 2));
    g.globalAlpha = a;
    g.fillStyle = night ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.22)";
    g.fillRect(menuX, menuY, menuW, menuH);
    g.strokeStyle = night ? "rgba(120,255,160,0.25)" : "rgba(0,0,0,0.12)";
    g.strokeRect(menuX + 0.5, menuY + 0.5, menuW - 1, menuH - 1);

    g.fillStyle = ink;
    g.font = "bold 46px Arial, Helvetica, sans-serif";
    g.fillText("CUBEFIELD", cx, menuY + 14);
    g.font = "13px Arial, Helvetica, sans-serif";
    g.fillStyle = night ? "#b6f0c8" : "#334155";
    g.fillText("A fan clone of the 2006 original", cx, menuY + 64);

    g.fillStyle = ink;
    g.font = "16px Arial, Helvetica, sans-serif";
    g.fillText(`Top Score: ${field.TopScore}`, cx, menuY + 88);

    g.font = "13px Arial, Helvetica, sans-serif";
    g.fillText("Hold left / right of center to dodge", cx, menuY + 112);
    g.fillText("P pause   ·   Q quality", cx, menuY + 128);
    g.font = "bold 14px Arial, Helvetica, sans-serif";
    g.fillText("Tap, click, or press Enter to start", cx, menuY + 148);

    g.font = "11px Arial, Helvetica, sans-serif";
    g.globalAlpha = a * 0.85;
    g.fillText("Cubefield by Max Abernethy / Flecko.net 2006", cx, STAGE_H - 48);
    g.fillText("This is a fan clone.", cx, STAGE_H - 32);
  }

  g.globalAlpha = 1;

  if (field.overlay.paused) {
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, 0, STAGE_W, STAGE_H);
    g.fillStyle = "#ffffff";
    g.font = "bold 36px Arial, Helvetica, sans-serif";
    g.fillText("PAUSED", cx, STAGE_H * 0.4);
    g.font = "14px Arial, Helvetica, sans-serif";
    g.fillText("Press P or tap to continue", cx, STAGE_H * 0.4 + 50);
  }

  if (field.overlay.speedUpVisible) {
    g.globalAlpha = Math.max(0, Math.min(1, field.overlay.speedUpAlpha / 100));
    g.fillStyle = field.scoreColor();
    g.font = "bold 40px Arial, Helvetica, sans-serif";
    g.fillText("SPEED UP", cx, STAGE_H * 0.42);
  }

  g.restore();
}

requestAnimationFrame(frame);
