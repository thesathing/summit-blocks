// In-game HUD: height + progress to the summit, timer, coins, lives,
// current checkpoint, current zone, and the wind warning in the snow zone.
import { SUMMIT_Y, zoneAt } from '../data/levels.js';

const ZONE_NAMES = { forest: 'FOREST FOOTHILLS', cliff: 'ROCKY CLIFFS', snow: 'SNOWY SUMMIT' };

export function createHud(document_) {
  const els = {
    height: document_.getElementById('hud-height'),
    heightBar: document_.getElementById('hud-height-bar'),
    timer: document_.getElementById('hud-timer'),
    coins: document_.getElementById('hud-coins'),
    wallet: document_.getElementById('hud-wallet'),
    lives: document_.getElementById('hud-lives'),
    checkpoint: document_.getElementById('hud-checkpoint'),
    zone: document_.getElementById('hud-zone'),
    wind: document_.getElementById('hud-wind'),
    toast: document_.getElementById('hud-toast'),
  };
  let toastTimer = 0;

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return {
    update(state) {
      const h = Math.max(0, Math.floor(state.height));
      els.height.textContent = `${h} m / ${SUMMIT_Y} m`;
      els.heightBar.style.width = `${Math.min(100, (h / SUMMIT_Y) * 100)}%`;
      els.timer.textContent = fmtTime(state.elapsed);
      els.coins.textContent = `${state.coins} / ${state.coinTotal}`;
      els.wallet.textContent = `💰 ${state.wallet}`;
      els.lives.textContent = '♥'.repeat(state.lives) + '♡'.repeat(Math.max(0, (state.maxLives || 3) - state.lives));
      els.checkpoint.textContent = `Checkpoint ${state.checkpoint + 1}/3`;
      els.zone.textContent = ZONE_NAMES[zoneAt(state.height)] || '';
      els.zone.dataset.zone = zoneAt(state.height);
      if (state.windGust) {
        els.wind.classList.remove('hidden');
      } else {
        els.wind.classList.add('hidden');
      }
      if (toastTimer > 0) {
        toastTimer -= 1;
        if (toastTimer <= 0) els.toast.classList.add('hidden');
      }
    },
    toast(text, frames = 150) {
      els.toast.textContent = text;
      els.toast.classList.remove('hidden');
      toastTimer = frames;
    },
  };
}
