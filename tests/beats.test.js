import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridOf, leadInSec, beatsInWindow } from '../src/beats.js';
import { buildPlayNotes, withSpeed } from '../src/chart.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const chart = (over = {}) => ({
  bpm: 120, beatsPerBar: 4, totalBeats: 8,
  notes: [{ beat: 2, sound: 'mid', hand: 'R', flam: false }],
  ...over,
});
const all = (g) => beatsInWindow(g, 0, 1e6);

test('小節頭(accent)は譜面の拍子ごと。リードイン中も小節頭から始まる', () => {
  const beats = all(gridOf(chart()));
  assert.deepEqual(beats.map((b) => b.beat), [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(
    beats.map((b) => b.accent),
    [true, false, false, false, true, false, false, false, true, false, false, false],
  );
});

test('拍子3なら3拍ごとに小節頭', () => {
  const beats = all(gridOf(chart({ beatsPerBar: 3, totalBeats: 6 })));
  assert.deepEqual(beats.map((b) => b.beat), [-3, -2, -1, 0, 1, 2, 3, 4, 5]);
  assert.deepEqual(beats.filter((b) => b.accent).map((b) => b.beat), [-3, 0, 3]);
});

test('リードイン: 1小節ぶんで、拍0の時刻 = leadInSec', () => {
  const g = gridOf(chart());
  near(leadInSec(g), 2); // 120BPM: 4拍 = 2秒
  const beats = all(g);
  near(beats[0].time, 0);
  near(beats.find((b) => b.beat === 0).time, leadInSec(g));
  assert.equal(beats.length, 4 + 8);
});

test('速さ倍率: BPMに掛かり、拍の間隔とリードインが伸びる', () => {
  const half = gridOf(withSpeed(chart(), 0.5)); // 60BPM
  near(half.bpm, 60);
  const beats = all(half);
  near(beats[1].time - beats[0].time, 1);
  near(leadInSec(half), 4);
  assert.equal(beats.length, 12); // 拍の数は倍率で変わらない
  assert.equal(beats[0].accent, true); // 倍率が変わってもカウントインは小節頭から
});

test('半開区間の窓を連結すると、重複も欠落もなく全拍が1回ずつ出る', () => {
  const g = gridOf(chart({ bpm: 130 })); // 割り切れないBPM
  const expected = all(g).map((b) => b.beat);
  const got = [];
  for (let t = 0; t < 12; t += 0.0833) got.push(...beatsInWindow(g, t, t + 0.0833).map((b) => b.beat));
  assert.deepEqual(got, expected);
});

test('窓の境界ちょうどの拍は後ろの窓に属する', () => {
  const g = gridOf(chart()); // 拍は0.5秒ごと
  assert.deepEqual(beatsInWindow(g, 0, 0.5).map((b) => b.beat), [-4]);
  assert.deepEqual(beatsInWindow(g, 0.5, 1).map((b) => b.beat), [-3]);
});

test('曲末以降は拍が出ない(端数拍は切り上げ)', () => {
  assert.equal(beatsInWindow(gridOf(chart()), 100, 200).length, 0);
  assert.equal(all(gridOf(chart({ totalBeats: 7.5 }))).length, 4 + 8);
});

test('拍の時刻は buildPlayNotes のノーツ時刻と同じ式(拍線とノーツがずれない)', () => {
  for (const speed of [0.5, 0.7, 0.85, 1]) {
    const c = withSpeed(chart(), speed);
    const g = gridOf(c);
    const note = buildPlayNotes(c, leadInSec(g))[0]; // beat 2
    near(note.time, all(g).find((b) => b.beat === 2).time);
  }
});
