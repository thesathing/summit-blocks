// Level data for SUMMIT BLOCKS: a spiral climb up one mountain, generated from a
// fixed seed so the mountain is identical on every run. Three zones by height:
//   forest  y < 26   (green, wide platforms, gentle)
//   cliff   26 - 58  (rock, narrow, moving + crumbling platforms, lava gap)
//   snow    y > 58   (white/blue, icy platforms, wind gusts)
// The summit flag sits at SUMMIT_Y. Coins (~30) hang over the harder jumps.
import { mulberry32 } from '../world/textures.js';

export const SUMMIT_Y = 88;
export const ZONE_LINES = { forest: 26, cliff: 58 };
export const COIN_TOTAL = 30;

export function zoneAt(y) {
  if (y < ZONE_LINES.forest) return 'forest';
  if (y < ZONE_LINES.cliff) return 'cliff';
  return 'snow';
}

// Mountain radius at a given height (the cone narrows toward the summit).
export function mountainRadius(y) {
  return Math.max(9, 44 - y * 0.38);
}

function platformSizeFor(zone, rand) {
  if (zone === 'forest') return { w: 3.6 + rand() * 0.8, d: 3.6 + rand() * 0.8 };
  if (zone === 'cliff') return { w: 2.8 + rand() * 0.6, d: 2.8 + rand() * 0.6 };
  return { w: 2.5 + rand() * 0.5, d: 2.5 + rand() * 0.5 };
}

export function buildLevel(seed = 20261117) {
  const rand = mulberry32(seed);
  const platforms = [];
  const coins = [];
  const hazards = [];

  // Base camp: a wide wooden deck where the run starts, plus the ground disc.
  platforms.push({
    id: 0, x: 0, y: 0.6, z: 47, w: 10, d: 10, h: 1.2, type: 'wood', zone: 'forest',
  });

  let angle = 0.15;
  let y = 0.6;
  let prev = platforms[0];
  let index = 1;
  let coinCount = 0;

  // Jump envelope (jump velocity 12.5, gravity 26): a walking jump covers
  // ~5.5 m horizontally while rising ~1.5 m, so every step keeps the centre
  // distance at 2.6-4.0 m and the rise at 0.7-1.3 m. The angle step is
  // derived from the radius (gap / radius) so the spiral stays jumpable
  // from the wide base to the narrow summit.
  while (y < SUMMIT_Y - 2) {
    const zone = zoneAt(y + 1);
    const stepY = zone === 'forest' ? 0.7 + rand() * 0.4 : 0.9 + rand() * 0.4;
    y += stepY;
    const gapTarget = zone === 'forest' ? 2.7 + rand() * 0.8 : 3.0 + rand() * 1.0;
    const radius = mountainRadius(y) + 3.4;
    angle += gapTarget / radius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const size = platformSizeFor(zone, rand);
    let type = 'static';
    if (zone !== 'forest' && index % 7 === 0) type = 'moving';
    else if (zone !== 'forest' && index % 11 === 0) type = 'crumble';
    else if (zone === 'snow' && index % 4 === 0) type = 'ice';
    const p = {
      id: index, x, y, z, w: size.w, d: size.d, h: 1.0, type, zone,
      axis: type === 'moving' ? (rand() < 0.5 ? 'x' : 'z') : null,
      range: type === 'moving' ? 1.6 + rand() * 1.0 : 0,
      speed: type === 'moving' ? 0.55 + rand() * 0.35 : 0,
      phase: rand() * Math.PI * 2,
    };
    platforms.push(p);
    // A coin hangs over the harder jumps (roughly every second platform).
    if (index % 2 === 0 && coinCount < COIN_TOTAL) {
      coins.push({ x: (x + prev.x) / 2, y: y + 1.6, z: (z + prev.z) / 2, taken: false });
      coinCount += 1;
    }
    prev = p;
    index += 1;
  }

  // Summit platform: wide, golden flag, the finish.
  const summitRadius = mountainRadius(SUMMIT_Y) + 3.2;
  angle += 3.2 / summitRadius;
  const summit = {
    id: index, x: Math.cos(angle) * summitRadius, y: SUMMIT_Y,
    z: Math.sin(angle) * summitRadius, w: 7, d: 7, h: 1.2,
    type: 'summit', zone: 'snow', axis: null, range: 0, speed: 0, phase: 0,
  };
  platforms.push(summit);

  // Lava gap in the cliff zone: a molten slab sunk into the GAP between two
  // platforms around y = 40, so a missed jump lands in lava instead of on rock.
  // It never covers a landing platform.
  const lavaPlat = platforms.find((p) => p.y > 39 && p.y < 42);
  const lavaNext = lavaPlat ? platforms[lavaPlat.id + 1] : null;
  if (lavaPlat && lavaNext) {
    hazards.push({
      kind: 'lava',
      x: (lavaPlat.x + lavaNext.x) / 2,
      y: Math.min(lavaPlat.y, lavaNext.y) - 2.6,
      z: (lavaPlat.z + lavaNext.z) / 2,
      w: Math.abs(lavaPlat.x - lavaNext.x) + 4,
      d: Math.abs(lavaPlat.z - lavaNext.z) + 4,
      h: 0.6,
    });
  }

  // Checkpoints: base camp, the cliff camp and the snow camp.
  const checkpoints = [];
  const campHeights = [0.6, 27, 59];
  for (let c = 0; c < campHeights.length; c += 1) {
    let best = platforms[0];
    let bestDist = Infinity;
    for (const p of platforms) {
      const d = Math.abs(p.y - campHeights[c]);
      if (d < bestDist) { bestDist = d; best = p; }
    }
    checkpoints.push({ id: c, platformId: best.id, x: best.x, y: best.y, z: best.z });
  }

  return { platforms, coins, hazards, checkpoints, summit };
}
