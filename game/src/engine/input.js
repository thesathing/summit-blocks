// Keyboard + mouse-drag camera input. Pointer lock is deliberately avoided:
// a plain drag works in a normal tab and in headless Chromium alike.
export function createInput(canvas) {
  const keys = new Set();
  let yawDelta = 0;
  let pitchDelta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const onKeyDown = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    keys.add(e.code);
  };
  const onKeyUp = (e) => keys.delete(e.code);
  const onBlur = () => keys.clear();
  const onPointerDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    yawDelta -= (e.clientX - lastX) * 0.005;
    pitchDelta -= (e.clientY - lastY) * 0.004;
    lastX = e.clientX;
    lastY = e.clientY;
  };
  const onPointerUp = () => { dragging = false; };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);

  return {
    keys,
    consumeLook() {
      const d = { yaw: yawDelta, pitch: pitchDelta };
      yawDelta = 0;
      pitchDelta = 0;
      return d;
    },
    get forward() {
      return keys.has('KeyW') || keys.has('ArrowUp');
    },
    get back() {
      return keys.has('KeyS') || keys.has('ArrowDown');
    },
    get left() {
      return keys.has('KeyA') || keys.has('ArrowLeft');
    },
    get right() {
      return keys.has('KeyD') || keys.has('ArrowRight');
    },
    get jump() {
      return keys.has('Space');
    },
    get sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    pressed(code) {
      return keys.has(code);
    },
    clear() {
      keys.clear();
    },
  };
}
