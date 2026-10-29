// セクション名([合図] など)の表示タイミング。DOM / canvas に依存しない純粋関数。

import {
  FALL_SEC,
  SECTION_FADE_IN_SEC,
  SECTION_LABEL_BARS,
  SECTION_FADE_OUT_SEC,
} from './constants.js';
import { beatToSec } from './chart.js';

/** @typedef {import('./types.js').Chart} Chart */
/**
 * @typedef {object} SectionLabel
 * @property {string} name
 * @property {number} time セクション開始の曲時間(秒)
 * @property {number} showAt 表示を始める曲時間(秒)
 * @property {number} duration 表示全体の長さ(秒)。文字譜の1行分の演奏時間
 */

/**
 * 速さ倍率適用済みのChartから表示用ラベルを作る。
 * 表示開始は「セクション先頭のノーツが画面上端に現れる時刻」= 開始の FALL_SEC 前。
 * 曲の冒頭は 0 未満にならないよう丸める(フェードインを最初から見せる)。
 * 表示の長さは SECTION_LABEL_BARS 小節ぶんの秒数(BPM・倍率に応じて伸縮)。
 * @param {Chart} chart
 * @param {number} leadInSec
 * @returns {SectionLabel[]}
 */
export function sectionLabels(chart, leadInSec) {
  // フェードの合計より短いと山形にならないので下限を置く
  const duration = Math.max(
    beatToSec(SECTION_LABEL_BARS * chart.beatsPerBar, chart.bpm),
    SECTION_FADE_IN_SEC + SECTION_FADE_OUT_SEC,
  );
  return (chart.sections ?? []).map((s) => {
    const time = leadInSec + beatToSec(s.beat, chart.bpm);
    return { name: s.name, time, showAt: Math.max(0, time - FALL_SEC), duration };
  });
}

/**
 * 表示開始からの経過秒 → 不透明度(0..1)。フェードイン → 保持 → フェードアウト。
 * @param {number} ageSec
 * @param {number} duration 表示全体の長さ(秒)
 */
export function labelAlpha(ageSec, duration) {
  if (ageSec < 0 || ageSec >= duration) return 0;
  if (ageSec < SECTION_FADE_IN_SEC) return ageSec / SECTION_FADE_IN_SEC;
  const fadeOutStart = duration - SECTION_FADE_OUT_SEC;
  if (ageSec < fadeOutStart) return 1;
  return 1 - (ageSec - fadeOutStart) / SECTION_FADE_OUT_SEC;
}

/**
 * 現在表示すべきラベル。複数が重なる(短いセクション)ときは、より後に始まったものを優先する。
 * @param {SectionLabel[]} labels showAt 昇順
 * @param {number} t 曲時間(秒)
 * @returns {{ name: string, alpha: number } | null}
 */
export function activeLabel(labels, t) {
  /** @type {{ name: string, alpha: number } | null} */
  let found = null;
  for (const l of labels) {
    if (l.showAt > t) break;
    const alpha = labelAlpha(t - l.showAt, l.duration);
    if (alpha > 0) found = { name: l.name, alpha };
  }
  return found;
}
