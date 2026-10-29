import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionLabels, labelAlpha, activeLabel } from '../src/sections.js';
import { withSpeed } from '../src/chart.js';
import { FALL_SEC } from '../src/constants.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const chart = (sections, bpm = 120) => ({ bpm, beatsPerBar: 4, totalBeats: 32, notes: [], sections });

test('sectionLabels: 開始時刻 = リードイン + 拍、表示開始はその FALL_SEC 前', () => {
  const [a, b] = sectionLabels(chart([{ beat: 0, name: 'A' }, { beat: 16, name: 'B' }]), 10);
  assert.deepEqual([a.name, b.name], ['A', 'B']);
  near(b.time, 10 + 8); // 120BPM: 16拍 = 8秒
  near(b.showAt, 18 - FALL_SEC);
});

test('冒頭のセクションは表示開始が0未満にならない', () => {
  const [a] = sectionLabels(chart([{ beat: 0, name: 'A' }]), 1); // 1 - 1.6 < 0
  assert.equal(a.showAt, 0);
});

test('速さ倍率: セクションの時刻が倍率に追従する', () => {
  const base = chart([{ beat: 8, name: 'A' }]);
  for (const speed of [0.5, 1, 1.5]) {
    const [a] = sectionLabels(withSpeed(base, speed), 0);
    near(a.time, 8 * 60 / (120 * speed));
  }
});

test('sectionsが無い譜面(demo/easy)では空', () => {
  assert.deepEqual(sectionLabels({ bpm: 120, beatsPerBar: 4, totalBeats: 4, notes: [] }, 2), []);
});

test('表示の長さは文字譜1行分(2小節)の演奏時間で、BPM・倍率に追従する', () => {
  const dur = (c) => sectionLabels(c, 0)[0].duration;
  const base = chart([{ beat: 0, name: 'A' }]); // 120BPM: 8拍 = 4秒
  near(dur(base), 4);
  near(dur(withSpeed(base, 0.5)), 8);
  near(dur(withSpeed(base, 1.5)), 4 / 1.5);
  near(dur({ ...base, bpm: 130 }), 8 * 60 / 130);
  near(dur({ ...base, bpm: 1000 }), 0.8); // 極端に速いときはフェード合計が下限
});

test('labelAlpha: フェードイン → 保持 → フェードアウト → 消える', () => {
  const D = 4;
  assert.equal(labelAlpha(-0.1, D), 0);
  assert.equal(labelAlpha(0, D), 0);
  near(labelAlpha(0.15, D), 0.5);
  assert.equal(labelAlpha(0.3, D), 1);
  assert.equal(labelAlpha(3.4, D), 1); // 保持は 4 - 0.5 まで
  near(labelAlpha(3.75, D), 0.5);
  assert.equal(labelAlpha(4, D), 0);
  assert.equal(labelAlpha(9, D), 0);
});

test('activeLabel: 表示期間中だけ返し、重なるときは後のラベルを優先', () => {
  const labels = sectionLabels(chart([{ beat: 0, name: 'A' }, { beat: 2, name: 'B' }]), 5); // 5秒と6秒開始。長さ各4秒
  assert.equal(activeLabel(labels, 0.1), null); // A の表示開始(5-1.6=3.4)の前
  assert.equal(activeLabel(labels, 3.4 + 0.5).name, 'A');
  assert.equal(activeLabel(labels, 4.4 + 0.5).name, 'B'); // B(showAt 4.4)が始まった後
  assert.equal(activeLabel(labels, 4.4 + 3.9).name, 'B');
  assert.equal(activeLabel(labels, 20), null);
  // 単独のラベルは 3.4 + 4 秒で消える
  const one = sectionLabels(chart([{ beat: 0, name: 'A' }]), 5);
  assert.equal(activeLabel(one, 3.4 + 3.9).name, 'A');
  assert.equal(activeLabel(one, 3.4 + 4.0), null);
});
