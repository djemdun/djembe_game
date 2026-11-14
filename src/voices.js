/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').LaneSound} LaneSound */

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

/** 仮の合成音のパラメータ。音色を変えるときはここを編集する(dev/sound-test.html で試聴できる) @type {Record<LaneSound, DrumParams>} */
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
 * クラップ(手拍子)の設計図。実際の手拍子は、手のひらが少しずつずれて当たるので、
 * 短いノイズの連打(bursts)のあとに、少し長い余韻(tail)が続く。
 * @typedef {{ bursts: number, spacing: number, burstDecay: number, freq: number, q: number, burstGain: number,
 *   tailDecay: number, tailGain: number }} ClapParams
 */

/** 仮の合成クラップ。音色を変えるときはここを編集する(耳で合わせる) @type {ClapParams} */
export const CLAP_PARAMS = {
  bursts: 3, // 立ち上がりのノイズの連打の数
  spacing: 0.011, // 連打の間隔(秒)
  burstDecay: 0.014, // 連打1つの長さ(秒)
  freq: 1500, // ノイズの中心周波数(Hz)。高いほど硬い音
  q: 1.4, // 帯域の狭さ。大きいほど「パン」より「ピッ」に寄る
  burstGain: 0.55,
  tailDecay: 0.14, // 余韻の長さ(秒)
  tailGain: 0.4,
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
 * クラップの Voice。左高と右高の2ノーツが同時に鳴る(= この Voice が同時に2回呼ばれる)ことが多いので、
 * ノイズの読み出し開始位置を毎回ずらす。同じ位置から読むと2つが完全に同じ波形になり、重なって不自然に大きくなるため。
 * @param {AudioBuffer} noiseBuf
 * @param {ClapParams} p
 * @returns {Voice}
 */
export function clapVoice(noiseBuf, p) {
  // ノイズ素材(0.5秒)の中で、最長の1片(余韻)が収まる範囲から開始位置を選ぶ
  const maxOffset = noiseBuf.duration - (p.tailDecay + 0.05);
  return (ctx, when, dest) => {
    /** @param {number} start @param {number} decay @param {number} gain */
    const burst = (start, decay, gain) => {
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noiseBuf;
      f.type = 'bandpass';
      f.frequency.value = p.freq;
      f.Q.value = p.q;
      g.gain.setValueAtTime(gain, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + decay);
      src.connect(f).connect(g).connect(dest);
      src.start(start, Math.random() * maxOffset);
      src.stop(start + decay + 0.05);
    };
    for (let i = 0; i < p.bursts; i++) burst(when + i * p.spacing, p.burstDecay, p.burstGain);
    burst(when + (p.bursts - 1) * p.spacing, p.tailDecay, p.tailGain); // 余韻は最後の連打から続く
  };
}

/**
 * 仮の合成音(ジャンベ風 + クラップ)。
 * @param {AudioContext} ctx
 * @returns {Record<Sound, Voice>}
 */
export function createSynthVoices(ctx) {
  const noiseBuf = createNoiseBuffer(ctx);
  return {
    high: drumVoice(noiseBuf, DRUM_PARAMS.high),
    mid: drumVoice(noiseBuf, DRUM_PARAMS.mid),
    low: drumVoice(noiseBuf, DRUM_PARAMS.low),
    clap: clapVoice(noiseBuf, CLAP_PARAMS),
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
