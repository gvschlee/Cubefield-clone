import { Vector2 } from "./math";
import { SimpleProjection } from "./projection";
import { Queue } from "./queue";
import { FaceStyle, Model } from "./model";
import {
  CubePattern,
  CurvePattern,
  DiamondPattern,
  HallPattern,
  IntakePattern,
  RandomCubes,
  Space,
  SpecialRandomCubes,
} from "./patterns";
import { Input } from "./input";

export const PLAY_W = 550;
export const PLAY_H = 400;
export const BASE_GROUND = 150;
export let STAGE_W = PLAY_W;
export let STAGE_H = PLAY_H;
export let SHIP_Y = PLAY_H - 8;

export function horizonY(): number {
  return STAGE_H * 0.46;
}
export const SIM_FPS = 30;
export const SIM_DT = 1 / SIM_FPS;

const TOP_SCORE_KEY = "cubefield-top-score";

export type Quality = "HIGH" | "MEDIUM" | "LOW";

export interface ShipState {
  y: number;
  yTarget: number;
  alpha: number;
  fade: boolean;
  blinkTime: number;
  visible: boolean;
}

export interface OverlayState {
  menuVisible: boolean;
  menuAlpha: number;
  paused: boolean;
  speedUpVisible: boolean;
  speedUpAlpha: number;
  speedUpTimer: number;
  speedUpAlphaTarget: number;
}

/**
 * CubeField + frame scripts from Cubefield.swf, ported at 30 FPS.
 * World strafes; the ship is a 2D triangle on screen.
 */
export class CubeField {
  readonly projection: SimpleProjection;
  readonly cubeSize: number;
  readonly cubeHalfSize: number;
  readonly cubes = new Queue<Model>();
  readonly styleSet: FaceStyle[][][];
  readonly idlePattern: SpecialRandomCubes;
  patterns: CubePattern[] = [];

  GroundHeight = 150;
  FarPlane = 4000;
  NearPlane = -200;
  shipZ = 200;
  shipHalfLength = 28;
  shipHalfWidth = 7;
  hitCubeScale = 0.58;
  generationWidth: number;

  Speed = 60;
  SpeedTarget = 60;
  patternWidth = 7;
  minWidth = 4;
  density = 0.3;
  maxDensity = 0.6;
  invincibleTime = 0;
  speedMul = 1;
  turnMul = 1;
  acceleration = 5;
  drag = 0.87;
  round = -1;
  XVelocity = 0;
  style = -1;
  xOffset = 0;
  pattern = 0;
  blur = 0;
  toNextGen = 0;
  Paused = false;
  Idle = true;
  Dead = false;

  Score = 0;
  LastScore = 0;
  TopScore = 0;
  surfaceAlpha = 100;
  quality: Quality = "HIGH";
  bankRotation = 0;

  readonly ship: ShipState = {
    y: SHIP_Y,
    yTarget: SHIP_Y,
    alpha: 100,
    fade: false,
    blinkTime: 0,
    visible: true,
  };

  readonly overlay: OverlayState = {
    menuVisible: true,
    menuAlpha: 0,
    paused: false,
    speedUpVisible: false,
    speedUpAlpha: 0,
    speedUpTimer: 0,
    speedUpAlphaTarget: 0,
  };

  private pauseTime = 0;
  private qualityTime = 0;
  private pointerDown = false;

