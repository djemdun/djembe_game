import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME } from '../src/theme.js';
import { lighten, noteColor, drawNote, drawHitEffect, drawDrumGlow, drawBands, drawBeatLine } from '../src/paint.js';

/** 呼び出しとプロパティ設定を記録する偽 2D コンテキスト */
function fakeCtx() {
  const log = [];
  const state = {};
  const g = new Proxy(state, {
    get: (t, k) => (k in t ? t[k] : (...a) => { log.push(['call', String(k), ...a]); }),
    set: (t, k, v) => { t[k] = v; log.push(['set', String(k), v]); return true; },
  });
  /** 最後に設定された値のうち、直前の指定メソッド呼び出しより前のもの */
  const setBefore = (prop, method) => {
    const i = log.findIndex((e) => e[0] === 'call' && e[1] === method);
    return log.slice(0, i).reverse().find((e) => e[0] === 'set' && e[1] === prop)?.[2];
  };
  return { g, log, setBefore };
}

test('lighten: 白への混ぜ具合(0 = そのまま、1 = 白)', () => {
  assert.equal(lighten('#000000', 0.5), 'rgb(128, 128, 128)');
  assert.equal(lighten('#ff6f6f', 0), 'rgb(255, 111, 111)');
  assert.equal(lighten('#336699', 1), 'rgb(255, 255, 255)');
});

test('noteColor: 未判定=音の色 / GOOD帯=goodMix / PERFECT帯=perfectMix / MISSED=missed', () => {
  for (const sound of /** @type {const} */ (['high', 'mid', 'low'])) {
    const base = THEME.sound[sound];
    assert.equal(noteColor(sound, null, null), base);
    assert.equal(noteColor(sound, null, 'GOOD'), lighten(base, THEME.note.goodMix));
    assert.equal(noteColor(sound, null, 'PERFECT'), lighten(base, THEME.note.perfectMix));
    assert.equal(noteColor(sound, 'MISSED', null), THEME.note.missed);
  }
});

test('drawNote: PERFECT帯だけ 音の色の発光と縁取り。MISSED は不透明度が下がる', () => {
  const base = { cx: 10, y: 20, r: 5, sound: /** @type {const} */ ('mid') };
  const p = fakeCtx();
  drawNote(p.g, { ...base, result: null, zone: 'PERFECT' });
  assert.equal(p.setBefore('shadowColor', 'beginPath'), THEME.sound.mid);
  assert.ok(p.log.some((e) => e[0] === 'set' && e[1] === 'strokeStyle' && e[2] === THEME.note.perfectOutline));

  const n = fakeCtx();
  drawNote(n.g, { ...base, result: null, zone: 'GOOD' });
  assert.ok(!n.log.some((e) => e[1] === 'shadowColor' || e[1] === 'stroke'));

  const m = fakeCtx();
  drawNote(m.g, { ...base, result: 'MISSED', zone: null });
  assert.equal(m.setBefore('globalAlpha', 'beginPath'), THEME.note.missedAlpha);
  assert.equal(m.setBefore('fillStyle', 'beginPath'), THEME.note.missed);
});

test('drawHitEffect / drawDrumGlow: 色は判定の色、叩いた瞬間の不透明度は theme の値', () => {
  for (const result of /** @type {const} */ (['PERFECT', 'GOOD'])) {
    const h = fakeCtx();
    drawHitEffect(h.g, { cx: 0, y: 0, r: 10, result, progress: 0 });
    assert.equal(h.setBefore('fillStyle', 'beginPath'), THEME.judgement[result]);
    assert.ok(h.log.some((e) => e[0] === 'set' && e[1] === 'globalAlpha' && e[2] === THEME.hitEffect.fillAlpha));
    assert.ok(h.log.some((e) => e[0] === 'set' && e[1] === 'strokeStyle' && e[2] === THEME.judgement[result]));

    const d = fakeCtx();
    drawDrumGlow(d.g, { cx: 0, cy: 0, r: 100 }, { sound: 'mid', hand: 'L', result, fade: 1 });
    assert.equal(d.setBefore('fillStyle', 'beginPath'), THEME.judgement[result]);
    assert.equal(d.setBefore('globalAlpha', 'beginPath'), THEME.drum.glowAlpha);
  }
});

test('drawBands / drawBeatLine: theme の色を使う(小節頭と拍で別の色)', () => {
  const b = fakeCtx();
  drawBands(b.g, { x: 0, w: 100, goodTop: 10, goodBottom: 50, perfectTop: 20, perfectBottom: 40 });
  assert.deepEqual(b.log.filter((e) => e[1] === 'fillStyle').map((e) => e[2]), [THEME.band.good, THEME.band.perfect]);
  const bar = fakeCtx();
  drawBeatLine(bar.g, 0, 100, 5, true);
  const beat = fakeCtx();
  drawBeatLine(beat.g, 0, 100, 5, false);
  assert.equal(bar.setBefore('strokeStyle', 'beginPath'), THEME.beatLine.bar);
  assert.equal(beat.setBefore('strokeStyle', 'beginPath'), THEME.beatLine.beat);
});

test('THEME を実行時に書き換えると、次の描画から反映される(調整ページの前提)', () => {
  const orig = THEME.sound.high;
  try {
    THEME.sound.high = '#102030';
    assert.equal(noteColor('high', null, null), '#102030');
    assert.equal(noteColor('high', null, 'GOOD'), lighten('#102030', THEME.note.goodMix));
  } finally {
    THEME.sound.high = orig;
  }
  assert.equal(noteColor('high', null, null), orig);
});
