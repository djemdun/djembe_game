import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { GOOD_WINDOW_SEC } from '../src/judge.js';

const note = (time, lane = 4) => ({ time, lane, sound: 'mid', autoPlay: false, result: null });

test('ヒットエフェクト: PERFECT/GOODのとき、叩いたレーンに結果と時刻が入る', () => {
  const g = new Game([note(1, 4), note(2, 1)]);
  assert.equal(g.hit(4, 1.0), 'PERFECT');
  assert.deepEqual(g.laneEffects[4], { result: 'PERFECT', at: 1.0 });
  assert.equal(g.hit(1, 2.0 + 0.1), 'GOOD');
  assert.deepEqual(g.laneEffects[1], { result: 'GOOD', at: 2.1 });
  assert.equal(g.laneEffects[0], null);
});

test('ヒットエフェクト: MISSEDと空打ちでは出ない', () => {
  const g = new Game([note(1, 4)]);
  assert.equal(g.hit(4, 0.2), null); // 早すぎて窓の外 = 空打ち
  assert.equal(g.laneEffects[4], null);
  g.update(1 + GOOD_WINDOW_SEC + 0.01); // 見逃し → MISSED
  assert.equal(g.counts.MISSED, 1);
  assert.equal(g.laneEffects[4], null);
});

test('ヒットエフェクトは判定オフセットを含めた判定結果に従う', () => {
  const g = new Game([note(1, 4)]);
  g.offsetSec = 0.04;
  assert.equal(g.hit(4, 1.04), 'PERFECT');
  assert.equal(g.laneEffects[4].result, 'PERFECT');
});
