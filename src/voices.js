/** @typedef {import('./types.js').Sound} Sound */

/**
 * 1音を `when`(AudioContext時間)に鳴らす関数。
 * 合成音でも録音サンプルでも、この形に揃えればAudioEngineは区別しない。
 * @typedef {(ctx: AudioContext, when: number, dest: AudioNode) => void} Voice
 */

/**
 * 録音音源への差し替え用。decodeAudioData済みのバッファからVoiceを作る。
 * 例: engine.setVoices({ high: sampleVoice(bufHigh), mid: ..., low: ... })
 * @param {AudioBuffer} buffer
 * @returns {Voice}
 */
export function sampleVoice(buffer) {
  return (ctx, when, dest) => {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);
    src.start(when);
  };
}

/**
 * 合成ドラムの設計図。音程のある層(tones)とノイズ層(noises)を重ねる。
 * tone: f0 → f1 へ指数的に下降(decay の6割で到達)し、decay で消える
 * noise: ノイズをフィルタ(type/freq/q)に通し、decay で消える
 * @typedef {{ f0: number, f1: number, decay: number, gain: number }} ToneLayer
 * @typedef {{ type: BiquadFilterType, freq: number, q: number, decay: number, gain: number }} NoiseLayer
 * @typedef {{ tones: ToneLayer[], noises: NoiseLayer[] }} DrumParams
 */

/** 仮の合成音のパラメータ。音色を変えるときはここを編集する(dev/sound-test.html で試聴できる) @type {Record<Sound, DrumParams>} */
export const DRUM_PARAMS = {
  // 木の太鼓らしい太さを優先した音(試聴ページのプリセット7をもとに調整)。以前は 950→700Hz のサイン波 + 2500Hz以上のノイズ
  high: {
    tones: [{ f0: 440, f1: 340, decay: 0.2, gain: 0.8 }],
    noises: [
      { type: 'bandpass', freq: 650, q: 5, decay: 0.12, gain: 0.5 },
      { type: 'highpass', freq: 3000, q: 1, decay: 0.02, gain: 0.3 },
    ],
  },
  mid: {
    tones: [{ f0: 300, f1: 220, decay: 0.2, gain: 0.6 }], // 高音との差を出すため 340→250Hz から下げた
    noises: [{ type: 'bandpass', freq: 1200, q: 1, decay: 0.05, gain: 0.2 }],
  },
  low: {
    tones: [{ f0: 150, f1: 55, decay: 0.4, gain: 0.95 }],
    noises: [{ type: 'lowpass', freq: 400, q: 1, decay: 0.04, gain: 0.25 }],
  },
};

/**
 * ノイズ素材。1回だけ生成して使い回す(毎打生成するとGC/CPU負荷になる)
 * @param {BaseAudioContext} ctx
 */
export function createNoiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/**
 * @param {AudioBuffer} noiseBuf
 * @param {DrumParams} p
 * @returns {Voice}
 */
export function drumVoice(noiseBuf, p) {
  return (ctx, when, dest) => {
    for (const t of p.tones) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.frequency.setValueAtTime(t.f0, when);
      osc.frequency.exponentialRampToValueAtTime(t.f1, when + t.decay * 0.6);
      g.gain.setValueAtTime(t.gain, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + t.decay);
      osc.connect(g).connect(dest);
      osc.start(when);
      osc.stop(when + t.decay + 0.05);
    }
    for (const n of p.noises) {
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = n.type;
      f.frequency.value = n.freq;
      f.Q.value = n.q;
      g.gain.setValueAtTime(n.gain, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + n.decay);
      src.connect(f).connect(g).connect(dest);
      src.start(when);
      src.stop(when + n.decay + 0.05);
    }
  };
}

/**
 * 仮の合成音(ジャンベ風)。
 * @param {AudioContext} ctx
 * @returns {Record<Sound, Voice>}
 */
export function createSynthVoices(ctx) {
  const noiseBuf = createNoiseBuffer(ctx);
  return {
    high: drumVoice(noiseBuf, DRUM_PARAMS.high),
    mid: drumVoice(noiseBuf, DRUM_PARAMS.mid),
    low: drumVoice(noiseBuf, DRUM_PARAMS.low),
  };
}

/**
 * 拍音(メトロノーム)のクリック。ジャンベ3音と聞き分けるため、
 * 打楽器のノイズ成分を持たない「高めの短いベル音」(基音 + 非整数倍音)にする。
 * 小節頭(accent)は音程を上げて音量も上げる。
 * @param {AudioContext} ctx
 * @param {number} when
 * @param {AudioNode} dest
 * @param {boolean} accent
 */
export function playClick(ctx, when, dest, accent) {
  const f = accent ? 2600 : 1900;
  const peak = accent ? 0.5 : 0.3;
  for (const [mult, amp] of /** @type {const} */ ([[1, 1], [2.76, 0.35]])) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = f * mult;
    g.gain.setValueAtTime(peak * amp, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + 0.08);
  }
}
