// Deterministic screenshot mode: ?shot=climb|start|summit|end&seed=N renders a
// fixed scene (fixed camera, fixed player pose, fixed simulated time, no wall
// clock) and then sets window.__shotReady, so the screenshots are real renders
// of the game and reproducible. The cover is 'climb': mid-ascent gameplay in
// the cliff zone with the summit in view, like the top-10 covers.
import { SUMMIT_Y } from './data/levels.js';

export function parseShot() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return { shot, seed: Number(q.get('seed') || '1') };
}

function platformNearHeight(level, targetY) {
  let best = level.platforms[0];
  let bestD = Infinity;
  for (const p of level.platforms) {
    const d = Math.abs(p.y - targetY);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// Cover platform: near the target height AND on the far side of the mountain
// from the summit (azimuth ~opposite). From there the camera looks across
// the slope at the summit flag rising over the ridge; from a platform on the
// summit's own side the flag sits almost overhead and is cropped out. Stays
// below the snow line (y < 58) so the cover stays a cliff-zone shot. The
// upper cliff also faces the afternoon sun, so the rock reads warm and
// bright instead of the shaded dark face the lower cliff shows.
function platformForCover(level, targetY) {
  const sAng = Math.atan2(level.summit.z, level.summit.x);
  let best = null;
  let bestScore = -Infinity;
  for (const p of level.platforms) {
    // Cap at y <= 57: the topmost cliff platform (y 57.9) spawns the climber
    // at 58.5, just over the snow line, so the HUD would read SNOWY SUMMIT
    // on what is meant to be a cliff-zone cover.
    if (Math.abs(p.y - targetY) > 6 || p.y > 57) continue;
    const a = Math.atan2(p.z, p.x);
    let diff = Math.abs(a - sAng) % (Math.PI * 2);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const score = diff - Math.abs(p.y - targetY) * 0.05;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best || platformNearHeight(level, targetY);
}

export function applyShot(G, name) {
  const { player, level, hud, menu, end } = G;
  const start = level.platforms[0];
  const summit = level.summit;

  // Fixed simulated time so particles, flags and clouds are identical.
  G.time = 12.0;

  // Deterministic wallet and look for every shot: the market demo seeds 200
  // coins and a crimson shirt, and all shots render in one browser context,
  // so without this reset a climb shot rendered after the market shot would
  // show a different wallet balance and shirt colour.
  G.shop.setWallet(0);
  G.state.wallet = 0;
  G.shop.resetVisuals();
  G.applyLoadout();

  if (name === 'start') {
    // Wide establishing shot: the whole 88 m mountain, sky and summit flag
    // behind the title panel. (The old close target at (0,16,20) sat inside
    // the rock, so the panel floated over black.)
    G.state.mode = 'title';
    player.teleport(start.x, start.y + 0.6, start.z);
    player.group.rotation.y = Math.PI;
    G.cameraYaw = 0.6;
    G.cameraPitch = 0.12;
    G.cameraDistance = 85;
    G.cameraTarget = { x: 0, y: 40, z: 0 };
    G.hudEl.classList.add('hidden');
    menu.showTitle(G.state.best);
    end.hideAll();
  } else if (name === 'market') {
    // Title screen with the market popup open on the left. The demo wallet
    // (200 coins) and demo ownership show BUY, EQUIP and EQUIPPED side by
    // side; the title card slides right (body.market-open) so the popup
    // does not cover it.
    G.state.mode = 'title';
    player.teleport(start.x, start.y + 0.6, start.z);
    player.group.rotation.y = Math.PI;
    G.cameraYaw = 0.6;
    G.cameraPitch = 0.12;
    G.cameraDistance = 85;
    G.cameraTarget = { x: 0, y: 40, z: 0 };
    G.hudEl.classList.add('hidden');
    menu.showTitle(G.state.best);
    end.hideAll();
    G.shop.seedDemo();
    G.state.wallet = G.shop.wallet;
    G.applyLoadout();
    G.market.open();
  } else if (name === 'climb') {
    // Cover: mid-ascent in the cliff zone, coins ahead, summit above. The
    // camera sits radially outward from the mountain (never inside the rock)
    // and low, looking up so the summit rises behind the climber.
    const p = platformForCover(level, 52);
    G.state.mode = 'playing';
    G.state.lives = 3;
    G.state.coins = 12;
    G.state.elapsed = 214;
    G.state.checkpoint = 1;
    G.state.maxHeight = Math.floor(p.y);
    player.teleport(p.x, p.y + 0.6, p.z);
    G.cameraYaw = Math.PI / 2 - Math.atan2(p.z, p.x);
    // Steep upward pitch and a slightly longer lens: the camera sits below
    // the climber looking up, so the summit flag (36 m above) stays inside
    // the top of the frame instead of being cropped out.
    G.cameraPitch = -0.60;
    G.cameraDistance = 14;
    // Aim 3 m above the climber: the climber drops to the lower third and
    // the summit flag gets the upper third. (No toast here: it would sit
    // right over the flag.)
    G.cameraTarget = { x: p.x, y: p.y + 3, z: p.z };
    G.hudEl.classList.remove('hidden');
    menu.hideTitle();
    menu.hidePause();
    end.hideAll();
    hud.update(G.state);
  } else if (name === 'summit') {
    G.state.mode = 'playing';
    G.state.lives = 2;
    G.state.coins = 27;
    G.state.elapsed = 452;
    G.state.checkpoint = 2;
    G.state.maxHeight = SUMMIT_Y;
    player.teleport(summit.x - 1.5, summit.y + 0.6, summit.z - 1);
    G.cameraYaw = Math.PI / 2 - Math.atan2(summit.z, summit.x);
    G.cameraPitch = -0.15;
    G.cameraDistance = 14;
    G.cameraTarget = null;
    G.hudEl.classList.remove('hidden');
    menu.hideTitle();
    menu.hidePause();
    end.hideAll();
    hud.update(G.state);
  } else if (name === 'end') {
    // Victory screen with fixed stats.
    G.state.mode = 'victory';
    G.state.lives = 2;
    G.state.coins = 27;
    G.state.elapsed = 452;
    G.state.deaths = 2;
    player.teleport(summit.x - 1.5, summit.y + 0.6, summit.z - 1);
    G.cameraYaw = Math.PI / 2 - Math.atan2(summit.z, summit.x);
    G.cameraPitch = -0.15;
    G.cameraDistance = 14;
    G.cameraTarget = null;
    G.hudEl.classList.add('hidden');
    menu.hideTitle();
    menu.hidePause();
    const score = 5000 + 27 * 200 + 2 * 1000 + Math.max(0, 480 - 452) * 10;
    end.showVictory({
      time: 452, coins: 27, coinTotal: G.state.coinTotal,
      deaths: 2, score, best: Math.max(score, G.state.best),
    });
  } else {
    return false;
  }
  return true;
}