  constructor(
    projection: SimpleProjection,
    cubeSize: number,
    private readonly input: Input,
  ) {
    this.projection = projection;
    this.cubeSize = cubeSize;
    this.cubeHalfSize = cubeSize / 2;
    this.generationWidth = (projection.ViewWidth / cubeSize) * 10;

    const orange = new FaceStyle(0xff9b00, 0);
    const black = new FaceStyle(0, 0);
    const wire = new FaceStyle(-1, 0x00ff00);
    const orangeRed = new FaceStyle(0xff3f00, 0);
    const gold = new FaceStyle(0xffcc00, 0);
    const magenta = new FaceStyle(0xff3b6c, 0xffffff);
    this.styleSet = [
      [
        [orangeRed, orangeRed, orangeRed, orangeRed],
        [gold, gold, gold, gold],
        [orange, orange, orange, orange],
      ],
      [[wire, wire, wire, wire]],
      [[black, black, black, black]],
      [[magenta, magenta, magenta, magenta]],
    ];

    this.idlePattern = new SpecialRandomCubes(
      0,
      cubeSize,
      this.generationWidth,
      5,
      0.2,
      2,
      5,
    );
    this.loadTopScore();
    this.generatePatterns();
    this.nextStyle();
    this.SetIdle();
  }

  setViewSize(width: number, height: number): void {
    STAGE_W = Math.max(1, width);
    STAGE_H = Math.max(1, height);
    SHIP_Y = STAGE_H - 8;
    this.projection.resize(STAGE_W, STAGE_H);
    const vh = this.projection.ViewHeight;
    const tanV = this.projection.TanV;
    const persp = vh / (vh + 2 * this.shipZ * tanV);
    const gap = Math.max(48, this.cubeSize * persp);
    const targetY = SHIP_Y - gap;
    this.GroundHeight = (targetY - this.projection.Offset.Y) / Math.max(1e-6, persp);
    this.speedMul =
      STAGE_W > STAGE_H
        ? this.visualSpan(STAGE_H, STAGE_W) / Math.max(1e-6, this.visualSpan(STAGE_W, STAGE_H))
        : 1;
    this.turnMul = STAGE_W > STAGE_H ? 1.25 : 1;
    this.updateAccel();
    this.generationWidth = (this.projection.ViewWidth / this.cubeSize) * 10;
    let node = this.cubes.First;
    while (node !== null) {
      node.Data.Position.Y = this.GroundHeight;
      node = node.Next;
    }
    this.ship.y = SHIP_Y;
    this.ship.yTarget = SHIP_Y;
  }

  /**
   * Fraction of view height a cube travels from the far plane to the ship.
   * Landscape world speed is scaled so this span is eaten at the same rate as portrait.
   * Matching raw pixels/sec overshoots because landscape is a much shorter screen.
   */
  private visualSpan(viewW: number, viewH: number): number {
    const tanV = Math.tan(0.3) * (viewH / Math.max(1, viewW));
    const perspShip = viewH / (viewH + 2 * this.shipZ * tanV);
    const gap = Math.max(48, this.cubeSize * perspShip);
    const ground = (viewH - 8 - gap - viewH / 2) / Math.max(1e-6, perspShip);
    const perspFar = viewH / (viewH + 2 * this.FarPlane * tanV);
    const yShip = viewH / 2 + ground * perspShip;
    const yFar = viewH / 2 + ground * perspFar;
    return (yShip - yFar) / Math.max(1, viewH);
  }

  private zStep(): number {
    return this.Speed * this.speedMul;
  }

  notePointerDown(): void {
    if (this.Paused && !this.Dead && !this.Idle) {
      this.Paused = false;
      this.overlay.paused = false;
      this.pauseTime = 16;
      return;
    }
    this.pointerDown = true;
  }

