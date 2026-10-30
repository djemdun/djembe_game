import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drumLayout, drumLaneColumn, activeGlows } from '../src/drum.js';
import { computeLayout } from '../src/layout.js';
import { LANES, LANE_COUNT, HIT_EFFECT_SEC } from '../src/constants.js';

const effects = (/** @type {Record<number, object>} */ m) => LANES.map((_, i) => m[i] ?? null);
const SIZES = [[390, 800], [360, 640], [667, 375], [1280, 720], [320, 480], [820, 1180]];
const layoutOf = (w, h) => { const l = computeLayout(w, h); return { l, d: drumLayout(l.x0, l.areaW, l.judgeY) }; };

test('drumLayout: 幅はレーン領域いっぱい、下端は判定ライン、中心線(上辺)より上は無い', () => {
  for (const [w, h] of SIZES) {
    const { l, d } = layoutOf(w, h);
    assert.equal(d.cx - d.rx, l.x0, `${w}x${h} 左端`);
    assert.ok(Math.abs(d.cx + d.rx - (l.x0 + l.areaW)) < 1e-9, `${w}x${h} 右端`);
    assert.ok(Math.abs(d.cy + d.ry - l.judgeY) < 1e-9, `${w}x${h} 下端 = 判定ライン`);
    assert.ok(d.cy >= 0, `${w}x${h} 上辺が画面内`);
  }
});

test('drumLayout: 縦画面では半円(奥行き = 半幅)、横長で高さが足りなければ奥行きだけ縮む', () => {
  const p = layoutOf(390, 800).d;
  assert.equal(p.ry, p.rx);
  const ls = layoutOf(667, 375).d;
  assert.ok(ls.ry < ls.rx);
  assert.equal(ls.rx, computeLayout(667, 375).areaW / 2); // 幅は縮めない(光る位置をレーンに合わせるため)
});

test('drumLaneColumn: 光る帯はノーツのレーンと同じ x 範囲で、隙間なく並ぶ', () => {
  for (const [w, h] of SIZES) {
    const { l, d } = layoutOf(w, h);
    for (let i = 0; i < LANE_COUNT; i++) {
      const c = drumLaneColumn(d, i);
      assert.ok(Math.abs(c.x - (l.x0 + i * l.laneW)) < 1e-9, `${w}x${h} lane${i} x`);
      assert.ok(Math.abs(c.w - l.laneW) < 1e-9, `${w}x${h} lane${i} w`);
    }
  }
});

test('光る位置の並び: 中央が低音、その外側が中音、左右の端が高音。左手=左半分、右手=右半分', () => {
  const { d } = layoutOf(390, 800);
  const dist = (/** @type {number} */ lane) => { const c = drumLaneColumn(d, lane); return Math.abs(c.x + c.w / 2 - d.cx); };
  for (const hand of ['L', 'R']) {
    const [high, mid, low] = ['high', 'mid', 'low'].map((s) => LANES.findIndex((x) => x.hand === hand && x.sound === s));
    assert.ok(dist(low) < dist(mid) && dist(mid) < dist(high), `${hand} 中央ほど低音`);
    for (const lane of [high, mid, low]) {
      const c = drumLaneColumn(d, lane);
      const center = c.x + c.w / 2;
      assert.ok(hand === 'L' ? center < d.cx : center > d.cx, `${hand} の半分`);
    }
  }
});

test('activeGlows: ヒットのあったレーンだけ、レーン定義どおりの音と手で返る', () => {
  const g = activeGlows(effects({ 0: { result: 'PERFECT', at: 1 }, 3: { result: 'GOOD', at: 1 } }), 1.1);
  assert.deepEqual(g.map((x) => [x.lane, x.sound, x.hand, x.result]), [[0, 'high', 'L', 'PERFECT'], [3, 'low', 'R', 'GOOD']]);
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
