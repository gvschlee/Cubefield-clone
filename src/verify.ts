import { CubeField, makeProjection } from "./cubefield";
import { Input } from "./input";
import { Model } from "./model";
import {
  IntakePattern,
  HallPattern,
  DiamondPattern,
  CurvePattern,
  Space,
  RandomCubes,
  SpecialRandomCubes,
} from "./patterns";
import { SimpleProjection } from "./projection";
import { Vector2, Vector3 } from "./math";

const fail: string[] = [];
const ok: string[] = [];

function check(name: string, cond: boolean, extra = ""): void {
  if (cond) ok.push(name);
  else fail.push(name + (extra ? " " + extra : ""));
}

const proj = new SimpleProjection(550, 400, 0.3, 0.22, new Vector2(275, 200));
const origin = proj.Project(new Vector3(0, 0, 0));
check("project origin is offset", Math.abs(origin.X - 275) < 1e-9 && Math.abs(origin.Y - 200) < 1e-9);

const far = proj.Project(new Vector3(0, 150, 4000));
check("far point recedes toward center-ish", far.X === 275 && far.Y > 200 && far.Y < 280);

const intake = new IntakePattern(20, 70, 28, 7);
check("intake gens", intake.generations.length === 20);
const i0 = intake.Generate(0);
const iLast = (() => {
  let row: number[] = [];
  for (let n = 1; n < 20; n++) row = intake.Generate(0);
  return row;
})();
check("intake first row is wide", i0.length > iLast.length && i0.length > 10);
check("intake is symmetric", i0.some((x) => x > 0) && i0.some((x) => x < 0));

const hall = new HallPattern(30, 70, 7);
const h0 = hall.Generate(0);
check("hall two walls", h0.length === 2 && Math.abs(Math.abs(h0[0]!) - 245) < 1e-6);

const space = new Space(10, 70);
check("space returns [0]", space.Generate(123)[0] === 0 && space.ClearOffset);

const dia = new DiamondPattern(24, 70, 7, 0.5);
check("diamond 24 rows", dia.generations.length === 24 && dia.generations.every((r) => r && r.length >= 2));

const curve = new CurvePattern(55, 70, 7, 7);
const c0 = curve.Generate(0);
const samples: number[][] = [c0];
for (let n = 1; n < 55; n++) samples.push(curve.Generate(0));
const bends = samples.map((r) => (r[0]! + r[1]!) / 2);
const bendVar = Math.max(...bends) - Math.min(...bends);
check("curve bends", bendVar > 200);

const rnd = new RandomCubes(5, 70, 78.57, 5, 0.5, 4, 15);
const xs = rnd.Generate(0);
check("random cubes count", xs.length >= 4 && xs.length <= 16);

const special = new SpecialRandomCubes(0, 70, 78.57, 5, 0.2, 2, 5);
const sx = special.Generate(0);
check("special random away from center-ish", sx.length >= 2 && sx.every((x) => Math.abs(x) >= 140 - 70));

const input = new Input();
const field = new CubeField(proj, 70, input);

for (let i = 0; i < 10; i++) field.Update();
check("idle field has cubes", field.Idle && field.cubes.Elements > 0);
check("idle speed target 36", field.SpeedTarget === 36);
check("menu visible", field.overlay.menuVisible);

field.Begin();
check("begin not idle", field.Idle === false);
check("begin invincible 60", field.invincibleTime === 60);
check("begin blink", field.ship.blinkTime === 24);
check("begin speed target 46", field.SpeedTarget === 46, "got " + field.SpeedTarget);
check("begin style 0", field.style === 0);
check("begin pattern 0 intake", field.patterns[0] instanceof IntakePattern);
check("pattern list length 16", field.patterns.length === 16);
check(
  "sequence halls diamonds curves",
  field.patterns[1] instanceof HallPattern &&
    field.patterns[5] instanceof DiamondPattern &&
    field.patterns[11] instanceof CurvePattern &&
    field.patterns[2] instanceof Space,
);

const score0 = field.Score;
field.Update();
check("score += SpeedTarget", field.Score === score0 + field.SpeedTarget);

input.setKey("ArrowLeft", true);
const vx0 = field.XVelocity;
for (let i = 0; i < 5; i++) field.Update();
check("left increases XVelocity", field.XVelocity > vx0);
check("bank rotation nonzero", field.bankRotation !== 0);
input.setKey("ArrowLeft", false);

input.setKey("KeyP", true);
field.Update();
check("pause on", field.Paused);
const pausedScore = field.Score;
field.Update();
check("pause freezes score", field.Score === pausedScore);
input.setKey("KeyP", false);
for (let i = 0; i < 2; i++) field.Update();
input.setKey("KeyP", true);
field.Update();
check("pause off", field.Paused === false);
input.setKey("KeyP", false);

input.setKey("KeyQ", true);
field.Update();
check("quality medium", field.quality === "MEDIUM");
input.setKey("KeyQ", false);
field.Update();
input.setKey("KeyQ", true);
field.Update();
check("quality low", field.quality === "LOW");
input.setKey("KeyQ", false);

field.XVelocity = 0;
field.invincibleTime = -1;
const killer = Model.Cube(70, proj, field.getStyle());
killer.Position.X = 0;
killer.Position.Y = 150;
killer.Position.Z = 250;
field.cubes.Enqueue(killer);
field.Update();
check("collision sets Dead", field.Dead);
check("ship fading", field.ship.fade);
check("blur starts", field.blur >= 1);

const top = field.TopScore;
for (let i = 0; i < 20; i++) field.Update();
check("death returns to idle", field.Idle && !field.Dead);
check("top score kept", field.TopScore === top && field.TopScore > 0);
check("score reset on idle", field.Score === 0);

field.Begin();
field.invincibleTime = 100000;
field.XVelocity = 0;
const seen = new Set<string>();
let sawSpeedUp = false;
let styleChanged = false;
const startStyle = field.style;
for (let i = 0; i < 2500; i++) {
  field.invincibleTime = 100000;
  field.Update();
  const p = field.patterns[field.pattern];
  if (p) seen.add(p.constructor.name);
  if (field.overlay.speedUpVisible) sawSpeedUp = true;
  if (field.style !== startStyle) styleChanged = true;
}
check("stayed alive with godmode", field.Dead === false);
check("saw intake", seen.has("IntakePattern"));
check("saw hall", seen.has("HallPattern"));
check("saw random", seen.has("RandomCubes"));
check("saw diamond", seen.has("DiamondPattern"));
check("saw curve", seen.has("CurvePattern"));
check("saw space", seen.has("Space"));
check("SPEED UP after a cycle", sawSpeedUp);
check("style changed after round", styleChanged);
check("round advanced", field.round > 0, "round=" + field.round);

console.log("PASS", ok.length);
console.log(ok.join(", "));
if (fail.length) {
  console.log("FAIL", fail.length);
  console.log(fail.join("\n"));
  process.exit(1);
}
console.log("all checks passed");
