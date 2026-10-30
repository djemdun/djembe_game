import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadChart, loadSong } from '../src/chartLoader.js';

// fetch を差し替え、実際の songs/ のファイルを返す(失敗させたい URL は missing に入れる)
const realFetch = globalThis.fetch;
/** @type {Set<string>} */
let missing;
beforeEach(() => {
  missing = new Set();
  globalThis.fetch = /** @type {any} */ (async (/** @type {string} */ url) => {
    if (missing.has(url)) return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    const body = readFileSync(new URL(`../${url}`, import.meta.url), 'utf8');
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  });
});
afterEach(() => { globalThis.fetch = realFetch; });

const params = (/** @type {string} */ q) => new URLSearchParams(q);
const INDEX = JSON.parse(readFileSync(new URL('../songs/index.json', import.meta.url), 'utf8'));

test('loadChart: 指定なしは default の曲を読み、一覧(songs/index.json の songs)と選択中の id を返す', async () => {
  const r = await loadChart(params(''));
  assert.equal(r.id, INDEX.default);
  assert.deepEqual(r.songs.map((s) => s.id), INDEX.songs.map((/** @type {{ id: string }} */ s) => s.id));
  assert.ok(r.chart.notes.length > 0);
});

test('loadChart: ?chart=<id> はその曲を選択済みにして返す(一覧は全曲)', async () => {
  const other = INDEX.songs.find((/** @type {{ id: string }} */ s) => s.id !== INDEX.default).id;
  const r = await loadChart(params(`chart=${other}`));
  assert.equal(r.id, other);
  assert.equal(r.songs.length, INDEX.songs.length);
});

test('loadChart: 内蔵譜面(?chart=easy)は一覧なし(選択欄を出さない)', async () => {
  const r = await loadChart(params('chart=easy'));
  assert.equal(r.id, 'easy');
  assert.deepEqual(r.songs, []);
});

test('loadChart: 一覧が読めなければ demo で一覧なし、理由を警告に入れる', async () => {
  missing.add('songs/index.json');
  const r = await loadChart(params(''));
  assert.equal(r.id, 'demo');
  assert.deepEqual(r.songs, []);
  assert.match(r.warnings[0].message, /曲一覧/);
});

test('loadChart: 既定の曲だけ読めないとき demo に戻るが、一覧は残る(別の曲を選べる)', async () => {
  missing.add(`songs/${INDEX.default}.txt`);
  const r = await loadChart(params(''));
  assert.equal(r.id, 'demo');
  assert.equal(r.songs.length, INDEX.songs.length);
});

test('loadSong: 選んだ曲を読み、id と曲名を返す。読めなければ例外(切り替え側が前の曲に戻す)', async () => {
  const s = INDEX.songs[0];
  const r = await loadSong(s.id);
  assert.equal(r.id, s.id);
  assert.ok(r.title.length > 0);
  assert.ok(r.chart.notes.length > 0);
  missing.add(`songs/${s.id}.txt`);
  await assert.rejects(() => loadSong(s.id), /404/);
});
