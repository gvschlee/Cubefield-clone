export class Vector2 {
  constructor(
    public X: number,
    public Y: number,
  ) {}
}

export class Vector3 {
  constructor(
    public X: number,
    public Y: number,
    public Z: number,
  ) {}

  static Add(a: Vector3, b: Vector3): Vector3 {
    return new Vector3(a.X + b.X, a.Y + b.Y, a.Z + b.Z);
  }
}

const colorCache = new Map<number, string>();

export function colorCss(hex: number, alpha100: number): string {
  const a = Math.max(0, Math.min(100, Math.round(alpha100)));
  const key = ((hex & 0xffffff) << 8) | a;
  const hit = colorCache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  const css = a >= 100 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a / 100})`;
  colorCache.set(key, css);
  return css;
}

export function shadeHex(hex: number, mul: number): number {
  const r = Math.max(0, Math.min(255, Math.round(((hex >> 16) & 255) * mul)));
  const g = Math.max(0, Math.min(255, Math.round(((hex >> 8) & 255) * mul)));
  const b = Math.max(0, Math.min(255, Math.round((hex & 255) * mul)));
  return (r << 16) | (g << 8) | b;
}
