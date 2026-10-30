import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAutoNotes, autoNotesInWindow } from '../src/autoplay.js';
import { buildPlayNotes, withSpeed } from '../src/chart.js';
import { gridOf, leadInSec } from '../src/beats.js';

const note = (beat, over = {}) => ({ beat, sound: 'mid', hand: 'R', flam: false, ...over });
const chart = (notes, bpm = 120) => ({ bpm, beatsPerBar: 4, totalBeats: 16, notes });
const play = (c) => buildPlayNotes(c, leadInSec(gridOf(c)));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('selectAutoNotes: autoPlayだけを時刻順に', () => {
  const notes = play(chart([note(2, { autoPlay: true }), note(1), note(0, { autoPlay: true })]));
  const times = selectAutoNotes(notes).map((n) => n.time);
  assert.deepEqual(times, [...times].sort((x, y) => x - y));
  assert.equal(selectAutoNotes(notes).length, 2);
  assert.ok(selectAutoNotes(notes).every((n) => n.autoPlay));
});

test('窓を連結すると、重複も欠落もなく全自動音が1回ずつ出る', () => {
  const c = chart([0, 0.5, 1, 1.5, 2, 3, 4.5].map((b) => note(b, { autoPlay: true })), 130);
  const auto = selectAutoNotes(play(c));
  const got = [];
  for (let t = 0; t < 12; t += 0.0833) got.push(...autoNotesInWindow(auto, t, t + 0.0833));
  assert.deepEqual(got, auto);
});

test('窓の境界ちょうどの自動音は後ろの窓に属する', () => {
  const auto = selectAutoNotes(play(chart([note(0, { autoPlay: true })]))); // 120BPM: リードイン2秒 → time=2
  near(auto[0].time, 2);
  assert.equal(autoNotesInWindow(auto, 1, 2).length, 0);
  assert.equal(autoNotesInWindow(auto, 2, 3).length, 1);
});

test('リードイン: 自動音の時刻はリードイン後(拍0 = leadInSec)から', () => {
  const c = chart([note(0, { autoPlay: true })]);
  const auto = selectAutoNotes(play(c));
  near(auto[0].time, leadInSec(gridOf(c)));
  assert.equal(autoNotesInWindow(auto, 0, leadInSec(gridOf(c))).length, 0); // カウントイン中は鳴らない
});

test('速さ倍率: 倍率に応じて時刻が伸びる(譜面の拍は同じ)', () => {
  const base = chart([note(4, { autoPlay: true })]);
  for (const speed of [0.5, 0.85, 1, 1.5]) {
    const c = withSpeed(base, speed);
    const [n] = selectAutoNotes(play(c));
    const spb = 60 / (120 * speed);
    near(n.time, 4 * spb + 4 * spb); // リードイン4拍 + 拍4
  }
});

test('フラムの自動音: 前打音と本音の2つが、本音の直前・本音の時刻に出る', () => {
  const c = chart([note(2, { flam: true, autoPlay: true })]);
  const auto = selectAutoNotes(play(c));
  assert.equal(auto.length, 2);
  assert.ok(auto[0].time < auto[1].time);
  near(auto[1].time - auto[0].time, 0.125 * 0.5);
});

test('autoPlayの無い譜面では空', () => {
  assert.deepEqual(selectAutoNotes(play(chart([note(0), note(1)]))), []);
});

// --- 全部自動演奏 ---
test('selectAutoNotes(all): autoPlayの印に関係なく全ノーツを時刻順に', () => {
  const notes = play(chart([note(3), note(1, { autoPlay: true }), note(2)]));
  assert.equal(selectAutoNotes(notes).length, 1);
  const all = selectAutoNotes(notes, true);
  assert.equal(all.length, 3);
  assert.deepEqual(all.map((n) => n.time), [...all.map((n) => n.time)].sort((a, b) => a - b));
});

test('全部自動演奏: 窓を連結すると全ノーツが重複・欠落なく1回ずつ出る(フラム含む)', () => {
  const c = chart([note(0, { flam: true }), note(0.5), note(1), note(1.5, { flam: true }), note(2), note(3.5)], 130);
  const all = selectAutoNotes(play(c), true);
  assert.equal(all.length, 8); // フラム2つ → 前打音が2つ増える
  const got = [];
  for (let t = 0; t < 12; t += 0.0833) got.push(...autoNotesInWindow(all, t, t + 0.0833));
  assert.deepEqual(got, all);
});

test('全部自動演奏: リードイン中は鳴らず、速さ倍率が時刻に反映される', () => {
  for (const speed of [0.5, 0.85, 1, 1.5]) {
    const c = withSpeed(chart([note(0), note(4)]), speed);
    const g = gridOf(c);
    const all = selectAutoNotes(play(c), true);
    assert.equal(autoNotesInWindow(all, 0, leadInSec(g)).length, 0); // カウントイン中は空
    near(all[0].time, leadInSec(g));
    near(all[1].time, leadInSec(g) + 4 * 60 / c.bpm);
  }
});
