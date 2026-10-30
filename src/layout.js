// canvas のレイアウト計算。DOM に依存しない純粋関数(テスト可能)。

import { LANE_COUNT, NOTE_RADIUS_MAX, NOTE_RADIUS_RATIO, HIT_RING_START, HIT_RING_GROW, HIT_RING_LINE_MAX } from './constants.js';

export const MAX_LANES_WIDTH = 720;
/** 判定ラインの縦位置(canvas高さに対する割合)。ノーツの落下距離・判定帯の幅はこの値から決まる */
export const JUDGE_Y_RATIO = 0.8;

/** ノーツ(と判定ライン上のエフェクト)の基準半径 @param {number} laneW */
export function noteRadius(laneW) {
  return Math.min(laneW * NOTE_RADIUS_RATIO, NOTE_RADIUS_MAX);
}

/**
 * ヒットエフェクトのリングが最大に広がったときの外縁の半径(線幅の半分を含む)。
 * エフェクトのサイズ定数(HIT_RING_*)を変えると、これに追従して下の余白も変わる。
 * @param {number} r 基準半径
 */
export function hitRingMaxRadius(r) {
  return r * (HIT_RING_START + HIT_RING_GROW) + HIT_RING_LINE_MAX / 2;
}

/**
 * @param {number} cssW
 * @param {number} cssH
 * @returns {{ areaW: number, x0: number, laneW: number, judgeY: number, noteR: number,
 *   ringMargin: number, labelTop: number, labelH: number }}
 *   ringMargin: 判定ラインの下に確保する余白(リングが切れない高さ)
 *   labelTop/labelH: キー表示の帯の位置。余白の下から canvas の下端まで
 */
export function computeLayout(cssW, cssH) {
  const areaW = Math.min(cssW, MAX_LANES_WIDTH);
  const laneW = areaW / LANE_COUNT;
  const judgeY = cssH * JUDGE_Y_RATIO;
  const noteR = noteRadius(laneW);
  const ringMargin = Math.ceil(hitRingMaxRadius(noteR));
  const labelTop = Math.min(judgeY + ringMargin, cssH);
  return { areaW, x0: (cssW - areaW) / 2, laneW, judgeY, noteR, ringMargin, labelTop, labelH: cssH - labelTop };
}
