// 自動音(autoPlay ノーツ)の選別と時刻窓。DOM / Web Audio に依存しない純粋関数。
// 実際の予約は scheduler.js(拍音と同じ先読みスケジュール)が行う。

/** @typedef {import('./types.js').PlayNote} PlayNote */

/**
 * 自動音の対象だけを時刻順に抜き出す。
 * @param {PlayNote[]} notes
 * @returns {PlayNote[]}
 */
export function selectAutoNotes(notes) {
  return notes.filter((n) => n.autoPlay).sort((a, b) => a.time - b.time);
}

/**
 * 曲時間の半開区間 [fromSec, toSec) にある自動音を返す(beatsInWindow と同じ規約)。
 * 連続する窓で呼べば、重複も欠落もなく全ノーツが1回ずつ出る。
 * 判定オフセットは掛けない: 自動音は常に譜面の時刻ちょうどに鳴る。
 * @param {PlayNote[]} autoNotes selectAutoNotes の結果
 * @param {number} fromSec
 * @param {number} toSec
 * @returns {PlayNote[]}
 */
export function autoNotesInWindow(autoNotes, fromSec, toSec) {
  return autoNotes.filter((n) => n.time >= fromSec && n.time < toSec);
}
