import { OFFSET_MIN_MS, OFFSET_MAX_MS } from './constants.js';

/** @typedef {import('./types.js').Counts} Counts */

/** @param {string} id */
function el(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} not found`);
  return e;
}

/**
 * 開始/リザルト/オフセット調整のDOM。ゲーム状態は持たない。
 * @param {{ initialOffsetMs: number, onOffsetChange: (ms: number) => void, onStart: () => void }} p
 */
export function createUi({ initialOffsetMs, onOffsetChange, onStart }) {
  const overlay = el('overlay');
  const title = el('screen-title');
  const result = el('screen-result');
  const slider = /** @type {HTMLInputElement} */ (el('offset-slider'));
  const output = el('offset-output');

  slider.min = String(OFFSET_MIN_MS);
  slider.max = String(OFFSET_MAX_MS);

  /** @param {number} ms */
  const setOffset = (ms) => {
    const v = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Math.round(ms)));
    slider.value = String(v);
    output.textContent = `${v > 0 ? '+' : ''}${v} ms`;
    onOffsetChange(v);
  };
  setOffset(initialOffsetMs);

  slider.addEventListener('input', () => setOffset(Number(slider.value)));
  el('offset-minus').addEventListener('click', () => setOffset(Number(slider.value) - 5));
  el('offset-plus').addEventListener('click', () => setOffset(Number(slider.value) + 5));
  el('start-btn').addEventListener('click', onStart);
  el('retry-btn').addEventListener('click', onStart);

  return {
    showTitle() {
      title.hidden = false;
      result.hidden = true;
      overlay.hidden = false;
    },
    hide() {
      overlay.hidden = true;
    },
    /** @param {{ rank: string, accuracy: number, counts: Counts, score: number, maxCombo: number }} s */
    showResult(s) {
      el('result-rank').textContent = s.rank;
      el('result-accuracy').textContent = `${(s.accuracy * 100).toFixed(1)}%`;
      el('count-perfect').textContent = String(s.counts.PERFECT);
      el('count-good').textContent = String(s.counts.GOOD);
      el('count-missed').textContent = String(s.counts.MISSED);
      el('result-score').textContent = String(s.score);
      el('result-combo').textContent = String(s.maxCombo);
      title.hidden = true;
      result.hidden = false;
      overlay.hidden = false;
    },
  };
}
