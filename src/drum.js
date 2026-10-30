// 背景のジャンベ(上から見た絵)の位置計算。DOM に依存しない純粋関数(テスト可能)。

import { LANES, HIT_EFFECT_SEC, DRUM_SIZE_RATIO, DRUM_SKIN_RATIO, DRUM_ZONES } from './constants.js';

/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').Hand} Hand */
/** @typedef {{ result: 'PERFECT' | 'GOOD', at: number } | null} LaneEffect */

/**
 * 太鼓の中心と半径。横はレーン領域の中央、縦は画面上端〜判定ラインの中央に置く。
 * 判定ラインより下(余白・キー表示)には出さないので、layout.js の余白計算には影響しない。
 * @param {number} x0 レーン領域の左端
 * @param {number} areaW レーン領域の幅
 * @param {number} judgeY 判定ラインのy
 * @returns {{ cx: number, cy: number, outerR: number, skinR: number }}
 */
export function drumLayout(x0, areaW, judgeY) {
  const outerR = Math.min(areaW / 2, judgeY / 2) * DRUM_SIZE_RATIO;
  return { cx: x0 + areaW / 2, cy: judgeY / 2, outerR, skinR: outerR * DRUM_SKIN_RATIO };
}

/**
 * 音と手に対応する光る領域(半円環)。角度は canvas の arc 用(0 = 右、時計回り)。
 * 左手 = 左半分(下→左→上)、右手 = 右半分(上→右→下)。低音は rIn = 0 の半円。
 * @param {{ cx: number, cy: number, skinR: number }} drum
 * @param {Sound} sound
 * @param {Hand} hand
 * @returns {{ cx: number, cy: number, rIn: number, rOut: number, a0: number, a1: number }}
 */
export function drumZoneArc(drum, sound, hand) {
  const z = DRUM_ZONES[sound];
  const [a0, a1] = hand === 'L' ? [Math.PI / 2, (Math.PI * 3) / 2] : [-Math.PI / 2, Math.PI / 2];
  return { cx: drum.cx, cy: drum.cy, rIn: z.rIn * drum.skinR, rOut: z.rOut * drum.skinR, a0, a1 };
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
