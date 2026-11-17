// Frame loop helper: delta time clamped so a slow headless frame can never
// teleport the climber through a platform.
export const MAX_DT = 0.05;

export function createClock() {
  let last = performance.now();
  return {
    tick() {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, MAX_DT);
      last = now;
      return dt;
    },
  };
}
