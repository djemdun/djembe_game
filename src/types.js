/** @typedef {'high' | 'mid' | 'low'} Sound */
/** @typedef {'L' | 'R'} Hand */

/**
 * 譜面の内部形式。ゲーム本体が読むのはこれだけ。
 * flam:true の hand は着地側(2音目)の手。
 * autoPlay:true(省略時false)のノーツは、時刻ちょうどにゲーム側が自動で鳴らす(判定は通常どおり)。
 * @typedef {{ beat: number, sound: Sound, hand: Hand, flam: boolean, autoPlay?: boolean }} ChartNote
 */

/**
 * bpm は速さ倍率適用後の値になり得る。beatsPerBar/totalBeats は拍音・拍線の格子用(譜面の拍で数える)。
 * @typedef {{ bpm: number, beatsPerBar: number, totalBeats: number, notes: ChartNote[] }} Chart
 */

/** @typedef {'PERFECT' | 'GOOD' | 'MISSED'} NoteResult */

/**
 * 再生用ノーツ。time は曲開始(= startTime)からの秒数。
 * @typedef {{ time: number, lane: number, sound: Sound, autoPlay: boolean, result: NoteResult | null }} PlayNote
 */

/** @typedef {Record<NoteResult, number>} Counts */

export {};
