import { CHARTS, TEXT_SONGS, DEFAULT_CHART_KEY } from './data/charts.js';
import { parseNotation } from './notation.js';
import { withSpeed } from './chart.js';

/** @typedef {import('./types.js').Chart} Chart */

/**
 * URLの ?chart= と ?speed= から譜面を用意する(fetchを伴うのでnotation.jsとは分離)。
 * 読み込みや変換に失敗したら内蔵のdemoにフォールバックする。
 * @param {URLSearchParams} params
 * @returns {Promise<Chart>}
 */
export async function loadChart(params) {
  const key = params.get('chart') ?? DEFAULT_CHART_KEY;
  const speed = Number(params.get('speed') ?? 1);
  let chart = CHARTS.demo;

  try {
    if (key in CHARTS) {
      chart = CHARTS[key];
    } else if (key in TEXT_SONGS) {
      const res = await fetch(TEXT_SONGS[key]);
      if (!res.ok) throw new Error(`${TEXT_SONGS[key]}: HTTP ${res.status}`);
      const parsed = parseNotation(await res.text());
      for (const w of parsed.warnings) console.warn(`[${key}] 行${w.line}: ${w.message}`);
      chart = parsed.chart;
    } else {
      console.warn(`unknown chart "${key}"; available: ${[...Object.keys(CHARTS), ...Object.keys(TEXT_SONGS)].join(', ')}`);
    }
  } catch (e) {
    console.error(`譜面"${key}"を読めないため demo を使います:`, e);
    chart = CHARTS.demo;
  }

  if (params.has('speed')) {
    try {
      chart = withSpeed(chart, speed);
    } catch (e) {
      console.warn('speedを無視します:', e);
    }
  }
  return chart;
}
