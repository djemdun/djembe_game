import { METRONOME_LOOKAHEAD_SEC } from './constants.js';

/** @typedef {import('./audio.js').AudioEngine} AudioEngine */

/**
 * 先読みスケジューラ(拍音と自動音で共用)。tick() を毎フレーム呼ぶと、
 * 先読み幅の範囲のイベントをWeb Audioに予約する。
 * 予約済みの音はオーディオスレッドが正確な時刻に鳴らすので、tickの呼び出し間隔が
 * 揺れても(rAFの揺れ、GC)ずれない。setTimeout/setInterval で直接鳴らす方式は、
 * タイマーの精度(数ms〜数十ms、バックグラウンドでは秒単位)がそのままずれになるため使わない。
 * 判定・スコア(Game)には触れない。判定オフセットも掛けない。
 *
 * @template {{ time: number }} E
 */
export class LookaheadScheduler {
  /**
   * @param {AudioEngine} audio
   * @param {number} startTime 曲時間0のAudioContext時間
   * @param {(fromSec: number, toSec: number) => E[]} eventsIn 曲時間の半開区間 [from, to) のイベント
   * @param {(event: E, audioTime: number) => void} fire AudioContext時間で予約する
   */
  constructor(audio, startTime, eventsIn, fire) {
    this.audio = audio;
    this.startTime = startTime;
    this.eventsIn = eventsIn;
    this.fire = fire;
    /** ここまで(曲時間)のイベントは予約済み */
    this.scheduledUntil = 0;
  }

  tick() {
    const to = this.audio.now - this.startTime + METRONOME_LOOKAHEAD_SEC;
    if (to <= this.scheduledUntil) return;
    for (const e of this.eventsIn(this.scheduledUntil, to)) {
      this.fire(e, this.startTime + e.time);
    }
    this.scheduledUntil = to;
  }
}
