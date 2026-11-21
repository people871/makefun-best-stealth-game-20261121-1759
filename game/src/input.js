// SHADOW LANTERN — keyboard + mouse input.
// The game loop reads the live key set every frame; discrete actions
// (pause, restart, coin throw) go through Game.onKey / Game.onPointer.
// Tests drive the same surface by adding codes to `keys` directly.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, inside: false };
    this.onKeyPress = null; // (code) => void, wired by Game
    this.onPointerDown = null; // (x, y) => void, wired by Game
    this.canvas = canvas;
    this.attach(canvas);
  }

  attach(canvas) {
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (this.onKeyPress) this.onKeyPress(event.code);
      // Keep the page from scrolling on arrows / space while playing.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      this.mouse.inside = true;
    });
    canvas.addEventListener('mousedown', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      this.mouse.x = x;
      this.mouse.y = y;
      if (this.onPointerDown) this.onPointerDown(x, y);
    });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(...codes) {
    return codes.some((code) => this.keys.has(code));
  }

  get sneaking() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  // The player's intended move direction from WASD / arrow keys.
  moveDirection() {
    let dx = 0;
    let dy = 0;
    if (this.isDown('KeyA', 'ArrowLeft')) dx -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) dx += 1;
    if (this.isDown('KeyW', 'ArrowUp')) dy -= 1;
    if (this.isDown('KeyS', 'ArrowDown')) dy += 1;
    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.SQRT2;
      dx *= inv;
      dy *= inv;
    }
    return { dx, dy };
  }

  clear() {
    this.keys.clear();
  }
}
