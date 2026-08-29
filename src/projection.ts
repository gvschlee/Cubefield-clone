import { Vector2, Vector3 } from "./math";

/** Faithful port of SimpleProjection from Cubefield.swf. */
export class SimpleProjection {
  ViewWidth: number;
  ViewHeight: number;
  TanU: number;
  TanV: number;
  Offset: Vector2;

  constructor(
    ViewWidth: number,
    ViewHeight: number,
    u = 0.3,
    v = 0.22,
    offset: Vector2,
  ) {
    this.ViewWidth = ViewWidth;
    this.ViewHeight = ViewHeight;
    this.TanU = Math.tan(u);
    this.TanV = Math.tan(v);
    this.Offset = offset;
  }

  /** Keep cubes square while filling an arbitrary aspect ratio. */
  resize(viewWidth: number, viewHeight: number): void {
    this.ViewWidth = viewWidth;
    this.ViewHeight = viewHeight;
    this.Offset.X = viewWidth / 2;
    this.Offset.Y = viewHeight / 2;
    this.TanU = Math.tan(0.3);
    this.TanV = this.TanU * (viewHeight / Math.max(1, viewWidth));
  }

  Project(pt: Vector3): Vector2 {
    const out = new Vector2(0, 0);
    this.ProjectInto(pt.X, pt.Y, pt.Z, out);
    return out;
  }

  ProjectInto(x: number, y: number, z: number, out: Vector2): void {
    const z2 = 2 * z;
    out.X = (x * this.ViewWidth) / (this.ViewWidth + z2 * this.TanU) + this.Offset.X;
    out.Y = (y * this.ViewHeight) / (this.ViewHeight + z2 * this.TanV) + this.Offset.Y;
  }
}
