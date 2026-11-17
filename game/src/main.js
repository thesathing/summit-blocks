// SUMMIT BLOCKS — a blocky 3D mountain climb (obby). Entry point: renderer,
// state machine (title / playing / paused / victory / gameover), camera,
// wind, lives, checkpoints, coins, HUD wiring and the deterministic shot mode.
import * as THREE from 'three';
import { createClock } from './engine/loop.js';
import { createInput } from './engine/input.js';
import { createAudio } from './engine/audio.js';
import { platformTop } from './engine/physics.js';
import { buildLevel, SUMMIT_Y, COIN_TOTAL, zoneAt } from './data/levels.js';
import { createSky } from './world/sky.js';
import { createMountain } from './world/mountain.js';
import { createProps } from './world/props.js';
import { createPlayer } from './entities/player.js';
import { createCoins } from './entities/coin.js';
import { createCheckpoints } from './entities/checkpoint.js';
import { createMenu } from './scenes/menu.js';
import { createHud } from './scenes/play.js';
import { createEnd } from './scenes/end.js';
import { createMarket } from './scenes/market.js';
import { createShop, SHOP_ITEMS } from './data/shop.js';
import { createTrail } from './entities/trail.js';
import { parseShot, applyShot } from './shots.js';

const BEST_KEY = 'summitblocks-best';

function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage unavailable */
  }
}

const app = document.getElementById('app');
const hudEl = document.getElementById('hud');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
// Start at the title orbit's position, never at the default (0,0,0) — that
// point is inside the mountain, so the first frames would be black rock.
camera.position.set(0, 34, 70);

const level = buildLevel(20261117);
const sky = createSky(scene);
const mountain = createMountain(scene, level);
const props = createProps(scene, level);
const player = createPlayer(scene);
const coinsApi = createCoins(scene, level.coins);
const checkpointsApi = createCheckpoints(level.checkpoints);
const input = createInput(renderer.domElement);
const audio = createAudio();
const menu = createMenu(document);
const hud = createHud(document);
const end = createEnd(document);
const shop = createShop();
const trail = createTrail(scene);
const clock = createClock();

const state = {
  mode: 'title',
  lives: 3,
  maxLives: 3,
  coins: 0,
  coinTotal: COIN_TOTAL,
  wallet: shop.wallet,
  elapsed: 0,
  deaths: 0,
  checkpoint: 0,
  maxHeight: 0,
  height: 0,
  windGust: false,
  best: loadBest(),
  muted: false,
};

const G = {
  state, player, level, hud, menu, end, hudEl, shop, trail,
  time: 0, cameraYaw: 0, cameraPitch: 0.22, cameraDistance: 9, cameraTarget: null,
  shotMode: false,
};

// Paint the climber from the saved loadout: shirt colour, hat, trail and the
// Double Jump gear. Called on boot, on every equip and at the start of a run.
function applyLoadout() {
  const skin = SHOP_ITEMS.find((i) => i.id === shop.equipped.skin);
  if (skin) player.setSkin(skin.color);
  player.setHat(shop.equipped.hat);
  trail.setTrail(shop.equipped.trail);
  player.setDoubleJump(shop.isGearActive('gear-jump'));
}

const market = createMarket(document, shop, {
  onEquip: () => applyLoadout(),
  onClose: () => closeMarket(),
});
G.market = market;
G.applyLoadout = applyLoadout;

let cameraYaw = 0;
let cameraPitch = 0.22;
let cameraDistance = 9;
let windPhase = 0;
let fallCooldown = 0;

function scoreFor() {
  return 5000 + state.coins * 200 + state.lives * 1000 + Math.max(0, 480 - Math.floor(state.elapsed)) * 10;
}

function respawnAtCheckpoint() {
  const cp = checkpointsApi.current;
  player.respawn(cp.x, cp.y + 0.7, cp.z);
  cameraYaw = Math.atan2(-(0 - cp.x), -(0 - cp.z));
  cameraPitch = 0.22;
}

