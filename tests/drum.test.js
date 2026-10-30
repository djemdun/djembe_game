import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drumLayout, drumZoneArc, activeGlows } from '../src/drum.js';
import { computeLayout } from '../src/layout.js';
import { LANES, HIT_EFFECT_SEC, DRUM_ZONES } from '../src/constants.js';

const laneOf = (hand, sound) => LANES.findIndex((l) => l.hand === hand && l.sound === sound);
const effects = (/** @type {Record<number, object>} */ m) => LANES.map((_, i) => m[i] ?? null);

test('drumLayout: レーン領域の中央・判定ラインより上に収まる', () => {
  const d = drumLayout(100, 400, 600);
  assert.equal(d.cx, 300);
  assert.equal(d.cy, 300);
  assert.ok(d.outerR <= 200 && d.outerR <= 300);
  assert.ok(d.skinR < d.outerR);
});

test('drumLayout: 縦画面(390x800)・横画面(667x375)・最大幅でも領域からはみ出さない', () => {
  for (const [w, h] of [[390, 800], [360, 640], [667, 375], [1280, 720], [320, 480]]) {
    const l = computeLayout(w, h);
    const d = drumLayout(l.x0, l.areaW, l.judgeY);
    assert.ok(d.cx - d.outerR >= l.x0 - 1e-9, `${w}x${h} 左`);
    assert.ok(d.cx + d.outerR <= l.x0 + l.areaW + 1e-9, `${w}x${h} 右`);
    assert.ok(d.cy - d.outerR >= 0, `${w}x${h} 上`);
    assert.ok(d.cy + d.outerR <= l.judgeY + 1e-9, `${w}x${h} 判定ライン`);
  }
});

test('drumZoneArc: 低=中央の半円 / 中=内側リング / 高=外側リング(半径は定数どおり)', () => {
  const d = { cx: 0, cy: 0, skinR: 100 };
  const low = drumZoneArc(d, 'low', 'L');
  const mid = drumZoneArc(d, 'mid', 'L');
  const high = drumZoneArc(d, 'high', 'L');
  assert.equal(low.rIn, 0);
  assert.equal(low.rOut, DRUM_ZONES.low.rOut * 100);
  assert.equal(mid.rIn, low.rOut); // 隙間も重なりもなく内側から順に並ぶ
  assert.equal(high.rIn, mid.rOut);
  assert.equal(high.rOut, 100); // 外側リングは皮の縁まで
});

test('drumZoneArc: 左手は左半分、右手は右半分(canvasは0=右・時計回り)', () => {
  const d = { cx: 0, cy: 0, skinR: 100 };
  const l = drumZoneArc(d, 'mid', 'L');
  const r = drumZoneArc(d, 'mid', 'R');
  assert.deepEqual([l.a0, l.a1], [Math.PI / 2, (Math.PI * 3) / 2]);
  assert.deepEqual([r.a0, r.a1], [-Math.PI / 2, Math.PI / 2]);
  // 弧の中点: 左は真左(π)、右は真右(0)
  assert.ok(Math.abs(Math.cos((l.a0 + l.a1) / 2) + 1) < 1e-9);
  assert.ok(Math.abs(Math.cos((r.a0 + r.a1) / 2) - 1) < 1e-9);
});

test('activeGlows: ヒットのあったレーンだけ、レーン定義どおりの音と手で返る', () => {
  const g = activeGlows(effects({
    [laneOf('L', 'high')]: { result: 'PERFECT', at: 1 },
    [laneOf('R', 'low')]: { result: 'GOOD', at: 1 },
  }), 1.1);
  assert.deepEqual(g.map((x) => [x.sound, x.hand, x.result]), [['high', 'L', 'PERFECT'], ['low', 'R', 'GOOD']]);
});

test('activeGlows: ヒットエフェクトと同じ長さで消える(叩いた瞬間 fade=1、HIT_EFFECT_SEC で消灯)', () => {
  const e = effects({ 1: { result: 'PERFECT', at: 2 } });
  assert.equal(activeGlows(e, 2)[0].fade, 1);
  assert.ok(Math.abs(activeGlows(e, 2 + HIT_EFFECT_SEC / 2)[0].fade - 0.5) < 1e-9);
  assert.equal(activeGlows(e, 2 + HIT_EFFECT_SEC - 0.01).length, 1);
  assert.equal(activeGlows(e, 2 + HIT_EFFECT_SEC + 0.01).length, 0);
  assert.equal(activeGlows(e, 1.9).length, 0); // 未来のヒットは光らない
});

test('activeGlows: エフェクトの無いレーン(MISSED・空打ち)は光らない', () => {
  assert.deepEqual(activeGlows(effects({}), 5), []);
});
