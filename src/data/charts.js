import { demoChart } from './demoChart.js';
import { easyChart } from './easyChart.js';

/** @typedef {import('../types.js').Chart} Chart */

/**
 * コード内蔵の譜面(動作確認用)。URLの ?chart=<キー> で選ぶ。
 * 文字譜の曲は songs/index.json と songs/<id>.txt で管理する。
 * @type {Record<string, Chart>}
 */
export const CHARTS = { demo: demoChart, easy: easyChart };
