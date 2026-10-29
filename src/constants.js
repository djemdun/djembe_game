/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').Hand} Hand */

/**
 * 左から順。hand+sound → レーンの対応と、キー割り当てはここが唯一の定義。
 * code は KeyboardEvent.code(キー配列に依存しない物理キー)。
 * @type {ReadonlyArray<{ hand: Hand, sound: Sound, code: string, keyLabel: string, soundLabel: string }>}
 */
export const LANES = Object.freeze([
  { hand: 'L', sound: 'high', code: 'KeyA', keyLabel: 'A', soundLabel: '高' },
  { hand: 'L', sound: 'mid', code: 'KeyS', keyLabel: 'S', soundLabel: '中' },
  { hand: 'L', sound: 'low', code: 'KeyD', keyLabel: 'D', soundLabel: '低' },
  { hand: 'R', sound: 'low', code: 'KeyJ', keyLabel: 'J', soundLabel: '低' },
  { hand: 'R', sound: 'mid', code: 'KeyK', keyLabel: 'K', soundLabel: '中' },
  { hand: 'R', sound: 'high', code: 'KeyL', keyLabel: 'L', soundLabel: '高' },
]);
export const LANE_COUNT = LANES.length;

// --- 判定(音ごと) ---
export const PERFECT_WINDOW_MS = 60;
export const GOOD_WINDOW_MS = 130;
export const NOTE_POINTS = Object.freeze({ PERFECT: 100, GOOD: 50, MISSED: 0 });

// --- 判定(曲ごと): accuracy = 得点 / (ノーツ数 × PERFECT点)。上から順に最初に満たしたもの ---
export const SONG_RANKS = Object.freeze([
  { name: 'PERFECT', minAccuracy: 0.95 },
  { name: 'GREAT', minAccuracy: 0.85 },
  { name: 'GOOD', minAccuracy: 0.7 },
]);
export const SONG_RANK_FALLBACK = 'TRY AGAIN';

// --- タイミング ---
/** ノーツが画面上端から判定ラインに届くまでの秒数(小さいほど速い) */
export const FALL_SEC = 1.6;
/** 開始ボタンから最初のノーツまでの余白 */
export const LEAD_IN_SEC = 2;
/** 最後のノーツ後、リザルトへ移るまでの余韻 */
export const END_PAD_SEC = 1;
/** フラムの前打音を着地音の何拍前に置くか */
export const FLAM_GAP_BEATS = 0.125;

// --- オフセット ---
export const OFFSET_MIN_MS = -300;
export const OFFSET_MAX_MS = 300;
export const OFFSET_STORAGE_KEY = 'djembe.offsetMs';
