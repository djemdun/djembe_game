import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs'; // Node標準のファイル操作
import { parseSongIndex, pickSong } from '../src/songIndex.js';

const idx = parseSongIndex({ default: 'a', songs: [{ id: 'a', title: 'A' }, { id: 'b' }] });

test('parseSongIndex: 正常。titleが無ければidを使う', () => {
  assert.deepEqual(idx, { default: 'a', songs: [{ id: 'a', title: 'A' }, { id: 'b', title: 'b' }] });
});

test('parseSongIndex: 不正な形式は理由つきで例外', () => {
  assert.throws(() => parseSongIndex(null), /オブジェクト/);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [] }), /songs/);
  assert.throws(() => parseSongIndex({ default: 'x', songs: [{ id: 'a' }] }), /default "x"/);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [{ id: '../a' }] }), /id が不正/);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [{ title: 'no id' }] }), /id が不正/);
});

test('pickSong: 未指定は default、一覧にあればそれ、なければ警告して default', () => {
  assert.deepEqual(pickSong(idx, null), { id: 'a', warnings: [] });
  assert.deepEqual(pickSong(idx, 'b'), { id: 'b', warnings: [] });
  const r = pickSong(idx, 'zzz');
  assert.equal(r.id, 'a');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0].message, /zzz.*一覧にありません/);
});

test('songs/index.json: 形式が正しく、全曲のファイルが存在する', () => {
  const raw = JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url), 'utf8'));
  const index = parseSongIndex(raw);
  for (const s of index.songs) {
    assert.ok(existsSync(new URL(`../songs/${s.id}.txt`, import.meta.url)), `songs/${s.id}.txt がありません`);
  }
});
