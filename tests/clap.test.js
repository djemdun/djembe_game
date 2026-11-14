import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNotation } from '../src/notation.js';
import { buildPlayNotes } from '../src/chart.js';
import { Game } from '../src/game.js';
import { selectAutoNotes } from '../src/autoplay.js';
import { clapVoice, CLAP_PARAMS, createNoiseBuffer } from '../src/voices.js';
import { LANES, CLAP_LANE_SOUND } from '../src/constants.js';
import { THEME } from '../src/theme.js';

const HEADER = 'タイトル: T\nBPM: 120\n拍子: 4\n\n';
const parse = (body) => parseNotation(`${HEADER}[A]\n${body}`);
const LEFT_HIGH = LANES.findIndex((l) => l.hand === 'L' && l.sound === CLAP_LANE_SOUND);
const RIGHT_HIGH = LANES.findIndex((l) => l.hand === 'R' && l.sound === CLAP_LANE_SOUND);

test('文字譜: カ はクラップ1ノーツ(警告なし)。位置は休符と同じく数えるので、後ろの音の手は変わらない', () => {
  const r = parse('カッタ'.padEnd(16, 'ッ')); // カ=位置1, ッ=2, タ=位置3 → 奇数 = 右
  assert.deepEqual(r.warnings, []);
  assert.deepEqual(r.chart.notes.map((n) => [n.beat, n.sound]), [[0, 'clap'], [1, 'high']]);
  assert.equal(r.chart.notes[1].hand, 'R');
  assert.equal(r.chart.notes[0].flam, false);
});

test('展開: クラップは左高と右高に同じ時刻で降る2ノーツ(音は clap のまま)', () => {
  const play = buildPlayNotes(parse('ッカッッッッッッッッッッッッ').chart, 0);
  assert.equal(play.length, 2);
  assert.deepEqual(play.map((n) => n.lane).sort(), [LEFT_HIGH, RIGHT_HIGH].sort());
  assert.equal(play[0].time, play[1].time);
  assert.ok(play.every((n) => n.sound === 'clap'));
});

test('展開: 自動音([パート] 自動音)のクラップは、左右とも autoPlay になる', () => {
  const r = parseNotation(`${HEADER}[A] 自動音\nカッッッッッッッッッッッッッッ`);
  const play = buildPlayNotes(r.chart, 0);
  assert.equal(play.length, 2);
  assert.ok(play.every((n) => n.autoPlay));
  assert.equal(selectAutoNotes(play, false).length, 2);
});

test('叩く音: クラップのノーツの判定窓内なら clap、窓の外・他のノーツ・空打ちはレーンの音', () => {
  const notes = buildPlayNotes(parse('ッカッタッッッッッッッッッッ').chart, 0); // クラップ(beat 0.5 = 0.25秒)の後ろにタ
  const g = new Game(notes);
  const clapAt = notes[0].time;
  assert.equal(g.soundFor(LEFT_HIGH, clapAt), 'clap');
  assert.equal(g.soundFor(RIGHT_HIGH, clapAt + 0.05), 'clap');
  assert.equal(g.soundFor(LEFT_HIGH, clapAt - 0.5), 'high'); // まだ遠い
  assert.equal(g.soundFor(1, clapAt), 'mid'); // 別のレーンは自分の音
  // 判定したあとは、次のノーツ(ふつうの高音)を見る
  g.hit(LEFT_HIGH, clapAt);
  assert.equal(g.soundFor(LEFT_HIGH, clapAt + 0.01), 'high');
});

test('判定: クラップは左右のレーンで別々に判定され、片方だけ叩けば片方は MISSED', () => {
  const notes = buildPlayNotes(parse('カッッッッッッッッッッッッッッ').chart, 0);
  const g = new Game(notes);
  assert.equal(g.hit(LEFT_HIGH, 0), 'PERFECT');
  g.update(1);
  assert.deepEqual(g.counts, { PERFECT: 1, GOOD: 0, MISSED: 1 });
});

test('色: クラップの色が theme にあり、他の音の色と別', () => {
  assert.match(THEME.sound.clap, /^#[0-9a-f]{6}$/i);
  const others = [THEME.sound.high, THEME.sound.mid, THEME.sound.low].map((c) => c.toLowerCase());
  assert.ok(!others.includes(THEME.sound.clap.toLowerCase()));
});

test('clapVoice: 連打+余韻を予約し、ノイズ素材の範囲を超えて読まない。呼ぶたびに読み出し位置が変わる', () => {
  const calls = [];
  const ctx = {
    sampleRate: 8000,
    createBuffer: (_ch, len, rate) => ({ duration: len / rate, getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => { const s = { connect: (n) => n, start: (...a) => calls.push(a), stop() {} }; return s; },
    createBiquadFilter: () => ({ frequency: {}, Q: {}, connect: (n) => n }),
    createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n) => n }),
  };
  const buf = createNoiseBuffer(ctx);
  const voice = clapVoice(buf, CLAP_PARAMS);
  voice(ctx, 1, {});
  assert.equal(calls.length, CLAP_PARAMS.bursts + 1);
  assert.equal(calls[0][0], 1); // 最初の連打は when ちょうど
  for (const [start, offset] of calls) {
    assert.ok(start >= 1);
    assert.ok(offset >= 0 && offset + CLAP_PARAMS.tailDecay + 0.05 <= buf.duration, `offset ${offset} が素材の長さを超える`);
  }
  // 2回呼ぶ(左高と右高が同時に鳴る)と、読み出し位置が異なる = 同じ波形の重なりにならない
  const first = calls.map((c) => c[1]);
  calls.length = 0;
  voice(ctx, 1, {});
  assert.notDeepEqual(calls.map((c) => c[1]), first);
});
