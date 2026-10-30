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

// --- 全部自動演奏(お手本) ---
const autoNote = (time, lane) => ({ time, lane, sound: 'mid', autoPlay: false, result: null });

test('autoAll: ノーツは時刻ちょうどにPERFECTとして消化され、MISSEDにならない', () => {
  const g = new Game([autoNote(1, 4), autoNote(2, 1), autoNote(3, 4)], { autoAll: true });
  g.update(0.99);
  assert.equal(g.judgedCount, 0);
  g.update(1); // 時刻ちょうど(以下)で消化
  assert.equal(g.judgedCount, 1);
  g.update(2.5);
  assert.equal(g.judgedCount, 2);
  g.update(100);
  assert.deepEqual(g.counts, { PERFECT: 3, GOOD: 0, MISSED: 0 });
});

test('autoAll: エフェクトとレーンの光は、ノーツの時刻(フレーム時刻ではない)で記録される', () => {
  const g = new Game([autoNote(1, 4), autoNote(2, 1)], { autoAll: true });
  g.update(1.5); // フレームが遅れても at はノーツの時刻
  assert.deepEqual(g.laneEffects[4], { result: 'PERFECT', at: 1 });
  assert.equal(g.laneHitAt[4], 1);
  assert.equal(g.laneEffects[1], null); // 2秒のノーツはまだ
  g.update(2);
  assert.deepEqual(g.laneEffects[1], { result: 'PERFECT', at: 2 });
});

test('autoAll: 判定オフセットは掛からない(offsetSecが非0でも時刻ちょうど)', () => {
  const g = new Game([autoNote(1, 4)], { autoAll: true });
  g.offsetSec = 0.1; // 呼び出し側は0にするが、仮に残っていても無関係
  g.update(1);
  assert.equal(g.judgedCount, 1);
});

test('autoAll: プレイヤーの入力は判定に使わない(消化済み・未消化どちらも)', () => {
  const g = new Game([autoNote(1, 4)], { autoAll: true });
  assert.equal(g.hit(4, 1.0), null); // ちょうどの時刻でも判定されない
  assert.equal(g.judgedCount, 0);
  assert.equal(g.laneEffects[4], null);
  assert.equal(g.laneHitAt[4], 1.0); // レーンの光だけは出る
  g.update(1);
  assert.equal(g.counts.PERFECT, 1); // 自動演奏が消化する
});

test('autoAll: 同一レーンの連続ノーツも順に消化される', () => {
  const g = new Game([autoNote(1, 4), autoNote(1.5, 4), autoNote(2, 4)], { autoAll: true });
  g.update(1.6);
  assert.equal(g.judgedCount, 2);
  assert.deepEqual(g.laneEffects[4], { result: 'PERFECT', at: 1.5 });
});

test('autoAll: 最後のノーツ+余韻で終了と判定される', () => {
  const g = new Game([autoNote(1, 4)], { autoAll: true });
  g.update(1);
  assert.equal(g.isFinished(1), false); // 余韻(END_PAD_SEC)待ち
  assert.equal(g.isFinished(1 + 1), true);
});
