// ユーザー設定の型・既定値・検証(純粋)。localStorageの読み書きは storage.js。

/**
 * @typedef {object} Settings
 * @property {boolean} beatOn 拍音
 * @property {number} beatVolume 拍音の音量 0..1
 * @property {boolean} beatLines 拍線
 * @property {number} speed 速さ倍率(SPEED_MIN〜SPEED_MAX)
 */

// 設定UIのスライダー範囲。?speed= の許容範囲(parseSpeedParam)はこれより広い
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 1.5;
export const SPEED_STEP = 0.05;

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({ beatOn: true, beatVolume: 0.6, beatLines: true, speed: 1.0 });

/**
 * 外部入力(localStorageのJSONなど)を安全な設定値に直す。不正な項目だけ既定値に戻す。
 * @param {unknown} raw
 * @returns {Settings}
 */
export function sanitizeSettings(raw) {
  const r = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const d = DEFAULT_SETTINGS;
  const vol = typeof r.beatVolume === 'number' && Number.isFinite(r.beatVolume) ? r.beatVolume : d.beatVolume;
  return {
    beatOn: typeof r.beatOn === 'boolean' ? r.beatOn : d.beatOn,
    beatVolume: Math.min(1, Math.max(0, vol)),
    beatLines: typeof r.beatLines === 'boolean' ? r.beatLines : d.beatLines,
    speed: typeof r.speed === 'number' && Number.isFinite(r.speed) ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, r.speed)) : d.speed,
  };
}

/**
 * URLの ?speed= を数値にする。未指定・不正(0以下、極端な値)は null。
 * スライダー範囲外(0.2や2など)も許す: 練習用に自由に指定できる。
 * @param {string | null} param
 * @returns {number | null}
 */
export function parseSpeedParam(param) {
  if (param === null || param.trim() === '') return null;
  const v = Number(param);
  return Number.isFinite(v) && v >= 0.1 && v <= 4 ? v : null;
}
