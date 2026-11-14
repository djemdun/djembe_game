import { LANES, FLAM_GAP_BEATS, CLAP_LANE_SOUND } from './constants.js';

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
 * 速さ倍率(1 = 譜面どおり)。beatは触らずBPMだけを変えるので、時刻の計算は従来のまま。
 * @param {Chart} chart
 * @param {number} rate
 * @returns {Chart}
 */
export function withSpeed(chart, rate) {
  if (!(rate > 0) || !Number.isFinite(rate)) throw new Error(`invalid speed: ${rate}`);
  return { ...chart, bpm: chart.bpm * rate };
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
        ...(n.autoPlay ? { autoPlay: true } : {}),
      });
    }
    out.push({ ...n, flam: false });
  }
  return out;
}

/**
 * クラップ(カ)を「左手と右手の同時打ち」の2ノーツに展開する。どちらも音は clap のまま、
 * レーンは buildPlayNotes が CLAP_LANE_SOUND(左高と右高)に割り当てる。
 * 手の指定(譜面の位置の奇偶)は両手になるので使わない。
 * @param {ChartNote[]} notes
 * @returns {ChartNote[]}
 */
export function expandClaps(notes) {
  return notes.flatMap((n) => (n.sound === 'clap' ? [{ ...n, hand: /** @type {const} */ ('L') }, { ...n, hand: /** @type {const} */ ('R') }] : [n]));
}

/**
 * 内部形式 → 再生用ノーツ(時刻順)。判定側はこの結果だけを見る。
 * @param {Chart} chart
 * @param {number} leadInSec
 * @returns {PlayNote[]}
 */
export function buildPlayNotes(chart, leadInSec) {
  return expandClaps(expandFlams(chart.notes))
    .map((n) => ({
      time: leadInSec + beatToSec(n.beat, chart.bpm),
      lane: laneOf(n.hand, n.sound === 'clap' ? CLAP_LANE_SOUND : n.sound),
      sound: n.sound,
      autoPlay: n.autoPlay === true,
      result: /** @type {null} */ (null),
    }))
    .sort((a, b) => a.time - b.time);
}
