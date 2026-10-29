import { LANES, LANE_COUNT, FALL_SEC } from './constants.js';
import { beatsInWindow } from './beats.js';
import { activeLabel } from './sections.js';

/** @typedef {import('./game.js').Game} Game */
/** @typedef {import('./beats.js').BeatGrid} BeatGrid */
/** @typedef {import('./sections.js').SectionLabel} SectionLabel */

const MAX_LANES_WIDTH = 720;
const JUDGE_Y_RATIO = 0.8;
const SOUND_COLOR = { high: '#ffd24a', mid: '#4ac3ff', low: '#ff6f6f' };
const RESULT_COLOR = { PERFECT: '#ffd24a', GOOD: '#4ac3ff', MISSED: '#9aa0aa' };
const FONT = '"Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

export class Renderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    const g = canvas.getContext('2d');
    if (!g) throw new Error('2d context unavailable');
    this.g = g;
    this.cssW = 0;
    this.cssH = 0;
    this.x0 = 0;
    this.laneW = 0;
    this.judgeY = 0;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  resize() {
    // devicePixelRatioに合わせて内部解像度を上げないと高DPI(スマホ)でぼやける
    const dpr = window.devicePixelRatio || 1;
    this.cssW = this.canvas.clientWidth;
    this.cssH = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.cssW * dpr);
    this.canvas.height = Math.round(this.cssH * dpr);
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const areaW = Math.min(this.cssW, MAX_LANES_WIDTH);
    this.x0 = (this.cssW - areaW) / 2;
    this.laneW = areaW / LANE_COUNT;
    this.judgeY = this.cssH * JUDGE_Y_RATIO;
  }

  /**
   * 画面座標→レーン。入力側が描画レイアウトを知らなくて済むようここに置く。
   * @param {number} clientX
   */
  laneAt(clientX) {
    const x = clientX - this.canvas.getBoundingClientRect().left - this.x0;
    if (x < 0 || x >= this.laneW * LANE_COUNT) return -1;
    return Math.floor(x / this.laneW);
  }

  /**
   * 時刻→y座標。ノーツと拍線で同じ式を使い、両者がずれないようにする。
   * @param {number} time 対象の曲時間(秒)
   * @param {number} t 現在の曲時間(秒)
   */
  yOf(time, t) {
    return this.judgeY - ((time - t) / FALL_SEC) * this.judgeY;
  }

  /**
   * @param {Game} game
   * @param {number} t 曲時間(秒)。ノーツ位置はオフセット抜きの素の時間で描く
   * @param {BeatGrid | null} grid 拍線の格子。null なら描かない
   * @param {SectionLabel[]} labels セクション名(開始画面の背景描画などでは空)
   */
  draw(game, t, grid, labels) {
    const g = this.g;
    const { x0, laneW, judgeY, cssW, cssH } = this;
    const areaW = laneW * LANE_COUNT;

    g.fillStyle = '#12141a';
    g.fillRect(0, 0, cssW, cssH);

    // レーン
    for (let i = 0; i < LANE_COUNT; i++) {
      const x = x0 + i * laneW;
      g.fillStyle = i % 2 ? '#181b23' : '#1c2029';
      g.fillRect(x, 0, laneW, cssH);
      const age = t - game.laneHitAt[i];
      if (age >= 0 && age < 0.18) {
        g.globalAlpha = (1 - age / 0.18) * 0.35;
        g.fillStyle = SOUND_COLOR[LANES[i].sound];
        g.fillRect(x, 0, laneW, cssH);
        g.globalAlpha = 1;
      }
    }
    g.strokeStyle = '#2c313d';
    g.lineWidth = 1;
    for (let i = 0; i <= LANE_COUNT; i++) {
      const x = Math.round(x0 + i * laneW) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, cssH);
      g.stroke();
    }
    // 左手/右手の境目を強調
    g.strokeStyle = '#4a5163';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0 + areaW / 2, 0);
    g.lineTo(x0 + areaW / 2, cssH);
    g.stroke();

    // 拍線(ノーツより下に描く。小節頭は濃く、他の拍は薄く)
    if (grid) {
      for (const b of beatsInWindow(grid, t - 0.4, t + FALL_SEC + 0.1)) {
        const y = Math.round(this.yOf(b.time, t)) + 0.5;
        g.strokeStyle = b.accent ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)';
        g.lineWidth = b.accent ? 2 : 1;
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x0 + areaW, y);
        g.stroke();
      }
    }

    // ノーツ(時刻順なので、画面外の未来に来たらbreak)
    const r = Math.min(laneW * 0.36, 28);
    for (const n of game.notes) {
      const dt = n.time - t;
      if (dt > FALL_SEC + 0.1) break;
      if (dt < -0.4) continue;
      if (n.result && n.result !== 'MISSED') continue;
      const y = this.yOf(n.time, t);
      const cx = x0 + (n.lane + 0.5) * laneW;
      g.globalAlpha = n.result === 'MISSED' ? 0.3 : 1;
      g.fillStyle = n.result === 'MISSED' ? '#777' : SOUND_COLOR[n.sound];
      g.beginPath();
      g.arc(cx, y, r, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }

    // 判定ライン
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x0, judgeY);
    g.lineTo(x0 + areaW, judgeY);
    g.stroke();

    // 下部ラベル(キー/音/手)
    g.fillStyle = '#0d0f14';
    g.fillRect(x0, judgeY + 2, areaW, cssH - judgeY);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const labelH = cssH - judgeY;
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = x0 + (i + 0.5) * laneW;
      g.fillStyle = SOUND_COLOR[LANES[i].sound];
      g.font = `bold ${Math.min(laneW * 0.4, 26)}px ${FONT}`;
      g.fillText(LANES[i].keyLabel, cx, judgeY + labelH * 0.38);
      g.fillStyle = '#8a91a1';
      g.font = `${Math.min(laneW * 0.26, 16)}px ${FONT}`;
      g.fillText(`${LANES[i].hand === 'L' ? '左' : '右'}${LANES[i].soundLabel}`, cx, judgeY + labelH * 0.7);
    }

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.font = `bold 22px ${FONT}`;
    g.fillText(`SCORE ${game.score}`, x0 + 12, 32);

    g.textAlign = 'center';
    if (game.combo >= 2) {
      g.font = `bold 40px ${FONT}`;
      g.fillStyle = '#fff';
      g.fillText(String(game.combo), x0 + areaW / 2, judgeY * 0.38);
      g.font = `14px ${FONT}`;
      g.fillStyle = '#8a91a1';
      g.fillText('COMBO', x0 + areaW / 2, judgeY * 0.38 + 20);
    }

    // セクション名: 画面上部。ノーツに重なっても読めるよう縁取りする
    const label = activeLabel(labels, t);
    if (label) {
      g.globalAlpha = label.alpha;
      g.font = `bold 30px ${FONT}`;
      g.lineWidth = 5;
      g.strokeStyle = '#12141a';
      g.lineJoin = 'round';
      g.strokeText(label.name, x0 + areaW / 2, judgeY * 0.16);
      g.fillStyle = '#ffffff';
      g.fillText(label.name, x0 + areaW / 2, judgeY * 0.16);
      g.globalAlpha = 1;
    }

    const j = game.lastJudgement;
    if (j && t - j.at < 0.5) {
      g.globalAlpha = 1 - (t - j.at) / 0.5;
      g.fillStyle = RESULT_COLOR[j.result];
      g.font = `bold 30px ${FONT}`;
      g.fillText(j.result, x0 + areaW / 2, judgeY * 0.6);
      if (j.deltaSec !== null) {
        // 早い(-)/遅い(+)をms表示。オフセット調整の目安になる
        const ms = Math.round(j.deltaSec * 1000);
        g.font = `14px ${FONT}`;
        g.fillText(`${ms > 0 ? '+' : ''}${ms}ms`, x0 + areaW / 2, judgeY * 0.6 + 22);
      }
      g.globalAlpha = 1;
    }
  }
}
