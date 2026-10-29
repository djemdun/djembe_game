import { createSynthVoices } from './voices.js';

/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./voices.js').Voice} Voice */

export class AudioEngine {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {GainNode | null} */
    this.master = null;
    /** @type {Record<Sound, Voice> | null} */
    this.voices = null;
  }

  /**
   * 必ずユーザー操作(click/touchend)のハンドラ内から同期的に呼ぶこと。
   * モバイル(特にiOS Safari)はジェスチャ外で生成/resumeしたAudioContextを
   * suspendedのままにするため。最初のawaitより前でctx生成とresume()を済ませている。
   */
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext ?? /** @type {any} */ (window).webkitAudioContext;
      // 'interactive' = 出力遅延を最小寄りにする指定(叩いてから鳴るまでを短く)
      this.ctx = /** @type {AudioContext} */ (new AC({ latencyHint: 'interactive' }));
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this.voices = createSynthVoices(this.ctx);
    }
    const resumed = this.ctx.resume();
    // iOS対策: ジェスチャ内で無音を1回鳴らして出力を確実に起こす
    const silent = this.ctx.createBufferSource();
    silent.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    silent.connect(this.ctx.destination);
    silent.start(0);
    await resumed;
  }

  /** 録音音源などへの差し替え口 @param {Record<Sound, Voice>} voices */
  setVoices(voices) {
    this.voices = voices;
  }

  /** 現在のAudioContext時間(秒)。全ゲーム時刻の基準 */
  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /**
   * @param {Sound} sound
   * @param {number} [when] AudioContext時間。省略/過去なら即時
   */
  play(sound, when = 0) {
    if (!this.ctx || !this.master || !this.voices) return;
    this.voices[sound](this.ctx, Math.max(when, this.ctx.currentTime), this.master);
  }
}
