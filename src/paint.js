// canvas の描画部品。色は theme.js だけを読む(座標は呼び出し側が決める)。
// renderer.js(ゲーム画面)と dev/color-tuner.html(色の調整ページ)が同じ関数を使うので、
// 調整ページで見えるものがそのまま本番の見た目になる。DOM には触れず、渡された 2D コンテキストにだけ描く。

import { HIT_RING_START, HIT_RING_GROW, HIT_RING_LINE_MAX } from './constants.js';
import { drumZoneArc } from './drum.js';
import { THEME } from './theme.js';

/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').NoteResult} NoteResult */

/** PERFECT帯のノーツの発光のぼかし(px)と縁取りの太さ。色ではないので theme には置かない */
const PERFECT_GLOW_BLUR = 18;
const PERFECT_OUTLINE_WIDTH = 3;
/** 叩いたレーンが光る長さ(秒) */
const LANE_FLASH_SEC = 0.18;

/** @type {Map<string, string>} */
const lightenCache = new Map();

/**
 * 色を白へ寄せる。音の色相は保ったまま明るくするのに使う。
 * @param {string} hex #rrggbb
 * @param {number} amount 0..1 白への混ぜ具合
 */
export function lighten(hex, amount) {
  const key = `${hex}|${amount}`;
  let v = lightenCache.get(key);
  if (v === undefined) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (/** @type {number} */ c) => Math.round(c + (255 - c) * amount);
    v = `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
    lightenCache.set(key, v);
  }
  return v;
}

/**
 * ノーツの塗り色。
 * @param {Sound} sound
 * @param {NoteResult | null} result 判定済みなら MISSED だけが描かれる
 * @param {'PERFECT' | 'GOOD' | null} zone 未判定ノーツが今いる帯(今叩いたらその判定になる)
 */
export function noteColor(sound, result, zone) {
  if (result === 'MISSED') return THEME.note.missed;
  if (zone === 'PERFECT') return lighten(THEME.sound[sound], THEME.note.perfectMix);
  if (zone === 'GOOD') return lighten(THEME.sound[sound], THEME.note.goodMix);
  return THEME.sound[sound];
}

/** @param {CanvasRenderingContext2D} g @param {number} w @param {number} h */
export function drawBackground(g, w, h) {
  g.fillStyle = THEME.background;
  g.fillRect(0, 0, w, h);
}

/**
 * レーン1本の背景。叩いた直後は音の色で光る。
 * @param {CanvasRenderingContext2D} g
 * @param {{ index: number, x: number, w: number, h: number, sound: Sound, ageSec: number }} p
 *   ageSec: このレーンを最後に叩いてからの秒数(叩いていなければ負や巨大な値でよい)
 */
export function drawLane(g, { index, x, w, h, sound, ageSec }) {
  g.fillStyle = index % 2 ? THEME.lane.odd : THEME.lane.even;
  g.fillRect(x, 0, w, h);
  if (ageSec >= 0 && ageSec < LANE_FLASH_SEC) {
    g.globalAlpha = (1 - ageSec / LANE_FLASH_SEC) * THEME.lane.flashAlpha;
    g.fillStyle = THEME.sound[sound];
    g.fillRect(x, 0, w, h);
    g.globalAlpha = 1;
  }
}

/**
 * レーンの区切り線と、左手/右手の境目。
 * @param {CanvasRenderingContext2D} g
 * @param {number} x0 レーン領域の左端
 * @param {number} laneW
 * @param {number} laneCount
 * @param {number} h canvas の高さ
 */
export function drawLaneLines(g, x0, laneW, laneCount, h) {
  g.strokeStyle = THEME.lane.line;
  g.lineWidth = 1;
  for (let i = 0; i <= laneCount; i++) {
    const x = Math.round(x0 + i * laneW) + 0.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, h);
    g.stroke();
  }
  g.strokeStyle = THEME.lane.handDivider;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0 + (laneW * laneCount) / 2, 0);
  g.lineTo(x0 + (laneW * laneCount) / 2, h);
  g.stroke();
}

/**
 * 判定窓の帯。GOOD は広く薄く、PERFECT は内側で濃く(GOOD の上に重なる)。
 * @param {CanvasRenderingContext2D} g
 * @param {{ x: number, w: number, goodTop: number, goodBottom: number, perfectTop: number, perfectBottom: number }} p
 */
export function drawBands(g, { x, w, goodTop, goodBottom, perfectTop, perfectBottom }) {
  g.fillStyle = THEME.band.good;
  g.fillRect(x, goodTop, w, goodBottom - goodTop);
  g.fillStyle = THEME.band.perfect;
  g.fillRect(x, perfectTop, w, perfectBottom - perfectTop);
}

/**
 * 拍線1本。
 * @param {CanvasRenderingContext2D} g
 * @param {number} x 左端
 * @param {number} w 幅
 * @param {number} y
 * @param {boolean} accent 小節頭
 */
export function drawBeatLine(g, x, w, y, accent) {
  g.strokeStyle = accent ? THEME.beatLine.bar : THEME.beatLine.beat;
  g.lineWidth = accent ? 2 : 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.stroke();
}

/**
 * ノーツ1つ。未判定ノーツは zone(今いる帯)で色が変わり、PERFECT帯では発光と縁取りが付く。
 * @param {CanvasRenderingContext2D} g
 * @param {{ cx: number, y: number, r: number, sound: Sound, result: NoteResult | null, zone: 'PERFECT' | 'GOOD' | null }} p
 */
export function drawNote(g, { cx, y, r, sound, result, zone }) {
  g.globalAlpha = result === 'MISSED' ? THEME.note.missedAlpha : 1;
  g.fillStyle = noteColor(sound, result, zone);
  if (zone === 'PERFECT') {
    g.shadowColor = THEME.sound[sound];
    g.shadowBlur = PERFECT_GLOW_BLUR;
  }
  g.beginPath();
  g.arc(cx, y, r, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  if (zone === 'PERFECT') {
    g.strokeStyle = THEME.note.perfectOutline;
    g.lineWidth = PERFECT_OUTLINE_WIDTH;
    g.stroke();
  }
  g.globalAlpha = 1;
}

/**
 * ヒットエフェクト: 判定ライン上でリングが広がって消える。色は判定の色。
 * @param {CanvasRenderingContext2D} g
 * @param {{ cx: number, y: number, r: number, result: 'PERFECT' | 'GOOD', progress: number }} p
 *   progress: 0(叩いた瞬間)→ 1(消える)
 */
export function drawHitEffect(g, { cx, y, r, result, progress: p }) {
  g.globalAlpha = (1 - p) * THEME.hitEffect.ringAlpha;
  g.fillStyle = THEME.judgement[result];
  g.beginPath();
  g.arc(cx, y, r * (0.9 + 0.6 * p), 0, Math.PI * 2);
  g.globalAlpha = (1 - p) * THEME.hitEffect.fillAlpha;
  g.fill();
  g.globalAlpha = (1 - p) * THEME.hitEffect.ringAlpha;
  g.strokeStyle = THEME.judgement[result];
  g.lineWidth = (HIT_RING_LINE_MAX - 1) * (1 - p) + 1;
  g.beginPath();
  g.arc(cx, y, r * (HIT_RING_START + HIT_RING_GROW * p), 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
}

/**
 * 背景の太鼓(皮と、ゾーンの境目の線)。
 * @param {CanvasRenderingContext2D} g
 * @param {{ cx: number, cy: number, r: number }} d drumLayout の結果
 * @param {number[]} zoneRadii 境目の線を引く半径(外周を含む)
 */
export function drawDrumBase(g, d, zoneRadii) {
  g.fillStyle = THEME.drum.skin;
  g.beginPath();
  g.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = THEME.drum.line;
  g.lineWidth = 1;
  for (const r of zoneRadii) {
    g.beginPath();
    g.arc(d.cx, d.cy, r, 0, Math.PI * 2);
    g.stroke();
  }
}

/**
 * 太鼓の叩いた位置の光。色は判定の色(ヒットエフェクトと同じ)。
 * @param {CanvasRenderingContext2D} g
 * @param {{ cx: number, cy: number, r: number }} d
 * @param {{ sound: Sound, hand: import('./types.js').Hand, result: 'PERFECT' | 'GOOD', fade: number }} glow
 *   fade: 1(叩いた瞬間)→ 0(消える)
 */
export function drawDrumGlow(g, d, glow) {
  const a = drumZoneArc(d, glow.sound, glow.hand);
  g.globalAlpha = glow.fade * THEME.drum.glowAlpha;
  g.fillStyle = THEME.judgement[glow.result];
  g.beginPath();
  g.arc(a.cx, a.cy, a.rOut, a.a0, a.a1, false);
  g.arc(a.cx, a.cy, a.rIn, a.a1, a.a0, true);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
}

/**
 * 判定ライン。
 * @param {CanvasRenderingContext2D} g
 * @param {number} x 左端
 * @param {number} w 幅
 * @param {number} y
 */
export function drawJudgeLine(g, x, w, y) {
  g.strokeStyle = THEME.judgeLine;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.stroke();
}
