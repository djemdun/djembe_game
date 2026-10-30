import { CHARTS } from './data/charts.js';
import { parseNotation } from './notation.js';
import { parseSongIndex, pickSong } from './songIndex.js';

/** @typedef {import('./types.js').Chart} Chart */
/** @typedef {import('./notation.js').NotationWarning} NotationWarning */
/** @typedef {import('./songIndex.js').SongEntry} SongEntry */
/** @typedef {{ chart: Chart, title: string, warnings: NotationWarning[], id: string }} LoadedChart */
/** 起動時の読み込み結果。songs は TOP画面の曲選択に使う一覧(内蔵譜面・一覧が読めないときは空) @typedef {LoadedChart & { songs: SongEntry[] }} InitialChart */

const INDEX_URL = 'songs/index.json';

/** @param {string} url */
async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res;
}

/** @param {unknown} e */
const reason = (e) => (e instanceof Error ? e.message : String(e));

/**
 * songs/<id>.txt を読んで変換する。失敗したら例外(曲の切り替え側が前の曲に戻す)。
 * @param {string} id
 * @returns {Promise<LoadedChart>}
 */
export async function loadSong(id) {
  const parsed = parseNotation(await (await fetchOk(`songs/${id}.txt`)).text());
  for (const w of parsed.warnings) console.warn(`[${id}] 行${w.line}: ${w.message}`);
  return { chart: parsed.chart, title: parsed.title || id, warnings: parsed.warnings, id };
}

/**
 * 曲を決めて読み込む(fetchを伴うので notation.js / songIndex.js とは分離)。速さ倍率は呼び出し側で掛ける。
 * 順序: ?chart= が easy/demo → 内蔵譜面 / それ以外 → songs/index.json の一覧で検証 → songs/<id>.txt。
 * 失敗したら default → それも失敗なら demo に戻し、理由を warnings に入れて開始画面に出す。
 * @param {URLSearchParams} params
 * @returns {Promise<InitialChart>}
 */
export async function loadChart(params) {
  const requested = params.get('chart');
  if (requested !== null && requested in CHARTS) {
    return { chart: CHARTS[requested], title: requested, warnings: [], id: requested, songs: [] };
  }

  /** @type {NotationWarning[]} */
  const warnings = [];
  /** @param {string} message */
  const warn = (message) => {
    console.warn(message);
    warnings.push({ line: 0, message });
  };
  /** @type {SongEntry[]} */
  let songs = [];
  const demo = () => ({ chart: CHARTS.demo, title: 'demo', warnings, id: 'demo', songs });

  let index;
  try {
    index = parseSongIndex(await (await fetchOk(INDEX_URL)).json());
    songs = index.songs;
  } catch (e) {
    warn(`曲一覧(${INDEX_URL})を読めないため demo を使います: ${reason(e)}`);
    return demo();
  }

  const pick = pickSong(index, requested);
  for (const w of pick.warnings) warn(w.message);

  try {
    const song = await loadSong(pick.id);
    return { ...song, warnings: [...warnings, ...song.warnings], songs };
  } catch (e) {
    warn(`曲"${pick.id}"を読めません: ${reason(e)}`);
  }

  if (pick.id !== index.default) {
    try {
      const song = await loadSong(index.default);
      warn(`既定の曲"${index.default}"を使います`);
      return { ...song, warnings: [...warnings, ...song.warnings], songs };
    } catch (e) {
      warn(`既定の曲"${index.default}"も読めません: ${reason(e)}`);
    }
  }
  warn('demo を使います');
  return demo();
}
