// 拍(メトロノーム・拍線)の時刻計算。DOM / Web Audio に依存しない純粋関数。
// 拍音(metronome.js)と拍線(renderer.js)が同じ関数を使うので、両者とノーツの位置が食い違わない。

import { LEAD_IN_BARS } from './constants.js';

/** @typedef {import('./types.js').Chart} Chart */
/**
 * 曲時間0 = リードインの先頭。譜面の拍0は leadInBeats 拍目。
 * @typedef {{ bpm: number, beatsPerBar: number, leadInBeats: number, totalBeats: number }} BeatGrid
 */
/** @typedef {{ beat: number, time: number, accent: boolean }} BeatEvent */

// 窓の境界に拍がちょうど乗るとき、浮動小数の誤差で重複/欠落しないための許容
const EPS = 1e-9;

/**
 * 速さ倍率適用済みのChartから格子を作る。
 * @param {Chart} chart
 * @param {number} [leadInBars]
 * @returns {BeatGrid}
 */
export function gridOf(chart, leadInBars = LEAD_IN_BARS) {
  return {
    bpm: chart.bpm,
    beatsPerBar: chart.beatsPerBar,
    leadInBeats: leadInBars * chart.beatsPerBar,
    totalBeats: chart.totalBeats,
  };
}

/**
 * 譜面の拍0の曲時間(秒)= buildPlayNotes に渡すリードイン
 * @param {BeatGrid} grid
 */
export function leadInSec(grid) {
  return (grid.leadInBeats * 60) / grid.bpm;
}

/**
 * 曲時間の半開区間 [fromSec, toSec) にある拍を時刻順に返す。
 * 連続する窓([a,b) [b,c) ...)で呼べば、重複も欠落もなく全拍を1回ずつ得られる。
 * リードイン中の拍はbeatが負。小節頭(accent)は譜面の拍子で判定する。
 * @param {BeatGrid} grid
 * @param {number} fromSec
 * @param {number} toSec
 * @returns {BeatEvent[]}
 */
export function beatsInWindow(grid, fromSec, toSec) {
  const spb = 60 / grid.bpm;
  const count = grid.leadInBeats + Math.ceil(grid.totalBeats - EPS);
  const first = Math.max(0, Math.ceil(fromSec / spb - EPS));
  const end = Math.min(count, Math.ceil(toSec / spb - EPS));
  /** @type {BeatEvent[]} */
  const out = [];
  for (let i = first; i < end; i++) {
    const beat = i - grid.leadInBeats;
    const inBar = ((beat % grid.beatsPerBar) + grid.beatsPerBar) % grid.beatsPerBar;
    out.push({ beat, time: i * spb, accent: inBar === 0 });
  }
  return out;
}
