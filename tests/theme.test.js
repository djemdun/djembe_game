import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THEME } from '../src/theme.js';

/** 葉(色の文字列・数値)を [パス, 値] で列挙 */
function leaves(obj, path = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? leaves(v, `${path}${k}.`) : [[`${path}${k}`, v]]);
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA = /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)$/;

test('theme: すべての値が 色(#rgb / #rrggbb / rgba)か 0..1 の数値', () => {
  for (const [path, v] of leaves(THEME)) {
    if (typeof v === 'number') assert.ok(v >= 0 && v <= 1, `${path} = ${v}`);
    else assert.ok(HEX.test(v) || RGBA.test(v), `${path} = ${v}`);
  }
});

test('theme: lighten に渡す音の色は #rrggbb(3桁や rgba だと白への混ぜ計算ができない)', () => {
  for (const [s, c] of Object.entries(THEME.sound)) assert.match(c, /^#[0-9a-f]{6}$/i, s);
});

test('theme: 音の色(高・中・低)は互いに別、判定の色(PERFECT・GOOD・MISSED)とも別(取り違え防止)', () => {
  const sounds = Object.values(THEME.sound).map((c) => c.toLowerCase());
  const judgements = Object.values(THEME.judgement).map((c) => c.toLowerCase());
  assert.equal(new Set([...sounds, ...judgements]).size, sounds.length + judgements.length);
});

test('theme: PERFECT帯のほうがGOOD帯より白に寄る(goodMix < perfectMix)', () => {
  assert.ok(THEME.note.goodMix < THEME.note.perfectMix);
});
