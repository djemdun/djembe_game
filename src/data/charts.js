import { demoChart } from './demoChart.js';
import { easyChart } from './easyChart.js';

/** @typedef {import('../types.js').Chart} Chart */

/** URLの ?chart=<キー> で選ぶ。未指定/不明は DEFAULT_CHART_KEY @type {Record<string, Chart>} */
export const CHARTS = { demo: demoChart, easy: easyChart };
export const DEFAULT_CHART_KEY = 'demo';
