import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs'; // Node標準のファイル操作
import { parseSongIndex, pickSong, restrictSongs, groupDefaultSong, ADMIN_GROUP } from '../src/songIndex.js';

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

test('songs/index.json: 形式が正しく、全曲のファイルが存在する', () => {
  const raw = JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url), 'utf8'));
  const index = parseSongIndex(raw);
  for (const s of index.songs) {
    assert.ok(existsSync(new URL(`../songs/${s.id}.txt`, import.meta.url)), `songs/${s.id}.txt がありません`);
  }
});

const gidx = parseSongIndex({
  default: 'd',
  songs: [{ id: 'a', groups: ['x', 'y'] }, { id: 'd' }, { id: 'b', groups: ['y'] }, { id: 'c' }],
});
const vis = (/** @type {string[]} */ v) => restrictSongs(gidx, v).index.songs.map((s) => s.id);

test('parseSongIndex: groups は文字列配列。不正や予約語は例外', () => {
  assert.deepEqual(gidx.songs[0].groups, ['x', 'y']);
  assert.equal(gidx.songs[1].groups, undefined);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [{ id: 'a', groups: 'x' }] }), /groups が不正/);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [{ id: 'a', groups: ['../x'] }] }), /groups が不正/);
  assert.throws(() => parseSongIndex({ default: 'a', songs: [{ id: 'a', groups: [ADMIN_GROUP] }] }), /予約語/);
});

test('restrictSongs: 未指定は default のみ / グループ指定は default + 該当グループ(一覧の順) / adminmami は全曲', () => {
  assert.deepEqual(vis([]), ['d']);
  assert.deepEqual(vis(['x']), ['a', 'd']);
  assert.deepEqual(vis(['y']), ['a', 'd', 'b']);
  assert.deepEqual(vis(['x,y']), ['a', 'd', 'b']);
  assert.deepEqual(vis(['x', 'y']), ['a', 'd', 'b']);
  assert.deepEqual(vis([ADMIN_GROUP]), ['a', 'd', 'b', 'c']);
});

test('restrictSongs: 未知のグループは警告して無視(default のみに戻る)', () => {
  const r = restrictSongs(gidx, ['zzz']);
  assert.deepEqual(r.index.songs.map((s) => s.id), ['d']);
  assert.match(r.warnings[0].message, /zzz/);
  assert.deepEqual(vis(['x,zzz']), ['a', 'd']);
});

// ---- グループごとの既定曲(groupDefaults) ----
const ddx = parseSongIndex({
  default: 'd',
  groupDefaults: { x: 'a', y: 'b' },
  songs: [{ id: 'a', groups: ['x', 'y'] }, { id: 'd' }, { id: 'b', groups: ['y'] }, { id: 'c', groups: ['z'] }],
});

test('parseSongIndex: groupDefaults は曲がそのグループに属していること。不正は例外', () => {
  assert.deepEqual(ddx.groupDefaults, { x: 'a', y: 'b' });
  assert.equal(idx.groupDefaults, undefined);
  const base = { default: 'd', songs: [{ id: 'a', groups: ['x'] }, { id: 'd' }] };
  assert.throws(() => parseSongIndex({ ...base, groupDefaults: [] }), /オブジェクト/);
  assert.throws(() => parseSongIndex({ ...base, groupDefaults: { x: 'zzz' } }), /含まれていません/);
  assert.throws(() => parseSongIndex({ ...base, groupDefaults: { y: 'a' } }), /属していません/);
  assert.throws(() => parseSongIndex({ ...base, groupDefaults: { x: 'd' } }), /属していません/);
  assert.throws(() => parseSongIndex({ ...base, groupDefaults: { [ADMIN_GROUP]: 'a' } }), /予約語/);
});

test('groupDefaultSong: 指定した順で最初に既定曲があるグループ。なし・未指定・adminmami は null', () => {
  assert.equal(groupDefaultSong(ddx, ['x']), 'a');
  assert.equal(groupDefaultSong(ddx, ['y']), 'b');
  assert.equal(groupDefaultSong(ddx, ['y,x']), 'b');
  assert.equal(groupDefaultSong(ddx, ['x', 'y']), 'a');
  assert.equal(groupDefaultSong(ddx, ['z,x']), 'a'); // z には既定曲がないので次の x
  assert.equal(groupDefaultSong(ddx, ['z']), null);
  assert.equal(groupDefaultSong(ddx, []), null);
  assert.equal(groupDefaultSong(ddx, [ADMIN_GROUP, 'x']), null);
  assert.equal(groupDefaultSong(ddx, ['constructor']), null);
  assert.equal(groupDefaultSong(idx, ['x']), null); // groupDefaults なし
});

test('restrictSongs: groupDefaults を保つ / pickSong: fallback を既定曲として使う', () => {
  assert.deepEqual(restrictSongs(ddx, ['x']).index.groupDefaults, { x: 'a', y: 'b' });
  assert.deepEqual(pickSong(ddx, null, 'b'), { id: 'b', warnings: [] });
  assert.deepEqual(pickSong(ddx, 'c', 'b'), { id: 'c', warnings: [] });
  const r = pickSong(ddx, 'zzz', 'b');
  assert.equal(r.id, 'b');
  assert.match(r.warnings[0].message, /既定の"b"/);
});

test('songs/index.json: groupDefaults の曲が、そのグループで見える', () => {
  const index = parseSongIndex(JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url), 'utf8')));
  for (const [group, id] of Object.entries(index.groupDefaults ?? {})) {
    assert.ok(restrictSongs(index, [group]).index.songs.some((x) => x.id === id), `${group} で ${id} が見えません`);
    assert.equal(groupDefaultSong(index, [group]), id);
  }
});