  generatePatterns(): void {
    this.SpeedTarget = this.SpeedTarget + 8;
    if (this.density < this.maxDensity || this.patternWidth > this.minWidth) {
      if (
        this.density < this.maxDensity &&
        (Math.random() < 0.5 || this.patternWidth >= this.minWidth)
      ) {
        this.density = this.density + 0.1;
      } else {
        this.patternWidth--;
      }
    } else {
      this.SpeedTarget = this.SpeedTarget + 4;
    }
    this.updateAccel();
    this.round++;
    if (this.round > 0) {
      this.showSpeedUp();
    }
    const cubeSize = this.cubeSize;
    const pw = this.patternWidth;
    const gw = this.generationWidth;
    const d = this.density;
    this.patterns = [
      new IntakePattern(20, cubeSize, 28, pw),
      new HallPattern(30, cubeSize, pw),
      new Space(10, cubeSize),
      new RandomCubes(120, cubeSize, gw, 5, d - 0.02, 4, 15),
      new IntakePattern(20, cubeSize, 28, pw),
      new DiamondPattern(24, cubeSize, pw, 0.5),
      new DiamondPattern(30, cubeSize, pw, 0.5),
      new DiamondPattern(24, cubeSize, pw, 0.5),
      new Space(15, cubeSize),
      new RandomCubes(70, cubeSize, gw, 5, d, 4, 15),
      new IntakePattern(20, cubeSize, 28, pw),
      new CurvePattern(55, cubeSize, 7, pw),
      new CurvePattern(55, cubeSize, 9, pw),
      new CurvePattern(55, cubeSize, 7, pw),
      new Space(15, cubeSize),
      new RandomCubes(100, cubeSize, gw, 5, d + 0.02, 4, 15),
    ];
  }

  Begin(): void {
    this.Dead = false;
    this.blur = 0;
    this.cubes.Clear();
    this.xOffset = 0;
    this.XVelocity = 0;
    this.bankRotation = 0;
    this.Idle = false;
    this.Paused = false;
    this.overlay.paused = false;
    // Slow first stretch: leftover attract cubes were spawning as a wall in your face.
    this.invincibleTime = 60;
    this.Speed = 26 * 1.15;
    this.SpeedTarget = 38 * 1.15;
    this.updateAccel();
    this.surfaceAlpha = 100;
    this.patternWidth = 7;
    this.density = 0.3;
    this.round = -1;
    this.style = -1;
    this.generatePatterns();
    this.pattern = 0;
    this.toNextGen = this.cubeSize * 16;
    this.nextStyle();
    this.overlay.menuVisible = false;
    this.showShip();
  }

  SetIdle(): void {
    this.Idle = true;
    this.Paused = false;
    this.overlay.paused = false;
    this.SpeedTarget = 36;
    this.Score = 0;
    this.overlay.menuVisible = true;
    this.overlay.menuAlpha = 0;
    this.blur = 0;
    this.cubes.Clear();
    this.ship.alpha = 100;
    this.ship.fade = false;
    this.ship.visible = true;
    this.ship.blinkTime = 0;
    this.ship.yTarget = SHIP_Y;
    this.ship.y = SHIP_Y;
  }

  updateAccel(): void {
    this.acceleration = (this.SpeedTarget / 15) * this.turnMul;
  }

