import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowBands, zoneOfNote, judgeDelta, GOOD_WINDOW_SEC, PERFECT_WINDOW_SEC } from '../src/judge.js';
import { PERFECT_WINDOW_MS, GOOD_WINDOW_MS } from '../src/constants.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('窓の秒数は constants.js のms定数から導かれる(定数を変えれば帯も追従)', () => {
  near(PERFECT_WINDOW_SEC, PERFECT_WINDOW_MS / 1000);
  near(GOOD_WINDOW_SEC, GOOD_WINDOW_MS / 1000);
  const b = windowBands(0);
  near(b.perfect[1] - b.perfect[0], 2 * PERFECT_WINDOW_MS / 1000);
  near(b.good[1] - b.good[0], 2 * GOOD_WINDOW_MS / 1000);
});

test('windowBands: オフセット0なら判定ライン中心で左右対称、PERFECTはGOODの内側', () => {
  const b = windowBands(0);
  near(b.good[0], -b.good[1]);
  near(b.perfect[0], -b.perfect[1]);
  assert.ok(b.good[0] < b.perfect[0] && b.perfect[1] < b.good[1]);
});

test('windowBands: オフセット分だけ中心がずれる(正 = 遅れて叩く人 → 窓の中心は dt<0 = ラインを過ぎたノーツ)', () => {
  const b = windowBands(0.04);
  near((b.perfect[0] + b.perfect[1]) / 2, -0.04);
  near((b.good[0] + b.good[1]) / 2, -0.04);
});

test('zoneOfNote は実際の判定(judgeDelta)と一致し、帯の境界と同じ位置で切り替わる', () => {
  for (const off of [0, 0.04, -0.03]) {
    const b = windowBands(off);
    const eps = 1e-6;
    assert.equal(zoneOfNote((b.perfect[0] + b.perfect[1]) / 2, off), 'PERFECT');
    assert.equal(zoneOfNote(b.perfect[1] - eps, off), 'PERFECT');
    assert.equal(zoneOfNote(b.perfect[1] + eps, off), 'GOOD');
    assert.equal(zoneOfNote(b.perfect[0] - eps, off), 'GOOD');
    assert.equal(zoneOfNote(b.good[1] - eps, off), 'GOOD');
    assert.equal(zoneOfNote(b.good[1] + eps, off), null);
    assert.equal(zoneOfNote(b.good[0] - eps, off), null);
    // 判定そのもの: 叩いた時刻 = t のとき delta = t - off - note.time = -dt - off
    for (const dt of [-0.2, -0.1, -0.05, 0, 0.03, 0.08, 0.2]) {
      assert.equal(zoneOfNote(dt, off), judgeDelta(-dt - off));
    }
  }
});
