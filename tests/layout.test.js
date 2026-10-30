import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, noteRadius, hitRingMaxRadius, JUDGE_Y_RATIO } from '../src/layout.js';
import { HIT_RING_START, HIT_RING_GROW, HIT_RING_LINE_MAX, FALL_SEC } from '../src/constants.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('判定ラインの位置は canvas 高さの 0.8 のまま(余白を足しても動かない)', () => {
  for (const [w, h] of [[360, 640], [390, 664], [1024, 768]]) {
    near(computeLayout(w, h).judgeY, h * JUDGE_Y_RATIO);
    near(JUDGE_Y_RATIO, 0.8);
  }
});

test('余白 = リング最大半径(定数から計算)を切り上げた値。判定ラインの下に確保される', () => {
  const l = computeLayout(390, 664);
  const r = noteRadius(l.laneW);
  near(l.noteR, r);
  assert.equal(l.ringMargin, Math.ceil(r * (HIT_RING_START + HIT_RING_GROW) + HIT_RING_LINE_MAX / 2));
  assert.ok(l.ringMargin >= r * (HIT_RING_START + HIT_RING_GROW)); // 外縁より小さくならない
  near(l.labelTop, l.judgeY + l.ringMargin);
  near(l.labelTop + l.labelH, 664);
});

test('hitRingMaxRadius: エフェクトのサイズ定数に比例して増える', () => {
  assert.ok(hitRingMaxRadius(30) > hitRingMaxRadius(20));
  near(hitRingMaxRadius(10), 10 * (HIT_RING_START + HIT_RING_GROW) + HIT_RING_LINE_MAX / 2);
});

test('ノーツの落下距離は judgeY のまま(FALL_SEC で上端から判定ラインまで)', () => {
  const l = computeLayout(390, 664);
  near(l.judgeY, 664 * 0.8);
  assert.ok(FALL_SEC > 0);
});

test('スマホ縦画面(代表的な表示領域)でキー表示の帯が潰れない', () => {
  // [幅, 高さ]: 小型端末〜大型端末の、ブラウザのバーを除いた表示領域の目安
  const sizes = [[320, 460], [360, 560], [375, 553], [390, 664], [412, 732], [430, 760]];
  for (const [w, h] of sizes) {
    const l = computeLayout(w, h);
    assert.ok(l.labelH >= 40, `${w}x${h}: labelH=${l.labelH.toFixed(1)} (ringMargin=${l.ringMargin})`);
  }
});
