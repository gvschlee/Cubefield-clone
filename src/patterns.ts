/**
 * Pattern generators ported from Cubefield.swf (AS2).
 * GenerationDistance, ClearOffset, Done(), and Generate(offset) match the original.
 */

export abstract class CubePattern {
  currentGeneration = 0;
  ClearOffset = false;
  GenerationDistance = 1;

  constructor(
    public numGenerations: number,
    public cubeSize: number,
  ) {}

  Done(): boolean {
    return this.currentGeneration >= this.numGenerations;
  }

  abstract Generate(offset: number): number[];
}

export class SpecialRandomCubes extends CubePattern {
  readonly halfGenerationWidth: number;

  constructor(
    numGenerations: number,
    cubeSize: number,
    public generationWidth: number,
    generationDistance: number,
    public density: number,
    public minGen: number,
    public maxGen: number,
  ) {
    super(numGenerations, cubeSize);
    this.halfGenerationWidth = Math.round(generationWidth / 2);
    this.GenerationDistance = generationDistance;
    this.ClearOffset = true;
  }

  Generate(offset: number): number[] {
    this.currentGeneration++;
    const xs: number[] = [];
    const snap = offset % this.cubeSize;
    while ((xs.length < this.minGen || Math.random() < this.density) && xs.length <= this.maxGen) {
      let x = (2 + Math.round(Math.random() * this.halfGenerationWidth)) * this.cubeSize;
      if (Math.random() < 0.5) {
        x = -x;
      }
      xs.push(x - snap);
    }
    return xs;
  }
}

export class RandomCubes extends CubePattern {
  readonly halfGenerationWidth: number;

  constructor(
    numGenerations: number,
    cubeSize: number,
    public generationWidth: number,
    generationDistance: number,
    public density: number,
    public minGen: number,
    public maxGen: number,
  ) {
    super(numGenerations, cubeSize);
    this.halfGenerationWidth = Math.round(generationWidth / 2);
    this.GenerationDistance = generationDistance;
    this.ClearOffset = true;
  }

  Generate(offset: number): number[] {
    this.currentGeneration++;
    const xs: number[] = [];
    const snap = offset % this.cubeSize;
    while ((xs.length < this.minGen || Math.random() < this.density) && xs.length <= this.maxGen) {
      xs.push(
        (Math.round(Math.random() * this.generationWidth) - this.halfGenerationWidth) *
          this.cubeSize -
          snap,
      );
    }
    return xs;
  }
}

export class IntakePattern extends CubePattern {
  readonly innerCoeff = 300;
  readonly innerOffset = 10;
  readonly generations: number[][];

  constructor(numGenerations: number, cubeSize: number, widthIn: number, widthOut: number) {
    super(numGenerations, cubeSize);
    this.GenerationDistance = 2;
    this.generations = new Array<number[]>(numGenerations);
    const logDenom = Math.log(this.innerCoeff * numGenerations + this.innerOffset);
    const slope = (widthIn - widthOut / 2) / logDenom;
    let prevInner = widthIn;
    for (let i = 0; i < numGenerations; i++) {
      const inner = Math.floor(widthIn - slope * Math.log(this.innerCoeff * i + this.innerOffset));
      const count = prevInner - inner + 1;
      const row = new Array<number>(2 * count);
      for (let k = 0; k < count; k++) {
        row[k] = (inner + k) * cubeSize;
        row[k + count] = -(row[k] ?? 0);
      }
      this.generations[i] = row;
      prevInner = inner;
    }
  }

  Generate(offset: number): number[] {
    const row = this.generations[this.currentGeneration++];
    if (row === undefined) {
      return [];
    }
    return row.map((x) => x + offset);
  }
}

export class HallPattern extends CubePattern {
  readonly generations: number[][];

  constructor(numGenerations: number, cubeSize: number, width: number) {
    super(numGenerations, cubeSize);
    const half = (cubeSize * width) / 2;
    this.generations = new Array<number[]>(numGenerations);
    for (let i = 0; i < numGenerations; i++) {
      this.generations[i] = [-half, half];
    }
    this.GenerationDistance = 1.9;
  }

  Generate(offset: number): number[] {
    const row = this.generations[this.currentGeneration++];
    if (row === undefined) {
      return [];
    }
    return row.map((x) => x + offset);
  }
}

export class Space extends CubePattern {
  constructor(numGenerations: number, cubeSize: number) {
    super(numGenerations, cubeSize);
    this.ClearOffset = true;
  }

  Generate(_offset: number): number[] {
    this.currentGeneration++;
    return [0];
  }
}

export class DiamondPattern extends CubePattern {
  readonly generations: number[][];

  constructor(numGenerations: number, cubeSize: number, _width: number, scale: number) {
    super(numGenerations, cubeSize);
    const width = 6;
    this.generations = new Array<number[]>(numGenerations);
    const half = Math.floor(width / 2);
    const halfGens = Math.ceil(numGenerations / 2);
    const step = 2 * scale;
    const expandLimit = half / scale;

    let i = 0;
    for (; i < expandLimit; i++) {
      const x = (half + i * step) * cubeSize;
      this.generations[i] = [x, -x];
    }
    for (; i < halfGens; i++) {
      const d = i * step;
      const outer = (half + d) * cubeSize;
      const inner = (d - width) * cubeSize;
      this.generations[i] = [outer, -outer, inner, -inner];
    }

    const odd = numGenerations % 2 === 1 ? 1 : 0;
    for (let k = odd; k < halfGens; k++) {
      const src = halfGens - 1 - k;
      const dst = halfGens + k - odd;
      const srcRow = this.generations[src];
      this.generations[dst] = srcRow !== undefined ? srcRow.slice() : [];
    }
    this.GenerationDistance = 2;
  }

  Generate(offset: number): number[] {
    const row = this.generations[this.currentGeneration++];
    if (row === undefined) {
      return [];
    }
    return row.map((x) => x + offset);
  }
}

export class CurvePattern extends CubePattern {
  readonly generations: number[][];

  constructor(numGenerations: number, cubeSize: number, curveSize: number, width: number) {
    super(numGenerations, cubeSize);
    this.generations = new Array<number[]>(numGenerations);
    const theta = (Math.PI * 2) / numGenerations;
    const half = (width / 2) * cubeSize;
    for (let i = 0; i < numGenerations; i++) {
      const bend = cubeSize * Math.round(curveSize * Math.sin(i * theta));
      this.generations[i] = [half + bend, -half + bend];
    }
    this.GenerationDistance = 2;
  }

  Generate(offset: number): number[] {
    const row = this.generations[this.currentGeneration++];
    if (row === undefined) {
      return [];
    }
    return row.map((x) => x + offset);
  }
}
