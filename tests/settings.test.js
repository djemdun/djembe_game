import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSettings, parseSpeedParam, DEFAULT_SETTINGS } from '../src/settings.js';

test('sanitizeSettings: 不正値は項目ごとに既定値へ', () => {
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('x'), DEFAULT_SETTINGS);
  const s = sanitizeSettings({ beatOn: 'yes', beatVolume: 5, beatLines: false, speed: 0.75 });
  assert.equal(s.beatOn, DEFAULT_SETTINGS.beatOn);
  assert.equal(s.beatVolume, 1); // 範囲に丸める
  assert.equal(s.beatLines, false);
  assert.equal(s.speed, DEFAULT_SETTINGS.speed); // 選択肢外
});

test('sanitizeSettings: 正常値はそのまま', () => {
  const v = { beatOn: false, beatVolume: 0.3, beatLines: false, speed: 0.7 };
  assert.deepEqual(sanitizeSettings(v), v);
});

test('parseSpeedParam', () => {
  assert.equal(parseSpeedParam(null), null);
  assert.equal(parseSpeedParam(''), null);
  assert.equal(parseSpeedParam('abc'), null);
  assert.equal(parseSpeedParam('0'), null);
  assert.equal(parseSpeedParam('100'), null);
  assert.equal(parseSpeedParam('0.75'), 0.75);
});
