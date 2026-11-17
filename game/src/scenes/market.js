// The market popup for SUMMIT BLOCKS: a left-side panel with the coin
// balance, SKINS / HATS / TRAILS / GEAR tabs and a grid of item cards. Each
// card shows BUY (with its price), EQUIP (owned but not worn) or EQUIPPED /
// ACTIVE. Buying and equipping go through the shop module, so the wallet,
// ownership and loadout stay in localStorage. hooks.onEquip runs after an
// equip so the main loop can repaint the climber.
import { SHOP_CATEGORIES, SHOP_ITEMS } from '../data/shop.js';

export function createMarket(document_, shop, hooks) {
  const panel = document_.getElementById('market');
  const balanceEl = document_.getElementById('market-coins');
  const tabsEl = document_.getElementById('market-tabs');
  const grid = document_.getElementById('market-grid');
  let currentTab = 'skins';
  let open = false;

  function render() {
    balanceEl.textContent = String(shop.wallet);
    for (const tab of tabsEl.querySelectorAll('.market-tab')) {
      tab.classList.toggle('active', tab.dataset.cat === currentTab);
    }
    grid.innerHTML = '';
    for (const item of SHOP_ITEMS.filter((i) => i.cat === currentTab)) {
      const owned = shop.isOwned(item.id);
      const equipped = shop.isEquipped(item.id);
      const card = document_.createElement('div');
      card.className = 'market-item';
      card.dataset.itemId = item.id;

      const swatch = document_.createElement('div');
      swatch.className = 'market-swatch';
      if (item.cat === 'skins') {
        swatch.style.background = item.swatch;
        swatch.textContent = '👕';
      } else {
        swatch.style.background = 'rgba(255,255,255,0.10)';
        swatch.textContent = item.glyph || '—';
      }
      const name = document_.createElement('div');
      name.className = 'market-name';
      name.textContent = item.name;
      const desc = document_.createElement('div');
      desc.className = 'market-desc';
      desc.textContent = item.desc;

      const btn = document_.createElement('button');
      btn.className = 'market-buy';
      btn.dataset.itemId = item.id;
      if (equipped) {
        btn.textContent = item.cat === 'gear' ? '✓ ACTIVE' : '✓ EQUIPPED';
        btn.classList.add('equipped');
        btn.disabled = true;
      } else if (owned) {
        btn.textContent = 'EQUIP';
        btn.classList.add('equip');
        btn.addEventListener('click', () => {
          if (shop.equip(item.id)) {
            if (hooks.onEquip) hooks.onEquip(item.id);
            render();
          }
        });
      } else {
        btn.textContent = `🪙 ${item.price}`;
        if (shop.wallet < item.price) {
          btn.classList.add('disabled');
          btn.disabled = true;
        } else {
          btn.addEventListener('click', () => {
            if (shop.buy(item.id)) {
              if (hooks.onBuy) hooks.onBuy(item.id);
              render();
            }
          });
        }
      }

      card.append(swatch, name, desc, btn);
      grid.appendChild(card);
    }
  }

  for (const tab of tabsEl.querySelectorAll('.market-tab')) {
    tab.addEventListener('click', () => {
      currentTab = tab.dataset.cat;
      render();
    });
  }
  document_.getElementById('market-close').addEventListener('click', () => {
    if (hooks.onClose) hooks.onClose();
  });

  return {
    isOpen() {
      return open;
    },
    open() {
      currentTab = 'skins';
      render();
      panel.classList.remove('hidden');
      document_.body.classList.add('market-open');
      open = true;
    },
    close() {
      panel.classList.add('hidden');
      document_.body.classList.remove('market-open');
      open = false;
    },
    refresh() {
      if (open) render();
    },
  };
}
