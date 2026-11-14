import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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

const ids = (/** @type {{ id: string }[]} */ songs) => songs.map((s) => s.id);

test('loadChart: group=adminmami は default の曲を読み、全曲を選べる', async () => {
  const r = await loadChart(params('group=adminmami'));
  assert.equal(r.id, INDEX.default);
  assert.deepEqual(ids(r.songs), ids(INDEX.songs));
  assert.ok(r.chart.notes.length > 0);
});

test('loadChart: group 未指定は default の1曲だけ(選択不可)。?chart= で別の曲を指定しても default', async () => {
  for (const q of ['', `chart=${SONGS.find((x) => x.id !== INDEX.default)?.id}`]) {
    const r = await loadChart(params(q));
    assert.equal(r.id, INDEX.default, q);
    assert.deepEqual(ids(r.songs), [INDEX.default], q);
  }
});

/** @type {{ id: string, groups?: string[] }[]} */
const SONGS = INDEX.songs;
const groupNames = [...new Set(SONGS.flatMap((s) => s.groups ?? []))];
/** index.json の記述どおり、default + 指定グループのどれかに属する曲(一覧の順) */
const visibleFor = (/** @type {string[]} */ gs) =>
  SONGS.filter((s) => s.id === INDEX.default || (s.groups ?? []).some((g) => gs.includes(g))).map((s) => s.id);

test('loadChart: group=<名前> は default + そのグループの曲。複数指定(カンマ・繰り返し)は和集合', async () => {
  for (const g of groupNames) assert.deepEqual(ids((await loadChart(params(`group=${g}`))).songs), visibleFor([g]), g);
  assert.deepEqual(ids((await loadChart(params(`group=${groupNames.join(',')}`))).songs), visibleFor(groupNames));
  assert.deepEqual(
    ids((await loadChart(params(groupNames.map((g) => `group=${g}`).join('&')))).songs),
    visibleFor(groupNames),
  );
});

test('loadChart: ?chart= は見える曲の中でだけ有効(見えない曲は警告して default)', async () => {
  const g = groupNames[0];
  const inside = SONGS.find((s) => s.groups?.includes(g) && existsSync(new URL(`../songs/${s.id}.txt`, import.meta.url)))?.id ?? INDEX.default;
  const outside = SONGS.find((s) => s.id !== INDEX.default && !s.groups?.includes(g))?.id;
  assert.equal((await loadChart(params(`group=${g}&chart=${inside}`))).id, inside);
  if (outside) {
    const ng = await loadChart(params(`group=${g}&chart=${outside}`));
    assert.equal(ng.id, INDEX.default);
    assert.match(ng.warnings[0].message, new RegExp(`${outside}.*一覧にありません`));
  }
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
  const r = await loadChart(params('group=adminmami'));
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

test('loadChart: ?chart= に Object.prototype の名前(constructor / __proto__ など)を指定しても壊れない(内蔵譜面として扱わず、一覧にない曲として default に戻る)', async () => {
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const r = await loadChart(params(`chart=${name}`));
    assert.equal(r.id, INDEX.default, name);
    assert.ok(Array.isArray(r.chart.notes) && r.chart.notes.length > 0, `${name}: 譜面が読める`);
    assert.equal(typeof r.chart.bpm, 'number', name);
    assert.match(r.warnings[0].message, new RegExp(`${name}.*一覧にありません`), name);
  }
});

test('loadChart: 内蔵譜面の名前(easy / demo)は従来どおり使える', async () => {
  for (const name of ['easy', 'demo']) {
    const r = await loadChart(params(`chart=${name}`));
    assert.equal(r.id, name);
    assert.deepEqual(r.warnings, []);
    assert.ok(r.chart.notes.length > 0);
  }
});
