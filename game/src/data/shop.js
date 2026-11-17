// Market catalog and persistence for SUMMIT BLOCKS: a coin wallet saved in
// localStorage, owned items, and the equipped loadout (skin / hat / trail /
// gear). Coins earned by climbing go straight into the wallet, and anything
// bought or equipped here is still there after a reload.
export const SHOP_CATEGORIES = [
  { id: 'skins', label: 'SKINS' },
  { id: 'hats', label: 'HATS' },
  { id: 'trails', label: 'TRAILS' },
  { id: 'gear', label: 'GEAR' },
];

// color: three.js hex for the shirt; swatch: CSS colour for the shop card.
// desc is the plain-English effect shown on the card.
export const SHOP_ITEMS = [
  { id: 'skin-default', cat: 'skins', name: 'Default', price: 0, color: 0xe23b3b, swatch: '#e23b3b', desc: 'Classic red shirt.' },
  { id: 'skin-crimson', cat: 'skins', name: 'Crimson', price: 25, color: 0xc81e3a, swatch: '#c81e3a', desc: 'Deep red shirt.' },
  { id: 'skin-ocean', cat: 'skins', name: 'Ocean Blue', price: 25, color: 0x1e6fd9, swatch: '#1e6fd9', desc: 'Bright blue shirt.' },
  { id: 'skin-forest', cat: 'skins', name: 'Forest Green', price: 25, color: 0x2f9e44, swatch: '#2f9e44', desc: 'Leaf green shirt.' },
  { id: 'skin-royal', cat: 'skins', name: 'Royal Purple', price: 40, color: 0x7b2fbe, swatch: '#7b2fbe', desc: 'Royal purple shirt.' },
  { id: 'skin-golden', cat: 'skins', name: 'Golden', price: 150, color: 0xf5c542, swatch: '#f5c542', desc: 'Solid gold shirt.' },
  { id: 'hat-none', cat: 'hats', name: 'None', price: 0, glyph: '—', desc: 'No hat.' },
  { id: 'hat-cap', cat: 'hats', name: 'Cap', price: 20, glyph: '🧢', desc: 'A sturdy green cap.' },
  { id: 'hat-crown', cat: 'hats', name: 'Crown', price: 100, glyph: '👑', desc: 'A golden crown.' },
  { id: 'hat-helmet', cat: 'hats', name: 'Helmet', price: 50, glyph: '⛑', desc: 'A steel climbing helmet.' },
  { id: 'hat-party', cat: 'hats', name: 'Party Hat', price: 30, glyph: '🎉', desc: 'A party hat for the summit.' },
  { id: 'trail-none', cat: 'trails', name: 'None', price: 0, glyph: '—', desc: 'No trail.' },
  { id: 'trail-sparkle', cat: 'trails', name: 'Sparkle', price: 30, glyph: '✨', desc: 'Golden sparkles while moving.' },
  { id: 'trail-snow', cat: 'trails', name: 'Snowflakes', price: 40, glyph: '❄️', desc: 'Snowflakes while moving.' },
  { id: 'trail-embers', cat: 'trails', name: 'Embers', price: 40, glyph: '🔥', desc: 'Burning embers while moving.' },
  { id: 'gear-life', cat: 'gear', name: 'Extra Life', price: 80, glyph: '❤️', desc: 'Start every run with 4 lives.' },
  { id: 'gear-magnet', cat: 'gear', name: 'Coin Magnet', price: 60, glyph: '🧲', desc: 'Coins are pulled in from farther away.' },
  { id: 'gear-jump', cat: 'gear', name: 'Double Jump', price: 100, glyph: '🪽', desc: 'Jump a second time in mid-air.' },
];

