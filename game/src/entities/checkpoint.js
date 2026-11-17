// Checkpoint logic: touching a flag's ring activates it as the respawn
// point. The flags themselves are built in world/props.js; this module only
// tracks which checkpoint is current.
export function createCheckpoints(checkpointData) {
  let current = 0;
  return {
    list: checkpointData,
    get current() {
      return checkpointData[current];
    },
    get index() {
      return current;
    },
    // Returns the newly activated checkpoint, or null.
    tryActivate(px, py, pz) {
      for (let i = 0; i < checkpointData.length; i += 1) {
        if (i <= current) continue;
        const cp = checkpointData[i];
        const dx = cp.x - px;
        const dy = cp.y - py;
        const dz = cp.z - pz;
        if (dx * dx + dy * dy + dz * dz < 4.0) {
          current = i;
          return cp;
        }
      }
      return null;
    },
    reset() {
      current = 0;
    },
  };
}