  /** One 30 FPS simulation tick — original CubeField.Update + clip enterFrames. */
  Update(): void {
    this.pauseTime--;
    this.qualityTime--;

    if (this.input.pause && !this.Dead && !this.Idle) {
      if (this.pauseTime < 0) {
        this.Paused = !this.Paused;
        this.overlay.paused = this.Paused;
        this.pauseTime = 16;
      }
    } else {
      this.pauseTime = 0;
    }

    if (this.input.quality) {
      if (this.qualityTime < 0) {
        if (this.quality === "HIGH") {
          this.quality = "MEDIUM";
        } else if (this.quality === "MEDIUM") {
          this.quality = "LOW";
        } else {
          this.quality = "HIGH";
        }
        this.qualityTime = 16;
      }
    } else {
      this.qualityTime = 0;
    }

    if (this.Idle && !this.Dead) {
      if (this.input.start || this.pointerDown) {
        this.pointerDown = false;
        this.Begin();
      }
    }
    this.pointerDown = false;

    if (this.Dead) {
      if (this.surfaceAlpha <= 0) {
        this.surfaceAlpha = 100;
        this.Dead = false;
        this.SetIdle();
      }
      this.surfaceAlpha = this.surfaceAlpha - 6;
    } else {
      if (this.Idle) {
        this.XVelocity = this.XVelocity / 2;
      } else {
        if (this.Paused) {
          this.updateShip();
          this.updateOverlays();
          return;
        }
        if (this.input.right) {
          this.XVelocity = this.XVelocity - this.acceleration;
        }
        if (this.input.left) {
          this.XVelocity = this.XVelocity + this.acceleration;
        }
        this.XVelocity = this.XVelocity * this.drag;
      }

      this.bankRotation = this.XVelocity * 0.14;
      this.xOffset = this.xOffset + this.XVelocity;
      this.Speed = this.Speed + (this.SpeedTarget - this.Speed) / 12;
      if (Math.abs(this.SpeedTarget - this.Speed) < 0.8) {
        this.Speed = this.SpeedTarget;
      }

      let node = this.cubes.First;
      while (node !== null) {
        const cube = node.Data;
        cube.Position.Z = cube.Position.Z - this.zStep();
        cube.Position.X = cube.Position.X + this.XVelocity;
        cube.Alpha = Math.min(cube.Alpha + this.zStep() / 8, 100);
        if (cube.Position.Z <= this.NearPlane) {
          this.cubes.Dequeue();
        }
        node = node.Next;
      }

      this.toNextGen = this.toNextGen - this.zStep();
      const current = this.Idle ? this.idlePattern : this.patterns[this.pattern];
      if (this.toNextGen <= 0 && current !== undefined) {
        this.toNextGen = this.cubeSize * current.GenerationDistance;
        const active = this.patterns[this.pattern];
        if (active !== undefined && active.Done()) {
          if (active.ClearOffset) {
            this.xOffset = 0;
          }
          this.pattern++;
          if (this.pattern === this.patterns.length) {
            this.generatePatterns();
            this.pattern = 0;
          }
          if (this.pattern === 1 && this.round !== 0) {
            this.nextStyle();
          }
        }
        const xs = current.Generate(this.xOffset);
        for (let i = 0; i < xs.length; i++) {
          const cube = Model.Cube(this.cubeSize, this.projection, this.getStyle());
          cube.Position.X = xs[i] ?? 0;
          cube.Position.Y = this.GroundHeight;
          cube.Position.Z = this.FarPlane;
          this.cubes.Enqueue(cube);
        }
      }

      if (!this.Idle && !this.Dead && !this.Paused) {
        this.Score = this.Score + this.SpeedTarget;
      }
    }

    this.invincibleTime--;
    this.collideAndLayer();

    if (this.Dead) {
      this.blur = this.blur + 1;
    }

    this.updateShip();
    this.updateOverlays();
  }

  private collideAndLayer(): void {
    const zHitMin = this.shipZ - this.shipHalfLength;
    const zHitMax = this.shipZ + this.shipHalfLength;
    const dartHalf = 13;
    let node = this.cubes.Last;
    while (node !== null) {
      const cube = node.Data;
      cube.Surface = "low";
      const zAfter = cube.Position.Z;
      const zBefore = zAfter + this.zStep();
      if (
        Math.abs(cube.Position.X) <
        (this.cubeSize + this.projection.ViewWidth) / 2 +
          this.projection.TanU * zAfter
      ) {
        if (zAfter < this.shipZ) {
          cube.Surface = "high";
        }
        const zCrossed = zBefore > zHitMin && zAfter < zHitMax;
        if (
          zCrossed &&
          this.invincibleTime < 0 &&
          !this.Dead &&
          !this.Idle
        ) {
          const zAtHit = Math.max(zAfter, Math.min(zBefore, this.shipZ));
          const perspX =
            this.projection.ViewWidth /
            (this.projection.ViewWidth + 2 * Math.max(1, zAtHit) * this.projection.TanU);
          const hitX = dartHalf / perspX + this.cubeHalfSize * this.hitCubeScale;
          if (Math.abs(cube.Position.X) < hitX) {
            this.Dead = true;
            this.blur = 0;
            this.LastScore = Math.floor(this.Score);
            this.TopScore = Math.max(this.LastScore, this.TopScore);
            this.saveTopScore();
            this.ship.fade = true;
          }
        }
      }
      node = node.Prev;
    }
  }