export const DEFAULT_EQUIPPED = { skin: 'skin-default', hat: 'hat-none', trail: 'trail-none' };
const DEFAULT_OWNED = ['skin-default', 'hat-none', 'trail-none'];
// Category ids are plural (skins/hats/trails); the equipped slots are
// singular (skin/hat/trail). Mixing them up stores the equip where nothing
// reads it, so the shop would show EQUIPPED while the climber never changed.
const CAT_KEY = { skins: 'skin', hats: 'hat', trails: 'trail' };

const WALLET_KEY = 'summitblocks.wallet';
const LOADOUT_KEY = 'summitblocks.loadout';

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function createShop() {
  let wallet = 0;
  try {
    wallet = Number(window.localStorage.getItem(WALLET_KEY) || '0') || 0;
  } catch {
    wallet = 0;
  }
  let loadout = readJson(LOADOUT_KEY, null);
  if (!loadout || !Array.isArray(loadout.owned) || !loadout.equipped) {
    loadout = { owned: [...DEFAULT_OWNED], equipped: { ...DEFAULT_EQUIPPED }, gear: [] };
  }

  function saveWallet() {
    try {
      window.localStorage.setItem(WALLET_KEY, String(wallet));
    } catch {
      /* storage unavailable */
    }
  }
  function saveLoadout() {
    writeJson(LOADOUT_KEY, loadout);
  }

  return {
    get wallet() {
      return wallet;
    },
    get owned() {
      return [...loadout.owned];
    },
    get equipped() {
      return { ...loadout.equipped };
    },
    get gear() {
      return [...loadout.gear];
    },
    item(id) {
      return SHOP_ITEMS.find((i) => i.id === id) || null;
    },
    isOwned(id) {
      return loadout.owned.includes(id) || loadout.gear.includes(id);
    },
    isEquipped(id) {
      const item = this.item(id);
      if (!item) return false;
      if (item.cat === 'gear') return loadout.gear.includes(id);
      return loadout.equipped[CAT_KEY[item.cat]] === id;
    },
    isGearActive(id) {
      return loadout.gear.includes(id);
    },
    add(n) {
      wallet += n;
      saveWallet();
    },
    setWallet(n) {
      wallet = Math.max(0, Math.floor(n));
      saveWallet();
    },
    buy(id) {
      const item = this.item(id);
      if (!item || this.isOwned(id) || wallet < item.price) return false;
      wallet -= item.price;
      if (item.cat === 'gear') loadout.gear.push(id);
      else loadout.owned.push(id);
      saveWallet();
      saveLoadout();
      return true;
    },
    equip(id) {
      const item = this.item(id);
      if (!item || !this.isOwned(id)) return false;
      if (item.cat === 'gear') {
        if (!loadout.gear.includes(id)) loadout.gear.push(id);
      } else {
        loadout.equipped[CAT_KEY[item.cat]] = id;
      }
      saveLoadout();
      return true;
    },
    // Deterministic demo state for the market screenshot: a 200-coin wallet,
    // one owned skin (equipped) and one owned hat, so the popup shows BUY,
    // EQUIP and EQUIPPED states side by side.
    seedDemo() {
      wallet = 200;
      loadout = {
        owned: ['skin-default', 'hat-none', 'trail-none', 'skin-crimson', 'hat-cap'],
        equipped: { skin: 'skin-crimson', hat: 'hat-none', trail: 'trail-none' },
        gear: [],
      };
      saveWallet();
      saveLoadout();
    },
    // Back to the default look, in memory only: the screenshot scenes must
    // render the same climber no matter what the market demo (or a player)
    // left in localStorage. Does not touch saved data. Gear is reset too:
    // an equipped Coin Magnet widens the collect radius from 1.2 m to 4.5 m,
    // so a staged climber standing near a coin would collect it during the
    // shot's fixed steps (13 coins, wallet 1, "+1" toast) on one render and
    // not on the next, and the cover would not be byte-identical.
    resetVisuals() {
      loadout = {
        owned: [...loadout.owned],
        equipped: { ...DEFAULT_EQUIPPED },
        gear: [],
      };
    },
  };
}
