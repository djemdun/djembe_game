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
 * 仮の合成音(ジャンベ風): サイン波のピッチ下降 + ノイズバースト。
 * @param {AudioContext} ctx
 * @returns {Record<Sound, Voice>}
 */
export function createSynthVoices(ctx) {
  // ノイズは1回だけ生成して使い回す(毎打生成するとGC/CPU負荷になる)
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  /**
   * @param {{ f0: number, f1: number, toneDecay: number, toneGain: number,
   *           noiseType: BiquadFilterType, noiseFreq: number, noiseDecay: number, noiseGain: number }} p
   * @returns {Voice}
   */
  const make = (p) => (c, when, dest) => {
    const osc = c.createOscillator();
    const og = c.createGain();
    osc.frequency.setValueAtTime(p.f0, when);
    osc.frequency.exponentialRampToValueAtTime(p.f1, when + p.toneDecay * 0.6);
    og.gain.setValueAtTime(p.toneGain, when);
    og.gain.exponentialRampToValueAtTime(0.001, when + p.toneDecay);
    osc.connect(og).connect(dest);
    osc.start(when);
    osc.stop(when + p.toneDecay + 0.05);

    const ns = c.createBufferSource();
    const nf = c.createBiquadFilter();
    const ng = c.createGain();
    ns.buffer = noiseBuf;
    nf.type = p.noiseType;
    nf.frequency.value = p.noiseFreq;
    ng.gain.setValueAtTime(p.noiseGain, when);
    ng.gain.exponentialRampToValueAtTime(0.001, when + p.noiseDecay);
    ns.connect(nf).connect(ng).connect(dest);
    ns.start(when);
    ns.stop(when + p.noiseDecay + 0.05);
  };

  return {
    high: make({ f0: 950, f1: 700, toneDecay: 0.09, toneGain: 0.3, noiseType: 'highpass', noiseFreq: 2500, noiseDecay: 0.07, noiseGain: 0.5 }),
    mid: make({ f0: 340, f1: 250, toneDecay: 0.2, toneGain: 0.6, noiseType: 'bandpass', noiseFreq: 1200, noiseDecay: 0.05, noiseGain: 0.2 }),
    low: make({ f0: 150, f1: 55, toneDecay: 0.4, toneGain: 0.95, noiseType: 'lowpass', noiseFreq: 400, noiseDecay: 0.04, noiseGain: 0.25 }),
  };
}
