import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSettings, parseSpeedParam, DEFAULT_SETTINGS, SPEED_MIN, SPEED_MAX } from '../src/settings.js';

test('sanitizeSettings: 不正値は項目ごとに既定値へ', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('x'), DEFAULT_SETTINGS);
  const s = sanitizeSettings({ beatOn: 'yes', beatVolume: 5, beatLines: false, speed: 'fast' });
  assert.equal(s.beatOn, DEFAULT_SETTINGS.beatOn);
  assert.equal(s.beatVolume, 1); // 範囲に丸める
  assert.equal(s.beatLines, false);
  assert.equal(s.speed, DEFAULT_SETTINGS.speed); // 数値でない
  assert.equal(sanitizeSettings({ speed: NaN }).speed, DEFAULT_SETTINGS.speed);
});

test('sanitizeSettings: 速さは0.5〜1.5にクランプ', () => {
  assert.equal(sanitizeSettings({ speed: 0.1 }).speed, SPEED_MIN);
  assert.equal(sanitizeSettings({ speed: 9 }).speed, SPEED_MAX);
  assert.equal(sanitizeSettings({ speed: 0.75 }).speed, 0.75);
  assert.equal(sanitizeSettings({ speed: 1.5 }).speed, 1.5);
  assert.deepEqual([SPEED_MIN, SPEED_MAX], [0.5, 1.5]);
});

test('sanitizeSettings: 正常値はそのまま', () => {
  const v = { beatOn: false, beatVolume: 0.3, beatLines: false, speed: 0.85 };
  assert.deepEqual(sanitizeSettings(v), v);
});

test('parseSpeedParam', () => {
  assert.equal(parseSpeedParam(null), null);
  assert.equal(parseSpeedParam(''), null);
  assert.equal(parseSpeedParam('abc'), null);
  assert.equal(parseSpeedParam('0'), null);
  assert.equal(parseSpeedParam('100'), null);
  assert.equal(parseSpeedParam('0.75'), 0.75);
  assert.equal(parseSpeedParam('0.1'), 0.1); // URLはスライダー範囲外も許す
  assert.equal(parseSpeedParam('4'), 4);
  assert.equal(parseSpeedParam('0.09'), null);
  assert.equal(parseSpeedParam('4.1'), null);
});