  inFrustum(cube: Model): boolean {
    return (
      Math.abs(cube.Position.X) <
      (this.cubeSize + this.projection.ViewWidth) / 2 +
        this.projection.TanU * cube.Position.Z
    );
  }

  getStyle(): FaceStyle[] {
    const set = this.styleSet[this.style] ?? this.styleSet[0];
    if (set === undefined || set.length === 0) {
      return [new FaceStyle(0xff3f00, 0), new FaceStyle(0xff3f00, 0), new FaceStyle(0xff3f00, 0), new FaceStyle(0xff3f00, 0)];
    }
    return set[Math.floor(Math.random() * set.length)] ?? set[0]!;
  }

  nextStyle(): void {
    this.style = (this.style + 1) % this.styleSet.length;
    let node = this.cubes.First;
    while (node !== null) {
      node.Data.Styles = this.getStyle();
      node = node.Next;
    }
  }

  backgroundColor(): string {
    switch (this.style) {
      case 1:
        return "#0c0c0e";
      case 2:
        return "#ddd6cc";
      case 3:
        return "#e6dce3";
      default:
        return "#cfd6dd";
    }
  }

  scoreColor(): string {
    return this.style === 1 ? "#ffffff" : "#000000";
  }

  private showShip(): void {
    this.ship.yTarget = SHIP_Y;
    this.ship.alpha = 100;
    this.ship.blinkTime = 24;
    this.ship.fade = false;
  }

  private updateShip(): void {
    this.ship.y = this.ship.y + (this.ship.yTarget - this.ship.y) / 4;
    if (this.ship.fade) {
      this.ship.alpha = this.ship.alpha - 6;
      if (this.ship.alpha <= 0) {
        this.ship.alpha = 0;
        this.ship.fade = false;
        this.ship.yTarget = SHIP_Y;
        this.ship.y = SHIP_Y;
      }
    }
    if (this.ship.blinkTime > 0) {
      this.ship.visible = this.ship.blinkTime-- % 6 < 3;
    } else {
      this.ship.visible = true;
    }
  }

  private showSpeedUp(): void {
    this.overlay.speedUpVisible = true;
    this.overlay.speedUpTimer = 30;
    this.overlay.speedUpAlphaTarget = 100;
  }

  private updateOverlays(): void {
    if (this.overlay.menuVisible) {
      this.overlay.menuAlpha =
        this.overlay.menuAlpha + (100 - this.overlay.menuAlpha) / 2;
    } else {
      this.overlay.menuAlpha = 0;
    }

    if (this.overlay.speedUpVisible) {
      this.overlay.speedUpAlpha =
        this.overlay.speedUpAlpha +
        (this.overlay.speedUpAlphaTarget - this.overlay.speedUpAlpha) / 2;
      if (this.overlay.speedUpAlpha < 1 && this.overlay.speedUpAlphaTarget <= 0) {
        this.overlay.speedUpVisible = false;
      }
      this.overlay.speedUpTimer--;
      if (this.overlay.speedUpTimer < 0) {
        this.overlay.speedUpAlphaTarget = 0;
      }
    }
  }

  private loadTopScore(): void {
    try {
      const raw = localStorage.getItem(TOP_SCORE_KEY);
      const n = raw !== null ? parseInt(raw, 10) : 0;
      this.TopScore = Number.isFinite(n) ? n : 0;
    } catch {
      this.TopScore = 0;
    }
  }

  private saveTopScore(): void {
    try {
      localStorage.setItem(TOP_SCORE_KEY, String(this.TopScore));
    } catch {
      /* ignore quota / private mode */
    }
  }
}

export function makeProjection(): SimpleProjection {
  return new SimpleProjection(
    STAGE_W,
    STAGE_H,
    0.3,
    0.22,
    new Vector2(STAGE_W / 2, STAGE_H / 2),
  );
}
