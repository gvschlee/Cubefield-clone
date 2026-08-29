/** Held-key tracker. Original used Key.isDown every enterFrame. */
export class Input {
  private readonly down = new Set<string>();
  /** -1 = left, 1 = right, 0 = none. Set from touch / held pointer. */
  private pointerSteer = 0;

  constructor() {
    if (typeof window === "undefined") {
      return;
    }
    window.addEventListener("keydown", (e) => {
      this.down.add(e.code);
      if (
        e.code === "ArrowLeft" ||
        e.code === "ArrowRight" ||
        e.code === "ArrowUp" ||
        e.code === "ArrowDown" ||
        e.code === "Space" ||
        e.code === "KeyP" ||
        e.code === "KeyQ"
      ) {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.pointerSteer = 0;
    });
  }

  setKey(code: string, isDown: boolean): void {
    if (isDown) {
      this.down.add(code);
    } else {
      this.down.delete(code);
    }
  }

  setPointerSteer(stageX: number | null): void {
    if (stageX === null) {
      this.pointerSteer = 0;
      return;
    }
    const mid = 275;
    const dead = 40;
    if (stageX < mid - dead) {
      this.pointerSteer = -1;
    } else if (stageX > mid + dead) {
      this.pointerSteer = 1;
    } else {
      this.pointerSteer = 0;
    }
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  get left(): boolean {
    return this.isDown("ArrowLeft") || this.isDown("KeyA") || this.pointerSteer < 0;
  }

  get right(): boolean {
    return this.isDown("ArrowRight") || this.isDown("KeyD") || this.pointerSteer > 0;
  }

  get pause(): boolean {
    return this.isDown("KeyP");
  }

  get quality(): boolean {
    return this.isDown("KeyQ");
  }

  get start(): boolean {
    return (
      this.isDown("Space") ||
      this.isDown("Enter") ||
      this.isDown("ArrowLeft") ||
      this.isDown("ArrowRight") ||
      this.isDown("ArrowUp") ||
      this.isDown("ArrowDown") ||
      this.isDown("KeyA") ||
      this.isDown("KeyD")
    );
  }
}
