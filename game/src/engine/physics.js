// Minimal AABB platform physics for the blocky climber. The player is a box
// (half-width 0.35, height 1.7) standing on platform boxes. Gravity, jumping,
// landing on platform tops, side push-out, moving-platform carry and the
// slippery ice surfaces all live here, so the player entity stays visual.
export const GRAVITY = 26;
export const JUMP_VELOCITY = 12.5;
export const WALK_SPEED = 6;
export const SPRINT_SPEED = 9.5;
export const PLAYER_HALF = 0.35;
export const PLAYER_HEIGHT = 1.7;

export function createBody(x, y, z) {
  return {
    pos: { x, y, z }, // pos.y is the FEET position
    vel: { x: 0, y: 0, z: 0 },
    onGround: false,
    ground: null, // platform the feet stand on (or null)
    groundType: 'static',
  };
}

// Move a platform's mesh for this frame and return its centre delta, so a
// standing climber is carried along. Crumble platforms fall away after the
// climber stands on them too long, then respawn.
export function updatePlatform(p, t, dt) {
  let dx = 0;
  let dz = 0;
  if (p.type === 'moving') {
    const nx = p.baseX + (p.axis === 'x' ? Math.sin(t * p.speed + p.phase) * p.range : 0);
    const nz = p.baseZ + (p.axis === 'z' ? Math.sin(t * p.speed + p.phase) * p.range : 0);
    dx = nx - p.x;
    dz = nz - p.z;
    p.x = nx;
    p.z = nz;
  }
  p.deltaX = dx;
  p.deltaZ = dz;
  if (p.type === 'crumble') {
    if (p.crumbleState === 'falling') {
      p.fallVel = (p.fallVel || 0) + GRAVITY * dt;
      p.y -= p.fallVel * dt;
      if (t > p.respawnAt) {
        p.y = p.baseY;
        p.fallVel = 0;
        p.crumbleState = 'idle';
        p.standTime = 0;
      }
    } else if (p.crumbleState === 'shaking') {
      p.shakeTime = (p.shakeTime || 0) + dt;
      if (p.shakeTime > 0.5) {
        p.crumbleState = 'falling';
        p.fallVel = 0;
        p.shakeTime = 0;
        p.respawnAt = t + 3.0;
      }
    }
  }
  return { dx, dz };
}

export function platformTop(p) {
  return p.y + p.h / 2;
}

export function platformAABB(p) {
  return {
    minX: p.x - p.w / 2, maxX: p.x + p.w / 2,
    minY: p.y - p.h / 2, maxY: p.y + p.h / 2,
    minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2,
  };
}

// Resolve the body against every platform. Call after integrating velocity.
// Returns nothing; mutates body (pos, vel, onGround, ground, groundType).
export function resolveCollisions(body, platforms, prevFeetY) {
  body.onGround = false;
  body.ground = null;
  body.groundType = 'static';
  const minX = body.pos.x - PLAYER_HALF;
  const maxX = body.pos.x + PLAYER_HALF;
  const minZ = body.pos.z - PLAYER_HALF;
  const maxZ = body.pos.z + PLAYER_HALF;
  const feet = body.pos.y;
  const head = body.pos.y + PLAYER_HEIGHT;

  for (const p of platforms) {
    if (p.type === 'crumble' && p.crumbleState === 'falling') continue;
    if (p.type === 'crumble' && p.crumbleState === 'gone') continue;
    const a = platformAABB(p);
    const overlapX = Math.min(maxX, a.maxX) - Math.max(minX, a.minX);
    const overlapZ = Math.min(maxZ, a.maxZ) - Math.max(minZ, a.minZ);
    const overlapY = Math.min(head, a.maxY) - Math.max(feet, a.minY);
    if (overlapX <= 0 || overlapZ <= 0 || overlapY <= 0) continue;
    // Landing on top: falling, and the feet were above the top last frame.
    if (body.vel.y <= 0.01 && prevFeetY >= a.maxY - 0.35) {
      body.pos.y = a.maxY;
      body.vel.y = 0;
      body.onGround = true;
      body.ground = p;
      body.groundType = p.type;
      continue;
    }
    // Side push-out along the smallest horizontal penetration.
    if (overlapX < overlapZ) {
      const centreX = (minX + maxX) / 2;
      const platCentreX = (a.minX + a.maxX) / 2;
      body.pos.x += centreX < platCentreX ? -overlapX : overlapX;
      body.vel.x = 0;
    } else {
      const centreZ = (minZ + maxZ) / 2;
      const platCentreZ = (a.minZ + a.maxZ) / 2;
      body.pos.z += centreZ < platCentreZ ? -overlapZ : overlapZ;
      body.vel.z = 0;
    }
  }
}