// The market pauses live play while it is open (the pause overlay stays
// hidden); closing it resumes the run. From the title or pause screen it
// just overlays. marketFrom remembers where the player came from.
let marketFrom = null;
function openMarket() {
  if (market.isOpen()) return;
  audio.click();
  marketFrom = state.mode === 'playing' ? 'playing' : state.mode === 'paused' ? 'paused' : 'title';
  if (state.mode === 'playing') state.mode = 'paused';
  market.open();
}
function closeMarket() {
  if (!market.isOpen()) return;
  market.close();
  if (marketFrom === 'playing') state.mode = 'playing';
  marketFrom = null;
}

function startRun() {
  audio.unlock();
  audio.click();
  if (market.isOpen()) closeMarket();
  applyLoadout();
  state.mode = 'playing';
  // Extra Life gear: start with 4 lives instead of 3.
  state.maxLives = shop.isGearActive('gear-life') ? 4 : 3;
  state.lives = state.maxLives;
  state.coins = 0;
  state.elapsed = 0;
  state.deaths = 0;
  state.maxHeight = 0;
  state.height = 0;
  state.windGust = false;
  fallCooldown = 0;
  checkpointsApi.reset();
  coinsApi.reset();
  props.flags.forEach((f) => { f.active = false; });
  const start = level.platforms[0];
  const next = level.platforms[1];
  player.respawn(start.x, start.y + 0.7, start.z);
  // Aim the camera (and therefore W) at the first jump: a new climber heads
  // toward the mountain instead of walking off the back of the base camp
  // deck. Forward is (-sin yaw, -cos yaw), so yaw = atan2(-dx, -dz).
  cameraYaw = Math.atan2(-(next.x - start.x), -(next.z - start.z));
  cameraPitch = 0.22;
  menu.hideTitle();
  menu.hidePause();
  end.hideAll();
  hudEl.classList.remove('hidden');
  input.clear();
}

function goTitle() {
  audio.click();
  if (market.isOpen()) closeMarket();
  state.mode = 'title';
  end.hideAll();
  menu.hidePause();
  menu.showTitle(state.best);
  hudEl.classList.add('hidden');
  input.clear();
}

function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  menu.showPause();
}
function resumeGame() {
  if (state.mode !== 'paused') return;
  audio.unlock();
  audio.click();
  state.mode = 'playing';
  menu.hidePause();
}

function winGame() {
  state.mode = 'victory';
  const score = scoreFor();
  if (score > state.best) {
    state.best = score;
    saveBest(score);
  }
  audio.victory();
  end.showVictory({
    time: state.elapsed, coins: state.coins, coinTotal: state.coinTotal,
    deaths: state.deaths, score, best: state.best,
  });
  hudEl.classList.add('hidden');
}

function loseGame() {
  state.mode = 'gameover';
  audio.gameover();
  end.showGameOver({
    height: state.maxHeight, coins: state.coins,
    coinTotal: state.coinTotal, score: scoreFor(),
  });
  hudEl.classList.add('hidden');
}

function loseLife(reason) {
  if (state.mode !== 'playing' || fallCooldown > 0) return;
  fallCooldown = 1.0;
  state.lives -= 1;
  state.deaths += 1;
  audio.fall();
  if (state.lives <= 0) {
    loseGame();
    return;
  }
  hud.toast(reason === 'lava' ? '🔥 Lava! -1 life' : '💨 Fell! -1 life');
  respawnAtCheckpoint();
}

