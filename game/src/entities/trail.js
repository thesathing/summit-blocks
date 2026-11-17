// Movement trail particles for SUMMIT BLOCKS: while the climber moves, the
// equipped trail (Sparkle / Snowflakes / Embers) sheds small glowing blocks
// behind them. Seeded randomness, and nothing is emitted while the climber
// stands still — so the fixed screenshot frames stay deterministic.
import * as THREE from 'three';
import { mulberry32 } from '../world/textures.js';

const TRAIL_COLORS = {
  'trail-sparkle': 0xffe27a,
  'trail-snow': 0xdff2ff,
  'trail-embers': 0xff7a2f,
};

export function createTrail(scene) {
  const rand = mulberry32(4242);
  const pool = [];
  for (let i = 0; i < 24; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.14),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    );
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 });
  }

  let trailId = 'trail-none';
  let emitTimer = 0;

  function spawn(x, y, z) {
    const p = pool.find((q) => q.life <= 0);
    if (!p) return;
    p.life = 0.6;
    p.mesh.visible = true;
    p.mesh.material.color.setHex(TRAIL_COLORS[trailId] || 0xffffff);
    p.mesh.material.opacity = 0.9;
    p.mesh.position.set(x + (rand() - 0.5) * 0.4, y + 0.15 + rand() * 0.3, z + (rand() - 0.5) * 0.4);
    p.vx = (rand() - 0.5) * 0.6;
    p.vy = 0.4 + rand() * 0.7;
    p.vz = (rand() - 0.5) * 0.6;
    p.mesh.scale.setScalar(0.7 + rand() * 0.6);
  }

  return {
    setTrail(id) {
      trailId = id;
    },
    update(dt, pos, moving, onGround) {
      if (trailId !== 'trail-none' && moving && onGround) {
        emitTimer -= dt;
        if (emitTimer <= 0) {
          emitTimer = 0.06;
          spawn(pos.x, pos.y, pos.z);
        }
      }
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.mesh.material.opacity = Math.max(0, p.life * 1.5);
        p.mesh.scale.multiplyScalar(1 - dt * 0.5);
        if (p.life <= 0) p.mesh.visible = false;
      }
    },
  };
}
