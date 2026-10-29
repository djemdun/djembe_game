import { createSynthVoices, playClick } from './voices.js';

/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./voices.js').Voice} Voice */

export class AudioEngine {
  constructor() {
    /** @type {AudioContext | null} */
    this.ctx = null;
    /** @type {GainNode | null} */
    this.master = null;
    /** 拍音専用のバス。ジャンベの音量(master)とは独立 @type {GainNode | null} */
    this.clickBus = null;
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
      this.clickBus = this.ctx.createGain();
      this.clickBus.connect(this.ctx.destination);
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

  /** @param {number} volume 0..1(知覚に合わせ2乗カーブ) */
  setClickVolume(volume) {
    if (this.clickBus) this.clickBus.gain.value = volume * volume;
  }

  /**
   * 拍音を `when`(AudioContext時間)に予約する
   * @param {boolean} accent 小節頭
   * @param {number} when
   */
  playClick(accent, when) {
    if (!this.ctx || !this.clickBus) return;
    playClick(this.ctx, Math.max(when, this.ctx.currentTime), this.clickBus, accent);
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