// Where the camera should be this frame, from the live yaw/pitch/distance
// and either a fixed target (staged shots) or the player.
function cameraFrame() {
  let target;
  if (G.cameraTarget) {
    target = G.cameraTarget;
  } else {
    const p = player.pos;
    target = { x: p.x, y: p.y + 1.6 + cameraPitch * 4, z: p.z };
  }
  const dist = cameraDistance;
  return {
    target,
    pos: new THREE.Vector3(
      target.x + Math.sin(cameraYaw) * Math.cos(cameraPitch) * dist,
      target.y + Math.sin(cameraPitch) * dist + 1.2,
      target.z + Math.cos(cameraYaw) * Math.cos(cameraPitch) * dist,
    ),
  };
}

function updateCamera(dt) {
  // In shot mode the camera is staged (placeCamera) and must not drift: no
  // mouse-look, and no pitch clamp — the cover needs a steeper upward pitch
  // (-0.60) than live play allows, to keep the summit flag in frame.
  if (!G.shotMode) {
    const look = input.consumeLook();
    cameraYaw += look.yaw;
    cameraPitch = Math.max(-0.45, Math.min(0.85, cameraPitch + look.pitch));
  }
  G.cameraYaw = cameraYaw;
  G.cameraPitch = cameraPitch;
  G.cameraDistance = cameraDistance;
  const { target, pos } = cameraFrame();
  camera.position.lerp(pos, Math.min(1, dt * 8));
  camera.lookAt(target.x, target.y, target.z);
}

// Snap the camera exactly onto its staged spot (no lerp): shot mode renders
// only a few fixed frames, so a lerped camera would still be travelling from
// its previous position — from inside the mountain — when the shot is taken.
function placeCamera() {
  const { target, pos } = cameraFrame();
  camera.position.copy(pos);
  camera.lookAt(target.x, target.y, target.z);
}

function updateWind(dt) {
  const inSnow = player.pos.y > 58;
  windPhase += dt;
  const cycle = windPhase % 6;
  const gust = inSnow && cycle > 2.5 && cycle < 4.2;
  state.windGust = gust;
  audio.setWind(gust ? 1 : inSnow ? 0.4 : 0.1);
  return { x: gust ? 7 : inSnow ? 1.2 : 0, z: 0 };
}

function step(dt) {
  G.time += dt;
  const t = G.time;
  if (fallCooldown > 0) fallCooldown -= dt;

  // World motion always runs (title orbit included).
  const standingOn = player.ground ? player.ground.id : null;
  mountain.update(dt, t, standingOn);
  props.update(dt, t, player.pos);

  if (state.mode === 'title') {
    if (G.cameraTarget) {
      // Staged title shot: fixed framing, not the orbit.
      updateCamera(dt);
      sky.update(dt, t, { x: 0, y: 30, z: 0 });
      renderer.render(scene, camera);
      return;
    }
    cameraYaw += dt * 0.05;
    const tx = 0;
    const ty = 30;
    const tz = 0;
    camera.position.lerp(new THREE.Vector3(Math.sin(cameraYaw) * 70, 34, Math.cos(cameraYaw) * 70), Math.min(1, dt * 2));
    camera.lookAt(tx, ty, tz);
    sky.update(dt, t, { x: 0, y: 30, z: 0 });
    renderer.render(scene, camera);
    return;
  }

  if (state.mode === 'playing') {
    state.elapsed += dt;
    const wind = updateWind(dt);
    const events = player.update(dt, input, cameraYaw, level.platforms, wind);
    if (events.landed) audio.land();
    if (events.stepped) audio.step();
    audio.updateMusic(dt, true);
    trail.update(dt, player.pos, player.speed2d > 0.5, player.onGround);

    state.height = player.pos.y;
    if (state.height > state.maxHeight) state.maxHeight = state.height;

    // Coin Magnet gear pulls coins in from farther away.
    const collectRadius = shop.isGearActive('gear-magnet') ? 4.5 : 1.2;
    const coin = coinsApi.tryCollect(player.pos.x, player.pos.y, player.pos.z, collectRadius);
    if (coin) {
      state.coins += 1;
      // A collected coin goes straight into the wallet — spend it in the
      // market on skins, hats, trails and gear.
      shop.add(1);
      state.wallet = shop.wallet;
      hud.toast('+1 🪙', 45);
      audio.coin();
    }
    const cp = checkpointsApi.tryActivate(player.pos.x, player.pos.y, player.pos.z);
    if (cp) {
      state.checkpoint = checkpointsApi.index;
      props.setFlagActive(cp.id);
      audio.checkpoint();
      hud.toast(`🚩 Checkpoint ${cp.id + 1} reached!`);
    }
    coinsApi.update(dt, t);

    // Fell below the checkpoint's safety line.
    const cpNow = checkpointsApi.current;
    if (player.pos.y < cpNow.y - 22) {
      loseLife('fall');
    }
    // Lava touch.
    for (const h of level.hazards) {
      const feet = player.pos.y;
      if (
        Math.abs(player.pos.x - h.x) < h.w / 2 + 0.3
        && Math.abs(player.pos.z - h.z) < h.d / 2 + 0.3
        && feet < h.y + h.h && feet > h.y - 2.5
      ) {
        loseLife('lava');
        break;
      }
    }
    // Summit: standing on the summit platform wins the run. Not in shot
    // mode: the staged summit shot poses the climber on the flag platform,
    // and winning there would replace the gameplay frame with the victory
    // panel (the shot's job is to show the climb, not the overlay).
    if (!G.shotMode && player.ground && player.ground.type === 'summit' && player.onGround) {
      winGame();
    }
    sky.update(dt, t, player.pos);
    updateCamera(dt);
    hud.update(state);
    renderer.render(scene, camera);
    return;
  }

  // Paused / victory / gameover: keep the world visible, frozen.
  sky.update(dt, t, player.pos);
  updateCamera(dt);
  renderer.render(scene, camera);
}

