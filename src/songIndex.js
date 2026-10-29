// songs/index.json の検証と曲の選択。DOM / fetch に依存しない純粋関数。

/** @typedef {{ id: string, title: string }} SongEntry */
/** @typedef {{ default: string, songs: SongEntry[] }} SongIndex */
/** @typedef {{ line: number, message: string }} NotationWarning */

// idはそのままファイル名(songs/<id>.txt)になる。../ などを弾くため文字種を限定する
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * @param {unknown} raw JSON.parse済みの値
 * @returns {SongIndex}
 * @throws {Error} 形式が不正なとき(理由つき)
 */
export function parseSongIndex(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('index.json がオブジェクトではありません');
  const r = /** @type {Record<string, unknown>} */ (raw);
  if (!Array.isArray(r.songs) || r.songs.length === 0) throw new Error('index.json の songs が空、または配列ではありません');
  /** @type {SongEntry[]} */
  const songs = r.songs.map((s, i) => {
    const e = /** @type {Record<string, unknown>} */ (s ?? {});
    if (typeof e.id !== 'string' || !ID_PATTERN.test(e.id)) throw new Error(`songs[${i}].id が不正です(英数字・_・- のみ)`);
    return { id: e.id, title: typeof e.title === 'string' && e.title ? e.title : e.id };
  });
  if (typeof r.default !== 'string' || !songs.some((s) => s.id === r.default)) {
    throw new Error(`default "${String(r.default)}" が songs に含まれていません`);
  }
  return { default: r.default, songs };
}

/**
 * 読み込む曲を決める。?chart= の指定が一覧になければ警告して default にする。
 * @param {SongIndex} index
 * @param {string | null} requested ?chart= の値(未指定は null)
 * @returns {{ id: string, warnings: NotationWarning[] }}
 */
export function pickSong(index, requested) {
  if (requested === null || requested === '') return { id: index.default, warnings: [] };
  if (index.songs.some((s) => s.id === requested)) return { id: requested, warnings: [] };
  return {
    id: index.default,
    warnings: [{ line: 0, message: `曲"${requested}"は一覧にありません。既定の"${index.default}"を使います` }],
  };
}
