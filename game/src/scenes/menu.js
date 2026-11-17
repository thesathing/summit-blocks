// Title and pause overlays. The title shows the game name, how to play and
// the best score; the pause screen offers resume / restart / back to title.
export function createMenu(document_) {
  const title = document_.getElementById('title-screen');
  const pause = document_.getElementById('pause-screen');
  const bestEl = document_.getElementById('best-score');
  const titleBest = document_.getElementById('title-best');

  return {
    showTitle(bestScore) {
      title.classList.remove('hidden');
      pause.classList.add('hidden');
      if (bestScore > 0) {
        bestEl.textContent = `Best score: ${bestScore.toLocaleString('en-US')}`;
        titleBest.classList.remove('hidden');
      } else {
        titleBest.classList.add('hidden');
      }
    },
    hideTitle() {
      title.classList.add('hidden');
    },
    showPause() {
      pause.classList.remove('hidden');
    },
    hidePause() {
      pause.classList.add('hidden');
    },
    get titleVisible() {
      return !title.classList.contains('hidden');
    },
  };
}
