import { LANES } from './constants.js';
import { AudioEngine } from './audio.js';
import { buildPlayNotes, withSpeed } from './chart.js';
import { gridOf, leadInSec } from './beats.js';
import { Metronome } from './metronome.js';
import { parseSpeedParam } from './settings.js';
import { Game } from './game.js';
import { accuracy, songRank } from './judge.js';
import { attachInput } from './input.js';
import { Renderer } from './renderer.js';
import { loadOffsetMs, saveOffsetMs, loadSettings, saveSettings } from './storage.js';
import { createUi } from './ui.js';
import { loadChart } from './chartLoader.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
/** 起動時に読み込みを開始。開始ボタンまでに終わっていれば待ち時間なし */
const params = new URLSearchParams(location.search);
const urlSpeed = parseSpeedParam(params.get('speed'));
const chartPromise = loadChart(params);
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
/** @type {Metronome | null} */
let metronome = null;
/** @type {import('./beats.js').BeatGrid | null} */
let beatGrid = null;

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
  onStart: () => void start(),
});
chartPromise.then((loaded) => ui.showSongInfo(loaded));

async function start() {
  if (state === 'playing') return;
  // unlock()はクリックハンドラ内で同期的に呼ぶ(autoplay制限)。awaitはその後。
  await audio.unlock();
  const loaded = await chartPromise;
  // 速さ倍率はBPMに掛ける。URL指定があれば設定より優先
  const chart = withSpeed(loaded.chart, urlSpeed ?? settings.speed);
  const grid = gridOf(chart);
  game = new Game(buildPlayNotes(chart, leadInSec(grid)));
  game.offsetSec = offsetMs / 1000;
  audio.setClickVolume(settings.beatVolume);
  startTime = audio.now;
  // 拍音・拍線はノーツと同じ格子・同じ曲時間から作る。オフセットは掛けない
  metronome = settings.beatOn ? new Metronome(audio, grid, startTime) : null;
  beatGrid = settings.beatLines ? grid : null;
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
  metronome?.tick();
  game.update(t);
  renderer.draw(game, t, beatGrid);
  if (game.isFinished(t)) {
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
renderer.draw(new Game([]), 0, null);
ui.showTitle();
