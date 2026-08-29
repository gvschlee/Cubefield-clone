/** Held-key tracker. Original used Key.isDown every enterFrame. */
export class Input {
  private readonly down = new Set<string>();

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
    });
  }

  setKey(code: string, isDown: boolean): void {
    if (isDown) {
      this.down.add(code);
    } else {
      this.down.delete(code);
    }
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  get left(): boolean {
    return this.isDown("ArrowLeft") || this.isDown("KeyA");
  }

  get right(): boolean {
    return this.isDown("ArrowRight") || this.isDown("KeyD");
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
