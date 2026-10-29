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
const PERFECT_WINDOW_SEC = PERFECT_WINDOW_MS / 1000;

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
