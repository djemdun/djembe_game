/** @typedef {import('../types.js').Chart} Chart */
/** @typedef {import('../types.js').ChartNote} ChartNote */

// 判定の動作確認用。BPM60 = 1拍1秒。フラムなし・同時押しなし。
// 0〜7: 右中のみ / 8〜15: 左中・右中の交互 / 16〜19: 交互の続き
/** @type {ChartNote[]} */
const notes = Array.from({ length: 20 }, (_, i) => ({
  beat: i,
  sound: 'mid',
  hand: i < 8 || i % 2 === 1 ? 'R' : 'L',
  flam: false,
}));

/** @type {Chart} */
export const easyChart = { bpm: 60, beatsPerBar: 4, totalBeats: 20, notes };
