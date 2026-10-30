import {
  PERFECT_WINDOW_MS,
  GOOD_WINDOW_MS,
  NOTE_POINTS,
  SONG_RANKS,
  SONG_RANK_FALLBACK,
} from './constants.js';

/** @typedef {import('./types.js').Counts} Counts */
/** @typedef {import('./types.js').NoteResult} NoteResult */

export const GOOD_WINDOW_SEC = GOOD_WINDOW_MS / 1000;
export const PERFECT_WINDOW_SEC = PERFECT_WINDOW_MS / 1000;

/**
 * @param {number} deltaSec 補正後の差(叩いた時刻 - ノーツ時刻)。負 = 早い
 * @returns {'PERFECT' | 'GOOD' | null} null = 判定窓の外
 */
export function judgeDelta(deltaSec) {
  const d = Math.abs(deltaSec);
  if (d <= PERFECT_WINDOW_SEC) return 'PERFECT';
  if (d <= GOOD_WINDOW_SEC) return 'GOOD';
  return null;
}

/**
 * @param {Counts} counts
 * @returns {number} 0..1
 */
export function accuracy(counts) {
  const total = counts.PERFECT + counts.GOOD + counts.MISSED;
  if (total === 0) return 0;
  const score = counts.PERFECT * NOTE_POINTS.PERFECT + counts.GOOD * NOTE_POINTS.GOOD;
  return score / (total * NOTE_POINTS.PERFECT);
}

/**
 * @param {Counts} counts
 * @returns {string}
 */
export function songRank(counts) {
  const acc = accuracy(counts);
  return SONG_RANKS.find((r) => acc >= r.minAccuracy)?.name ?? SONG_RANK_FALLBACK;
}

/**
 * 判定窓を「ノーツの時刻 - 現在の曲時間」(= dt、正なら未来)の範囲で返す。
 * この範囲にあるノーツを今叩くと、その判定になる。判定は `叩いた時刻 - offset - ノーツ時刻`
 * で行うので、窓の中心は dt = -offset(オフセット分だけ判定ラインからずれる)。
 * 描画側はこれを yOf(t + dt, t) で座標に直して帯にする。窓の定数を変えれば帯も追従する。
 * @param {number} offsetSec 判定オフセット(秒)
 * @returns {{ good: [number, number], perfect: [number, number] }} [dtの小さい側, 大きい側]
 */
export function windowBands(offsetSec) {
  return {
    good: [-offsetSec - GOOD_WINDOW_SEC, -offsetSec + GOOD_WINDOW_SEC],
    perfect: [-offsetSec - PERFECT_WINDOW_SEC, -offsetSec + PERFECT_WINDOW_SEC],
  };
}

/**
 * 未判定ノーツが今どの帯にいるか(今叩いたらどの判定になるか)。
 * @param {number} dtSec ノーツの時刻 - 現在の曲時間
 * @param {number} offsetSec
 * @returns {'PERFECT' | 'GOOD' | null}
 */
export function zoneOfNote(dtSec, offsetSec) {
  return judgeDelta(-dtSec - offsetSec);
}
