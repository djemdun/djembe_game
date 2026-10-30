// 背景のジャンベ(上から見た絵の下半分)の位置計算。DOM に依存しない純粋関数(テスト可能)。

import { LANES, LANE_COUNT, HIT_EFFECT_SEC, DRUM_MAX_DEPTH_RATIO } from './constants.js';

/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').Hand} Hand */
/** @typedef {{ result: 'PERFECT' | 'GOOD', at: number } | null} LaneEffect */
/** @typedef {{ cx: number, cy: number, rx: number, ry: number, x0: number, laneW: number }} DrumLayout */

/**
 * 太鼓(半楕円)の配置。横はレーン領域いっぱい、下端は判定ライン。平らな側(上辺)が太鼓の中心線で、
 * その上は描かない(普段叩くのは中心から下側だけ)。奥行き ry は幅の半分(= 半円)を上限に、
 * 判定ラインまでの高さに収まるよう縮める(横長の画面では半楕円になる)。
 * 光る位置は x 方向がレーンの帯と一致する必要があるので、幅は縮めず奥行きだけ縮める。
 * @param {number} x0 レーン領域の左端
 * @param {number} areaW レーン領域の幅
 * @param {number} judgeY 判定ラインのy
 * @returns {DrumLayout}
 */
export function drumLayout(x0, areaW, judgeY) {
  const rx = areaW / 2;
  const ry = Math.min(rx, judgeY * DRUM_MAX_DEPTH_RATIO);
  return { cx: x0 + rx, cy: judgeY - ry, rx, ry, x0, laneW: areaW / LANE_COUNT };
}

/**
 * レーンに対応する光る領域の横範囲。ノーツが落ちるレーンの帯そのもの。
 * 左から 高・中・低 | 低・中・高 なので、中央が低音、外側が高音、左手が左半分・右手が右半分になる。
 * 実際に光るのは、この帯と太鼓(半楕円)の重なり部分。
 * @param {DrumLayout} drum
 * @param {number} lane
 * @returns {{ x: number, w: number }}
 */
export function drumLaneColumn(drum, lane) {
  return { x: drum.x0 + lane * drum.laneW, w: drum.laneW };
}

/**
 * 今光っているレーン。条件と長さはヒットエフェクトと同じ(PERFECT/GOOD のみ、HIT_EFFECT_SEC 秒)。
 * 時刻 t は呼び出し側の曲時間(AudioContext.currentTime 基準)。
 * @param {LaneEffect[]} laneEffects レーンごとの最後のヒット(Game.laneEffects)
 * @param {number} t 曲時間(秒)
 * @returns {{ lane: number, sound: Sound, hand: Hand, result: 'PERFECT' | 'GOOD', fade: number }[]}
 *   fade: 1(叩いた瞬間)→ 0(消える)
 */
export function activeGlows(laneEffects, t) {
  const out = [];
  for (let lane = 0; lane < LANES.length; lane++) {
    const fx = laneEffects[lane];
    if (!fx) continue;
    const age = t - fx.at;
    if (age < 0 || age >= HIT_EFFECT_SEC) continue;
    out.push({ lane, sound: LANES[lane].sound, hand: LANES[lane].hand, result: fx.result, fade: 1 - age / HIT_EFFECT_SEC });
  }
  return out;
}
