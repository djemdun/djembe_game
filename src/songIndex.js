// songs/index.json の検証と曲の選択。DOM / fetch に依存しない純粋関数。

/** groups: この曲を見られるグループ(省略可。default の曲は指定に関わらず常に見える) @typedef {{ id: string, title: string, groups?: string[] }} SongEntry */
/** @typedef {{ default: string, songs: SongEntry[] }} SongIndex */
/** @typedef {{ line: number, message: string }} NotationWarning */

// idはそのままファイル名(songs/<id>.txt)になる。../ などを弾くため文字種を限定する
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

// 全曲を見られる予約グループ(確認・管理用)。推測されにくい名前にしているが、静的公開ではソースを読めば分かる
// ので、アクセス制御ではなく出し分け。
export const ADMIN_GROUP = 'adminmami';

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
    /** @type {SongEntry} */
    const entry = { id: e.id, title: typeof e.title === 'string' && e.title ? e.title : e.id };
    if (e.groups !== undefined) {
      if (!Array.isArray(e.groups) || !e.groups.every((g) => typeof g === 'string' && ID_PATTERN.test(g) && g !== ADMIN_GROUP)) {
        throw new Error(`songs[${i}].groups が不正です(英数字・_・- の文字列の配列。"${ADMIN_GROUP}" は予約語)`);
      }
      entry.groups = e.groups;
    }
    return entry;
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

/**
 * ?group= で見える曲を決める(出し分け。アクセス制御ではない)。
 * - 未指定: default の曲だけ
 * - group=a / group=a,b (?group= の繰り返しも可): default の曲 + 指定グループのどれかに属する曲
 * - group=adminmami: 全曲
 * 一覧のどの曲にも無いグループ名は警告して無視。見える曲が1つなら選択欄は出ない(UI側)。
 * 戻り値の index は一覧の順序のまま。default は必ず含まれる。
 * @param {SongIndex} index
 * @param {string[]} values params.getAll('group') の値(未指定は空配列)
 * @returns {{ index: SongIndex, warnings: NotationWarning[] }}
 */
export function restrictSongs(index, values) {
  const tokens = values.flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean);
  /** @type {NotationWarning[]} */
  const warnings = [];
  if (tokens.includes(ADMIN_GROUP)) return { index, warnings };
  const known = new Set(index.songs.flatMap((s) => s.groups ?? []));
  for (const t of tokens) {
    if (!known.has(t)) warnings.push({ line: 0, message: `グループ"${t}"は一覧にありません` });
  }
  const songs = index.songs.filter((s) => s.id === index.default || (s.groups ?? []).some((g) => tokens.includes(g)));
  return { index: { default: index.default, songs }, warnings };
}
