// ユーザー設定の型・既定値・検証(純粋)。localStorageの読み書きは storage.js。

/**
 * @typedef {object} Settings
 * @property {boolean} beatOn 拍音
 * @property {number} beatVolume 拍音の音量 0..1
 * @property {boolean} beatLines 拍線
 * @property {number} speed 速さ倍率(SPEED_OPTIONSのいずれか)
 */

export const SPEED_OPTIONS = Object.freeze([0.5, 0.7, 0.85, 1.0]);

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
    speed: SPEED_OPTIONS.includes(/** @type {number} */ (r.speed)) ? /** @type {number} */ (r.speed) : d.speed,
  };
}

/**
 * URLの ?speed= を数値にする。未指定・不正(0以下、極端な値)は null。
 * 選択肢以外(0.75など)も許す: 練習用に自由に指定できる。
 * @param {string | null} param
 * @returns {number | null}
 */
export function parseSpeedParam(param) {
  if (param === null || param.trim() === '') return null;
  const v = Number(param);
  return Number.isFinite(v) && v >= 0.1 && v <= 4 ? v : null;
}
