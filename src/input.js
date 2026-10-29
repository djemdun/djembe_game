import { LANES } from './constants.js';

/**
 * キーボードとPointer Eventsを「レーン入力」に正規化する。
 * - Pointer Events: マウス/タッチ/ペンを統一でき、タッチは指ごとにpointerdownが来るのでマルチタッチになる
 * - event.timeStamp(入力が発生した時刻)を渡す。ハンドラ実行までの遅れを呼び出し側で補正できる
 *
 * @param {object} p
 * @param {HTMLElement} p.target
 * @param {(clientX: number) => number} p.laneAt 座標→レーン(範囲外は-1)
 * @param {(lane: number, eventTimeStamp: number) => void} p.onHit
 */
export function attachInput({ target, laneAt, onHit }) {
  const keyToLane = new Map(LANES.map((l, i) => [l.code, i]));

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const lane = keyToLane.get(e.code);
    if (lane === undefined) return;
    e.preventDefault();
    onHit(lane, e.timeStamp);
  });

  target.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const lane = laneAt(e.clientX);
    if (lane >= 0) onHit(lane, e.timeStamp);
  });
}
