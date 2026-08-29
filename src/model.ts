import { Vector2, Vector3, colorCss, shadeHex } from "./math";
import { SimpleProjection } from "./projection";

export class FaceStyle {
  constructor(
    public FillColor: number,
    public LineColor: number,
  ) {}
}

export type SurfaceId = "low" | "high";

const scratch = Array.from({ length: 8 }, () => new Vector2(0, 0));
const FACE_LIGHT = [0.68, 1.06, 1.24, 0.86];

/**
 * 3D mesh drawn with the original SimpleProjection.
 * Cube() matches Model.Cube from the SWF (4 faces, no top/back).
 */
export class Model {
  Position = new Vector3(0, 0, 0);
  Alpha = 0;
  Surface: SurfaceId = "low";

  constructor(
    public projection: SimpleProjection,
    public vertices: Vector3[],
    public faces: number[][],
    public Styles: FaceStyle[],
  ) {}

  Draw(ctx: CanvasRenderingContext2D, stroke: boolean): void {
    const pos = this.Position;
    const nV = this.vertices.length;
    for (let i = 0; i < nV; i++) {
      const v = this.vertices[i]!;
      const out = scratch[i] ?? (scratch[i] = new Vector2(0, 0));
      this.projection.ProjectInto(v.X + pos.X, v.Y + pos.Y, v.Z + pos.Z, out);
    }
    const fog = 1 - Math.min(0.5, Math.max(0, pos.Z) / 3800);
    const alpha = this.Alpha * fog;
    for (let i = 0; i < this.faces.length; i++) {
      const style = this.Styles[i] ?? this.Styles[0];
      if (style === undefined) {
        continue;
      }
      const face = this.faces[i];
      if (face === undefined || face.length === 0) {
        continue;
      }
      const p0 = scratch[face[0] ?? 0];
      if (p0 === undefined) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(p0.X, p0.Y);
      const n = face.length;
      for (let k = 1; k < n; k++) {
        const p = scratch[face[k] ?? 0];
        if (p !== undefined) {
          ctx.lineTo(p.X, p.Y);
        }
      }
      ctx.closePath();
      if (style.FillColor >= 0) {
        const lit = shadeHex(style.FillColor, FACE_LIGHT[i] ?? 1);
        ctx.fillStyle = colorCss(lit, alpha);
        ctx.fill();
      }
      if (stroke || style.FillColor < 0) {
        const line = style.FillColor < 0 ? style.LineColor : shadeHex(style.FillColor, 0.35);
        ctx.strokeStyle = colorCss(line, Math.min(alpha, 70));
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  static Cube(size: number, projection: SimpleProjection, styles: FaceStyle[]): Model {
    const h = size / 2;
    const vertices = [
      new Vector3(-h, -h, -h),
      new Vector3(h, -h, -h),
      new Vector3(-h, -h, h),
      new Vector3(h, -h, h),
      new Vector3(-h, h, -h),
      new Vector3(h, h, -h),
      new Vector3(-h, h, h),
      new Vector3(h, h, h),
    ];
    const faces = [
      [0, 2, 6, 4],
      [1, 3, 7, 5],
      [0, 1, 5, 4],
      [0, 1, 3, 2],
    ];
    return new Model(projection, vertices, faces, styles);
  }
}
