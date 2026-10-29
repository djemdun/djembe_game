import { demoChart } from './demoChart.js';
import { easyChart } from './easyChart.js';

/** @typedef {import('../types.js').Chart} Chart */

/** コード内蔵の譜面。URLの ?chart=<キー> で選ぶ @type {Record<string, Chart>} */
export const CHARTS = { demo: demoChart, easy: easyChart };

/** 文字譜ファイル(fetchして parseNotation で変換)。?chart=<キー> @type {Record<string, string>} */
export const TEXT_SONGS = { djole: 'songs/djole.txt' };

export const DEFAULT_CHART_KEY = 'djole';
