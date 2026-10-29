import { METRONOME_LOOKAHEAD_SEC } from './constants.js';
import { beatsInWindow } from './beats.js';

/** @typedef {import('./audio.js').AudioEngine} AudioEngine */
/** @typedef {import('./beats.js').BeatGrid} BeatGrid */

/**
 * 先読みスケジューラ。tick() を毎フレーム呼ぶと、先読み幅の範囲の拍をWeb Audioに予約する。
 * 予約済みの音はオーディオスレッドが正確な時刻に鳴らすので、tickの呼び出し間隔が
 * 揺れても(rAFの揺れ、GC)拍はずれない。setTimeout/setInterval で直接鳴らす方式は、
 * タイマーの精度(数ms〜数十ms、バックグラウンドでは秒単位)がそのまま拍のずれになるため使わない。
 * 判定・スコアとは無関係(Gameには触れない)。判定オフセットも掛けない。
 */
export class Metronome {
  /**
   * @param {AudioEngine} audio
   * @param {BeatGrid} grid
   * @param {number} startTime 曲時間0のAudioContext時間
   */
  constructor(audio, grid, startTime) {
    this.audio = audio;
    this.grid = grid;
    this.startTime = startTime;
    /** ここまで(曲時間)の拍は予約済み */
    this.scheduledUntil = 0;
  }

  tick() {
    const to = this.audio.now - this.startTime + METRONOME_LOOKAHEAD_SEC;
    if (to <= this.scheduledUntil) return;
    for (const b of beatsInWindow(this.grid, this.scheduledUntil, to)) {
      this.audio.playClick(b.accent, this.startTime + b.time);
    }
    this.scheduledUntil = to;
  }
}
