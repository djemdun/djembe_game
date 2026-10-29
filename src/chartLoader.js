import { CHARTS, TEXT_SONGS, DEFAULT_CHART_KEY } from './data/charts.js';
import { parseNotation } from './notation.js';

/** @typedef {import('./types.js').Chart} Chart */
/** @typedef {import('./notation.js').NotationWarning} NotationWarning */
/** @typedef {{ chart: Chart, title: string, warnings: NotationWarning[] }} LoadedChart */

/**
 * URLの ?chart= から譜面を用意する(fetchを伴うのでnotation.jsとは分離)。速さ倍率は呼び出し側で掛ける。
 * 読み込みや変換に失敗したら内蔵のdemoにフォールバックし、その旨も warnings に入れて画面に出せるようにする。
 * @param {URLSearchParams} params
 * @returns {Promise<LoadedChart>}
 */
export async function loadChart(params) {
  const key = params.get('chart') ?? DEFAULT_CHART_KEY;
  /** @param {string} message @returns {LoadedChart} */
  const fallback = (message) => ({ chart: CHARTS.demo, title: 'demo', warnings: [{ line: 0, message }] });

  if (key in CHARTS) return { chart: CHARTS[key], title: key, warnings: [] };

  if (key in TEXT_SONGS) {
    try {
      const res = await fetch(TEXT_SONGS[key]);
      if (!res.ok) throw new Error(`${TEXT_SONGS[key]}: HTTP ${res.status}`);
      const parsed = parseNotation(await res.text());
      for (const w of parsed.warnings) console.warn(`[${key}] 行${w.line}: ${w.message}`);
      return { chart: parsed.chart, title: parsed.title || key, warnings: parsed.warnings };
    } catch (e) {
      console.error(`譜面"${key}"を読めません:`, e);
      return fallback(`譜面"${key}"を読めないため demo を使います: ${e instanceof Error ? e.message : e}`);
    }
  }

  const available = [...Object.keys(CHARTS), ...Object.keys(TEXT_SONGS)].join(', ');
  console.warn(`unknown chart "${key}"; available: ${available}`);
  return fallback(`譜面"${key}"は存在しないため demo を使います(選択肢: ${available})`);
}
