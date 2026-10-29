import { OFFSET_STORAGE_KEY, OFFSET_MIN_MS, OFFSET_MAX_MS } from './constants.js';

// localStorageはSafariのプライベートモードや設定次第で例外を投げる。失敗しても動くようにする。

/** @returns {number} */
export function loadOffsetMs() {
  try {
    const v = Number(localStorage.getItem(OFFSET_STORAGE_KEY));
    return Number.isFinite(v) ? Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, v)) : 0;
  } catch {
    return 0;
  }
}

/** @param {number} ms */
export function saveOffsetMs(ms) {
  try {
    localStorage.setItem(OFFSET_STORAGE_KEY, String(ms));
  } catch {
    // 保存できなくてもセッション中は有効
  }
}