function loop() {
  const dt = clock.tick();
  step(dt);
  window.requestAnimationFrame(loop);
}

// ---- Input: buttons and hotkeys ----
document.getElementById('btn-market-title').addEventListener('click', openMarket);
document.getElementById('btn-market-pause').addEventListener('click', openMarket);
document.getElementById('btn-market').addEventListener('click', openMarket);
document.getElementById('btn-start').addEventListener('click', startRun);
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-restart-pause').addEventListener('click', startRun);
document.getElementById('btn-title-pause').addEventListener('click', goTitle);
document.getElementById('btn-again').addEventListener('click', startRun);
document.getElementById('btn-menu-victory').addEventListener('click', goTitle);
document.getElementById('btn-retry').addEventListener('click', startRun);
document.getElementById('btn-menu-gameover').addEventListener('click', goTitle);
document.getElementById('btn-pause').addEventListener('click', () => {
  if (state.mode === 'playing') pauseGame();
  else if (state.mode === 'paused') resumeGame();
});
document.getElementById('btn-mute').addEventListener('click', (e) => {
  state.muted = !state.muted;
  audio.setMuted(state.muted);
  e.currentTarget.textContent = state.muted ? '🔇' : '🔊';
});
window.addEventListener('keydown', (e) => {
  // While the market is open it owns Esc and B: Esc (or B again) closes it
  // instead of pausing, and P does nothing until it is closed.
  if (market.isOpen()) {
    if (e.code === 'Escape' || e.code === 'KeyB') closeMarket();
    return;
  }
  if (e.code === 'KeyB') {
    if (state.mode === 'title' || state.mode === 'playing' || state.mode === 'paused') openMarket();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'playing') pauseGame();
    else if (state.mode === 'paused') resumeGame();
  } else if (e.code === 'KeyR') {
    if (state.mode === 'playing' || state.mode === 'paused' || state.mode === 'victory' || state.mode === 'gameover') startRun();
  } else if (e.code === 'KeyM') {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    document.getElementById('btn-mute').textContent = state.muted ? '🔇' : '🔊';
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Test / debug hooks (used by the Playwright checks, not by the game) ----
window.__game = {
  get mode() { return state.mode; },
  get lives() { return state.lives; },
  get coins() { return state.coins; },
  get coinTotal() { return state.coinTotal; },
  get elapsed() { return state.elapsed; },
  get height() { return state.height; },
  get maxHeight() { return state.maxHeight; },
  get checkpoint() { return state.checkpoint; },
  get deaths() { return state.deaths; },
  get best() { return state.best; },
  get wallet() { return shop.wallet; },
  get shirtColor() { return player.getShirtColor(); },
  get hat() { return player.getHat(); },
  get hatMeshes() { return player.getHatMeshCount(); },
  get marketOpen() { return market.isOpen(); },
  get owned() { return shop.owned; },
  get equipped() { return shop.equipped; },
  get gear() { return shop.gear; },
  get player() { return { x: player.pos.x, y: player.pos.y, z: player.pos.z, onGround: player.onGround }; },
  get platforms() { return level.platforms.length; },
  get summit() { return { x: level.summit.x, y: level.summit.y, z: level.summit.z }; },
  get coinPositions() {
    return coinsApi.list.filter((c) => !c.taken).slice(0, 6).map((c) => ({
      x: c.group.position.x, y: c.group.position.y, z: c.group.position.z,
    }));
  },
  get checkpointPositions() {
    return level.checkpoints.map((c) => ({ x: c.x, y: c.y, z: c.z }));
  },
  get platformNear() {
    return (y) => {
      let best = level.platforms[0];
      let bestD = Infinity;
      for (const p of level.platforms) {
        const d = Math.abs(p.y - y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return { x: best.x, y: best.y, z: best.z, type: best.type };
    };
  },
};
window.__debug = {
  teleport(x, y, z) { player.teleport(x, y, z); },
  setLives(n) { state.lives = n; },
  setCoins(n) { state.coins = n; },
  setWallet(n) { shop.setWallet(n); state.wallet = shop.wallet; },
  openMarket() { openMarket(); },
  closeMarket() { closeMarket(); },
  win() { winGame(); },
  loseLife() { loseLife('fall'); },
  start() { startRun(); },
};
window.__scene = scene;
window.__rendererInfo = () => ({
  calls: renderer.info.render.calls,
  triangles: renderer.info.render.triangles,
  geometries: renderer.info.memory.geometries,
  textures: renderer.info.memory.textures,
});
window.render_game_to_text = () => JSON.stringify({
  mode: state.mode, lives: state.lives, coins: state.coins, wallet: state.wallet,
  coinTotal: state.coinTotal, platforms: level.platforms.length,
  height: Math.floor(state.height), maxHeight: Math.floor(state.maxHeight),
  checkpoint: state.checkpoint, deaths: state.deaths,
  elapsed: Math.floor(state.elapsed),
});

// ---- Boot ----
applyLoadout();
const shot = parseShot();
if (shot) document.documentElement.classList.add('shot');
if (shot) {
  // Deterministic shot mode: fixed scene, a few fixed frames, then ready.
  G.shotMode = true;
  menu.showTitle(state.best);
  applyShot(G, shot.shot);
  // Sync the shot's staged camera into the live camera state, then snap the
  // camera onto it at once: with only 4 fixed steps the lerp in
  // updateCamera would leave it travelling from the title orbit (or the
  // origin, inside the mountain) when the screenshot is taken.
  cameraYaw = G.cameraYaw;
  cameraPitch = G.cameraPitch;
  cameraDistance = G.cameraDistance;
  placeCamera();
  // The climb/summit shots stage the player mid-pose: give the walk cycle a
  // fixed phase so the limbs read the same on every render.
  for (let i = 0; i < 4; i += 1) {
    step(1 / 60);
  }
  window.__shotReady = true;
} else {
  menu.showTitle(state.best);
  window.requestAnimationFrame(loop);
}
