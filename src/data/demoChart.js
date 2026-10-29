/** @typedef {import('../types.js').Chart} Chart */
/** @typedef {import('../types.js').ChartNote} ChartNote */
/** @typedef {import('../types.js').Sound} Sound */

// 仮譜面(段階1〜3用)。1小節=8文字(8分音符)、H/M/L=高/中/低、F=中音フラム、.=休符。
// 手の割り当ては「位置が偶数番目(0始まり)なら右」の暫定ルール(文字譜パーサ=段階4で置き換わる)。
// 内部形式 { beat, sound, hand, flam } を直接並べるだけでもよい。ここは手書きの手間を減らすための生成。
const BARS = [
  'F.MM.M..', 'F.MM.MHH',
  'L.MML.HH', 'L.MML.HH', 'L.MML.HH', 'L.MML.HH',
  'L.MML.HH', 'L.MML.HH', 'L.MML.HH', 'L.MML.HH',
  'MMMHHHHH', 'HHHHHHHH', 'MMMHHHHH', 'HHHHHHHH',
  'F.MM.MHH', 'F.MM....',
];

/** @type {Record<string, Sound>} */
const SOUND = { H: 'high', M: 'mid', L: 'low', F: 'mid' };

/** @type {ChartNote[]} */
const notes = [];
BARS.forEach((bar, barIdx) => {
  [...bar].forEach((ch, i) => {
    if (ch === '.') return;
    notes.push({
      beat: barIdx * 4 + i * 0.5,
      sound: SOUND[ch],
      hand: i % 2 === 0 ? 'R' : 'L',
      flam: ch === 'F',
    });
  });
});

/** @type {Chart} 130BPM × 16小節 ≒ 29.5秒 */
export const demoChart = { bpm: 130, beatsPerBar: 4, totalBeats: BARS.length * 4, notes };
