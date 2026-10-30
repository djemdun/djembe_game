import { LANES } from './constants.js';
import { AudioEngine } from './audio.js';
import { buildPlayNotes, withSpeed } from './chart.js';
import { gridOf, leadInSec, beatsInWindow } from './beats.js';
import { LookaheadScheduler } from './scheduler.js';
import { selectAutoNotes, autoNotesInWindow } from './autoplay.js';
import { sectionLabels } from './sections.js';
import { parseSpeedParam } from './settings.js';
import { Game } from './game.js';
import { accuracy, songRank } from './judge.js';
import { attachInput } from './input.js';
import { Renderer } from './renderer.js';
import { loadOffsetMs, saveOffsetMs, loadSettings, saveSettings } from './storage.js';
import { createUi } from './ui.js';
import { loadChart, loadSong } from './chartLoader.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
/** 起動時に読み込みを開始。開始ボタンまでに終わっていれば待ち時間なし */
const params = new URLSearchParams(location.search);
const urlSpeed = parseSpeedParam(params.get('speed'));
/** 選択中の曲。常に解決する(曲の切り替えが失敗しても前の曲に戻るので、開始ボタンは安全に await できる) @type {Promise<import('./chartLoader.js').LoadedChart>} */
let chartPromise = loadChart(params);
/** 曲の切り替えの通し番号。古い読み込みの結果で画面を上書きしないため */
let songSeq = 0;
const audio = new AudioEngine();
const renderer = new Renderer(canvas);

let offsetMs = loadOffsetMs();
let settings = loadSettings();
/** @type {'title' | 'playing' | 'result'} */
let state = 'title';
/** @type {Game | null} */
let game = null;
/** 曲時間0のAudioContext時間。songTime = audio.now - startTime */
let startTime = 0;
/** 先読みスケジューラ(拍音・自動音)。毎フレーム tick する @type {LookaheadScheduler<any>[]} */
let schedulers = [];
/** @type {import('./beats.js').BeatGrid | null} */
let beatGrid = null;
/** @type {import('./sections.js').SectionLabel[]} */
let labels = [];

const ui = createUi({
  initialOffsetMs: offsetMs,
  onOffsetChange: (ms) => {
    offsetMs = ms;
    saveOffsetMs(ms);
  },
  settings,
  urlSpeed,
  onSettingsChange: (s) => {
    settings = s;
    saveSettings(s);
  },
  onStart: (auto) => void start(auto),
  onSongChange: (id) => void changeSong(id),
});
chartPromise.then((loaded) => {
  const initial = /** @type {import('./chartLoader.js').InitialChart} */ (loaded);
  ui.setSongs(initial.songs, initial.id);
  ui.showSongInfo({ ...initial, bpm: initial.chart.bpm });
});

/**
 * TOP画面で曲が選ばれたとき。読めなければ前の曲に戻し、理由を警告欄に出す。
 * @param {string} id
 */
async function changeSong(id) {
  const seq = ++songSeq;
  const prev = chartPromise;
  /** @type {unknown} */
  let failure = null;
  const next = loadSong(id).catch((e) => {
    failure = e;
    return prev;
  });
  chartPromise = next;
  const loaded = await next;
  if (seq !== songSeq) return; // さらに別の曲が選ばれた。こちらの結果は捨てる
  const warnings = [...loaded.warnings];
  if (failure !== null) {
    ui.setSelectedSong(loaded.id);
    warnings.push({ line: 0, message: `曲"${id}"を読めません(${failure instanceof Error ? failure.message : String(failure)})。"${loaded.id}"のままです` });
  }
  ui.showSongInfo({ ...loaded, warnings, bpm: loaded.chart.bpm });
}

/** @param {boolean} autoAll 自動演奏(お手本)モードで開始するか。押したボタンで決まり、状態は持たない */
async function start(autoAll) {
  if (state === 'playing') return;
  // unlock()はクリックハンドラ内で同期的に呼ぶ(autoplay制限)。awaitはその後。
  await audio.unlock();
  const loaded = await chartPromise;
  // 速さ倍率はBPMに掛ける。URL指定があれば設定より優先
  const chart = withSpeed(loaded.chart, urlSpeed ?? settings.speed);
  const grid = gridOf(chart);
  game = new Game(buildPlayNotes(chart, leadInSec(grid)), { autoAll });
  game.offsetSec = autoAll ? 0 : offsetMs / 1000; // 自動演奏は譜面の時刻ちょうど
  audio.setClickVolume(settings.beatVolume);
  startTime = audio.now;
  // 拍音・自動音・拍線は、ノーツと同じ格子・同じ曲時間から作る。判定オフセットは掛けない
  schedulers = [];
  if (settings.beatOn) {
    schedulers.push(
      new LookaheadScheduler(audio, startTime, (a, b) => beatsInWindow(grid, a, b), (e, when) => audio.playClick(e.accent, when)),
    );
  }
  const autoNotes = selectAutoNotes(game.notes, autoAll);
  if (autoNotes.length > 0) {
    // 自動音: 判定の結果(MISSED等)を待たず、ノーツの時刻ちょうどに予約して鳴らす
    schedulers.push(
      new LookaheadScheduler(audio, startTime, (a, b) => autoNotesInWindow(autoNotes, a, b), (n, when) => audio.play(n.sound, when)),
    );
  }
  beatGrid = settings.beatLines ? grid : null;
  labels = sectionLabels(chart, leadInSec(grid));
  state = 'playing';
  ui.hide();
  requestAnimationFrame(frame);
}

/** @param {number} eventTimeStamp */
function songTimeOfEvent(eventTimeStamp) {
  // 入力イベントの発生時刻と、ハンドラが走った時刻のずれ(メインスレッドの詰まり等)を引いて、
  // 「実際に叩かれた瞬間」のAudioContext時間に直す。異常値は無視して現在時刻を使う。
  const lagSec = (performance.now() - eventTimeStamp) / 1000;
  const safeLag = lagSec >= 0 && lagSec < 0.1 ? lagSec : 0;
  return audio.now - safeLag - startTime;
}

attachInput({
  target: canvas,
  laneAt: (x) => renderer.laneAt(x),
  onHit: (lane, ts) => {
    if (state !== 'playing' || !game) return;
    game.hit(lane, songTimeOfEvent(ts));
    // 判定の成否に関わらず、叩いたレーンの音は鳴らす(空打ちも楽器として鳴る)
    audio.play(LANES[lane].sound);
  },
});

function frame() {
  if (state !== 'playing' || !game) return;
  // 描画もAudioContext時間基準。rAFの呼び出し間隔(≒16.7ms)には依存しない
  const t = audio.now - startTime;
  for (const s of schedulers) s.tick();
  game.update(t);
  renderer.draw(game, t, beatGrid, labels);
  if (game.isFinished(t)) {
    if (game.autoAll) {
      // お手本は採点しないのでリザルトを出さず、開始画面へ戻る
      state = 'title';
      ui.showTitle();
      return;
    }
    state = 'result';
    ui.showResult({
      rank: songRank(game.counts),
      accuracy: accuracy(game.counts),
      counts: game.counts,
      score: game.score,
      maxCombo: game.maxCombo,
    });
    return;
  }
  requestAnimationFrame(frame);
}

// タイトル背景として空の盤面を描いておく
renderer.draw(new Game([]), 0, null, []);
ui.showTitle();
