import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNotation, assignHand } from '../src/notation.js';
import { buildPlayNotes, withSpeed } from '../src/chart.js';

const HEADER = 'タイトル: T\nBPM: 120\n拍子: 4\n';
/** パート内の文字列(1行16文字×n)だけ渡して解析 */
const parseBody = (body) => parseNotation(`${HEADER}\n${body}`);

test('ヘッダーを読む', () => {
  const r = parseNotation('タイトル: Djole\nBPM: 130\n拍子: 4\n\n[A]\nッッッッッッッッッッッッッッッッ');
  assert.equal(r.title, 'Djole');
  assert.equal(r.bpm, 130);
  assert.equal(r.beatsPerBar, 4);
  assert.deepEqual(r.warnings, []);
});

test('BPMが無いとエラー', () => {
  assert.throws(() => parseNotation('タイトル: x\n[A]\nッッッッッッッッッッッッッッッッ'), /BPM/);
});

test('伴奏: 手順(位置の奇偶で右/左、休符も数える)', () => {
  const r = parseBody('[伴奏]\nドットトドッタタドットトドッタタ');
  const got = r.chart.notes.map((n) => `${n.beat}:${n.sound}:${n.hand}`);
  assert.deepEqual(got, [
    '0:low:R',     // 位置1 ド
    '1:mid:R',     // 位置3 ト
    '1.5:mid:L',   // 位置4 ト
    '2:low:R',     // 位置5 ド
    '3:high:R',    // 位置7 タ
    '3.5:high:L',  // 位置8 タ
    '4:low:R',     // 位置9 ド
    '5:mid:R',     // 位置11
    '5.5:mid:L',   // 位置12
    '6:low:R',     // 位置13
    '7:high:R',    // 位置15
    '7.5:high:L',  // 位置16
  ]);
  assert.ok(r.chart.notes.every((n) => !n.flam));
});

test('フラム: 奇数位置は 前打音=右・本音=左、偶数位置は 前打音=左・本音=右', () => {
  const r = parseBody('[A]\nラロッッッッッッッッッッッッッ'); // 位置1=ラ(高フラム) 位置2=ロ(中フラム)
  assert.deepEqual(r.chart.notes, [
    { beat: 0, sound: 'high', hand: 'L', flam: true }, // 本音 左 ← 前打音 右
    { beat: 0.5, sound: 'mid', hand: 'R', flam: true }, // 本音 右 ← 前打音 左
  ]);
  // 展開後: 前打音は本音の反対の手
  const play = buildPlayNotes(r.chart, 0);
  assert.equal(play.length, 4);
  const [g1, m1, g2, m2] = play; // 時刻順: 位置1の前打音, 位置1の本音, 位置2の前打音, 位置2の本音
  assert.deepEqual([g1.lane, m1.lane], [5, 0]); // 右高 → 左高
  assert.deepEqual([g2.lane, m2.lane], [1, 4]); // 左中 → 右中
  assert.ok(g1.time < m1.time && g2.time < m2.time);
});

test('assignHand: 通常音とフラムの対応', () => {
  assert.equal(assignHand(1, false), 'R');
  assert.equal(assignHand(2, false), 'L');
  assert.equal(assignHand(1, true), 'L');
  assert.equal(assignHand(2, true), 'R');
});

test('食い: 小節末尾の音も書かれた位置の奇偶で手が決まる', () => {
  // 位置8(偶数,1小節目の末尾) と 位置16(偶数,2小節目の末尾) と 位置15(奇数)
  const r = parseBody('[A]\nッッッッッッッタッッッッッッタタ');
  assert.deepEqual(
    r.chart.notes.map((n) => [n.beat, n.hand]),
    [[3.5, 'L'], [7, 'R'], [7.5, 'L']],
  );
});

test('パートごとに位置を数え直す', () => {
  // どちらのパートも先頭の「ト」は位置1 = 右。2パート目の先頭がグローバル位置17でも右
  const r = parseBody('[A]\nトッッッッッッッッッッッッッッッ\n\n[B]\nトッッッッッッッッッッッッッッッ');
  assert.deepEqual(r.chart.notes.map((n) => [n.beat, n.hand]), [[0, 'R'], [8, 'R']]);
});

