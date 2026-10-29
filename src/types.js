/** @typedef {'high' | 'mid' | 'low'} Sound */
/** @typedef {'L' | 'R'} Hand */

/**
 * 譜面の内部形式。ゲーム本体が読むのはこれだけ。
 * flam:true の hand は着地側(2音目)の手。
 * @typedef {{ beat: number, sound: Sound, hand: Hand, flam: boolean }} ChartNote
 */

/** @typedef {{ bpm: number, notes: ChartNote[] }} Chart */

/** @typedef {'PERFECT' | 'GOOD' | 'MISSED'} NoteResult */

/**
 * 再生用ノーツ。time は曲開始(= startTime)からの秒数。
 * @typedef {{ time: number, lane: number, sound: Sound, result: NoteResult | null }} PlayNote
 */

/** @typedef {Record<NoteResult, number>} Counts */

export {};
