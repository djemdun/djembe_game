import { LANES, FLAM_GAP_BEATS } from './constants.js';

/** @typedef {import('./types.js').Chart} Chart */
/** @typedef {import('./types.js').ChartNote} ChartNote */
/** @typedef {import('./types.js').PlayNote} PlayNote */
/** @typedef {import('./types.js').Hand} Hand */
/** @typedef {import('./types.js').Sound} Sound */

/**
 * @param {Hand} hand
 * @param {Sound} sound
 * @returns {number}
 */
export function laneOf(hand, sound) {
  const i = LANES.findIndex((l) => l.hand === hand && l.sound === sound);
  if (i < 0) throw new Error(`no lane for ${hand}/${sound}`);
  return i;
}

/**
 * @param {number} beat
 * @param {number} bpm
 */
export function beatToSec(beat, bpm) {
  return (beat * 60) / bpm;
}

/**
 * フラムを「前打音(反対の手) + 着地音」の2ノーツに展開する。
 * 1ノーツ表示に変える場合はここだけを差し替える。
 * @param {ChartNote[]} notes
 * @returns {ChartNote[]}
 */
export function expandFlams(notes) {
  /** @type {ChartNote[]} */
  const out = [];
  for (const n of notes) {
    if (n.flam) {
      out.push({
        beat: n.beat - FLAM_GAP_BEATS,
        sound: n.sound,
        hand: n.hand === 'L' ? 'R' : 'L',
        flam: false,
      });
    }
    out.push({ ...n, flam: false });
  }
  return out;
}

/**
 * 内部形式 → 再生用ノーツ(時刻順)。判定側はこの結果だけを見る。
 * @param {Chart} chart
 * @param {number} leadInSec
 * @returns {PlayNote[]}
 */
export function buildPlayNotes(chart, leadInSec) {
  return expandFlams(chart.notes)
    .map((n) => ({
      time: leadInSec + beatToSec(n.beat, chart.bpm),
      lane: laneOf(n.hand, n.sound),
      sound: n.sound,
      result: /** @type {null} */ (null),
    }))
    .sort((a, b) => a.time - b.time);
}
