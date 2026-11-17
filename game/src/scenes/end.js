// Victory and game-over screens with the final stats and restart buttons.
export function createEnd(document_) {
  const victory = document_.getElementById('victory-screen');
  const gameover = document_.getElementById('gameover-screen');

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  return {
    showVictory(stats) {
      document_.getElementById('victory-time').textContent = fmtTime(stats.time);
      document_.getElementById('victory-coins').textContent = `${stats.coins} / ${stats.coinTotal}`;
      document_.getElementById('victory-deaths').textContent = String(stats.deaths);
      document_.getElementById('victory-score').textContent = stats.score.toLocaleString('en-US');
      document_.getElementById('victory-best').textContent = `Best score: ${stats.best.toLocaleString('en-US')}`;
      victory.classList.remove('hidden');
      gameover.classList.add('hidden');
    },
    showGameOver(stats) {
      document_.getElementById('gameover-height').textContent = `${Math.floor(stats.height)} m`;
      document_.getElementById('gameover-coins').textContent = `${stats.coins} / ${stats.coinTotal}`;
      document_.getElementById('gameover-score').textContent = stats.score.toLocaleString('en-US');
      gameover.classList.remove('hidden');
      victory.classList.add('hidden');
    },
    hideAll() {
      victory.classList.add('hidden');
      gameover.classList.add('hidden');
    },
  };
}