test('x8: パートが8回複製され、beatがパート長ずつずれ、後続パートも後ろへ送られる', () => {
  const r = parseBody('[伴奏] x8\nドットトドッタタドットトドッタタ\n\n[終]\nタッッッッッッッッッッッッッッッ');
  const once = 12;
  const acc = r.chart.notes.filter((n) => n.sound !== 'high' || n.beat < 64);
  assert.equal(acc.length, once * 8);
  // 繰り返しごとに +8拍(16文字 = 8拍)、手・音は同一
  for (let rep = 0; rep < 8; rep++) {
    const slice = acc.slice(rep * once, (rep + 1) * once);
    assert.deepEqual(
      slice.map((n) => ({ ...n, beat: n.beat - rep * 8 })),
      acc.slice(0, once),
    );
  }
  // 後続パートは 8拍×8回 = 64拍目から
  const last = r.chart.notes.at(-1);
  assert.equal(last.beat, 64);
  assert.equal(r.totalBeats, 72);
});

test('x の表記ゆれ(X / ×)と繰り返し0の警告', () => {
  const body = 'ッッッッッッッッッッッッッッッッ';
  assert.equal(parseBody(`[A] ×3\n${body}`).totalBeats, 24);
  assert.equal(parseBody(`[A] X2\n${body}`).totalBeats, 16);
  const z = parseBody(`[A] x0\n${body}`);
  assert.equal(z.totalBeats, 8);
  assert.equal(z.warnings.length, 1);
});

test('行の文字数が16でなければ警告(行番号つき)、読み込みは続行', () => {
  const r = parseBody('[A]\nドットトドッタタドットトドッタ\nドットトドッタタドットトドッタタタ');
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0].message, /16文字.*15文字/);
  assert.match(r.warnings[1].message, /16文字.*17文字/);
  // ヘッダー4行 + 空行1 + [A] の次が6行目
  assert.deepEqual(r.warnings.map((w) => w.line), [6, 7]);
  assert.ok(r.chart.notes.length > 0);
});

test('16文字ちょうどなら警告なし(空白は無視)', () => {
  const r = parseBody('[A]\nドット トドッ タタド ットトドッタタ');
  assert.deepEqual(r.warnings, []);
});

test('未対応文字は警告して休符扱い(位置は数える)', () => {
  const r = parseBody('[A]\nXトッッッッッッッッッッッッッッ');
  assert.equal(r.warnings.length, 1);
  assert.deepEqual(r.chart.notes.map((n) => [n.beat, n.hand]), [[0.5, 'L']]);
});

test('パート外の譜面はエラー', () => {
  assert.throws(() => parseNotation('BPM: 100\nドットトドッタタドットトドッタタ'), /パート/);
});

test('速さ倍率: beatは変えず bpm だけ倍率をかける', () => {
  const { chart } = parseBody('[A]\nタッッッッッッッッッッッッッッッ');
  const half = withSpeed(chart, 0.5);
  assert.equal(half.bpm, 60);
  assert.equal(chart.bpm, 120); // 元は不変
  assert.deepEqual(half.notes, chart.notes);
  const t = (c) => buildPlayNotes(c, 0)[0].time;
  assert.equal(t(half), t(chart)); // beat 0 は同じ
  const withLater = { ...chart, notes: [{ ...chart.notes[0], beat: 4 }] };
  assert.equal(buildPlayNotes(withSpeed(withLater, 0.5), 0)[0].time, 2 * buildPlayNotes(withLater, 0)[0].time);
  assert.throws(() => withSpeed(chart, 0), /speed/);
});

test('songs/djole.txt: 30小節・警告なし・構成どおり', () => {
  const r = parseNotation(readFileSync(new URL('../songs/djole.txt', import.meta.url), 'utf8'));
  assert.equal(r.title, 'Djole');
  assert.equal(r.bpm, 130);
  assert.equal(r.beatsPerBar, 4);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.totalBeats / r.beatsPerBar, 30);
  // 合図9 + 伴奏12×8 + ショフ(13×3... 下の内訳) + 合図9
  assert.equal(r.chart.notes.length, 9 + 96 + 61 + 9 + 9);
  // 冒頭の「ロ」= 位置1 の中音フラム → 本音は左
  assert.deepEqual(r.chart.notes[0], { beat: 0, sound: 'mid', hand: 'L', flam: true });
  // 伴奏の頭は 合図(4拍×2小節=8拍)の直後
  const firstAcc = r.chart.notes.find((n) => n.beat >= 8);
  assert.deepEqual(firstAcc, { beat: 8, sound: 'low', hand: 'R', flam: false });
});
