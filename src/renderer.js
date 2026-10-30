import { LANES, LANE_COUNT, FALL_SEC, HIT_EFFECT_SEC, DRUM_ZONES } from './constants.js';
import { computeLayout } from './layout.js';
import { drumLayout, activeGlows } from './drum.js';
import { THEME } from './theme.js';
import {
  drawBackground, drawLane, drawLaneLines, drawBands, drawBeatLine, drawNote,
  drawHitEffect, drawDrumBase, drawDrumGlow, drawJudgeLine,
} from './paint.js';
import { windowBands, zoneOfNote } from './judge.js';
import { beatsInWindow } from './beats.js';
import { activeLabel } from './sections.js';

/** @typedef {import('./game.js').Game} Game */
/** @typedef {import('./beats.js').BeatGrid} BeatGrid */
/** @typedef {import('./sections.js').SectionLabel} SectionLabel */

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
    this.noteR = 0;
    this.labelTop = 0;
    this.labelH = 0;
    this.drum = { cx: 0, cy: 0, r: 0 };
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
    const l = computeLayout(this.cssW, this.cssH);
    this.x0 = l.x0;
    this.laneW = l.laneW;
    this.judgeY = l.judgeY;
    this.labelTop = l.labelTop;
    this.labelH = l.labelH;
    this.noteR = l.noteR;
    this.drum = drumLayout(l.x0, l.areaW, l.judgeY);
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
   * レーンの背後に、ジャンベを上から見た絵を薄く描く。ノーツ・帯・拍線より先に描くので上に重なる。
   * 叩いた位置の光は game.laneEffects(ヒットエフェクトと同じ情報)から出すため、色・長さ・条件が揃う。
   * @param {Game} game
   * @param {number} t
   */
  #drawDrum(game, t) {
    const g = this.g;
    const d = this.drum;
    // 皮だけを塗る(縁は描かない)。外周とゾーンの境目は細い線
    drawDrumBase(g, d, [d.r, DRUM_ZONES.mid.rIn * d.r, DRUM_ZONES.high.rIn * d.r]);
    for (const glow of activeGlows(game.laneEffects, t)) drawDrumGlow(g, d, glow);
  }

  /**
   * @param {Game} game
   * @param {number} t 曲時間(秒)。ノーツ位置はオフセット抜きの素の時間で描く
   * @param {BeatGrid | null} grid 拍線の格子。null なら描かない
   * @param {SectionLabel[]} labels セクション名(開始画面の背景描画などでは空)
   */
  draw(game, t, grid, labels) {
    const g = this.g;
    const { x0, laneW, judgeY, cssW, cssH, labelTop, labelH } = this;
    const areaW = laneW * LANE_COUNT;

    drawBackground(g, cssW, cssH);

    // レーン(叩いた直後は音の色で光る)
    for (let i = 0; i < LANE_COUNT; i++) {
      drawLane(g, { index: i, x: x0 + i * laneW, w: laneW, h: cssH, sound: LANES[i].sound, ageSec: t - game.laneHitAt[i] });
    }
    // 区切り線と、左手/右手の境目の強調
    drawLaneLines(g, x0, laneW, LANE_COUNT, cssH);

    this.#drawDrum(game, t);

    // 判定窓の帯(GOOD は薄く、内側の PERFECT は濃く)。位置は拍線・ノーツと同じ yOf。
    // オフセット分だけ中心がずれる(判定が実際に通る範囲を正直に示すため)
    if (game.notes.length > 0) {
      const bands = windowBands(game.offsetSec);
      /** @param {[number, number]} range */
      const bandY = (range) => [this.yOf(t + range[1], t), this.yOf(t + range[0], t)];
      const [gTop, gBottom] = bandY(bands.good);
      const [pTop, pBottom] = bandY(bands.perfect);
      drawBands(g, { x: x0, w: areaW, goodTop: gTop, goodBottom: gBottom, perfectTop: pTop, perfectBottom: pBottom });
    }

    // 拍線(ノーツより下に描く。小節頭は濃く、他の拍は薄く)
    if (grid) {
      for (const b of beatsInWindow(grid, t - 0.4, t + FALL_SEC + 0.1)) {
        drawBeatLine(g, x0, areaW, Math.round(this.yOf(b.time, t)) + 0.5, b.accent);
      }
    }

    // ノーツ(時刻順なので、画面外の未来に来たらbreak)
    const r = this.noteR;
    for (const n of game.notes) {
      const dt = n.time - t;
      if (dt > FALL_SEC + 0.1) break;
      if (dt < -0.4) continue;
      if (n.result && n.result !== 'MISSED') continue;
      // 未判定のノーツだけ、今叩いたらどの判定になるかで色を変える(GOOD帯: 明るく / PERFECT帯: さらに明るく+光る)
      const zone = n.result === null ? zoneOfNote(dt, game.offsetSec) : null;
      drawNote(g, { cx: x0 + (n.lane + 0.5) * laneW, y: this.yOf(n.time, t), r, sound: n.sound, result: n.result, zone });
    }

    // ヒットエフェクト: 叩いたレーンの判定ライン上にリングを広げて消す。MISSEDと空打ちは出さない
    for (let i = 0; i < LANE_COUNT; i++) {
      const fx = game.laneEffects[i];
      if (!fx) continue;
      const age = t - fx.at;
      if (age < 0 || age >= HIT_EFFECT_SEC) continue;
      drawHitEffect(g, { cx: x0 + (i + 0.5) * laneW, y: judgeY, r, result: fx.result, progress: age / HIT_EFFECT_SEC });
    }

    // 判定ライン
    drawJudgeLine(g, x0, areaW, judgeY);

    // 下部ラベル(キー/音/手)
    g.fillStyle = THEME.keyStrip.background;
    // 判定ラインの下には ringMargin ぶんの余白(レーンの背景のまま)を空け、リングが切れないようにする
    g.fillRect(x0, labelTop, areaW, labelH);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = x0 + (i + 0.5) * laneW;
      g.fillStyle = THEME.sound[LANES[i].sound];
      g.font = `bold ${Math.min(laneW * 0.4, 26, labelH * 0.42)}px ${FONT}`;
      g.fillText(LANES[i].keyLabel, cx, labelTop + labelH * 0.38);
      g.fillStyle = THEME.keyStrip.text;
      g.font = `${Math.min(laneW * 0.26, 16, labelH * 0.27)}px ${FONT}`;
      g.fillText(`${LANES[i].hand === 'L' ? '左' : '右'}${LANES[i].soundLabel}`, cx, labelTop + labelH * 0.7);
    }

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = THEME.hud.text;
    g.font = `bold 22px ${FONT}`;
    // 全部自動演奏(お手本)中は採点しないので、スコア・コンボ・判定文字の代わりに表示だけ出す
    g.fillText(game.autoAll ? 'AUTO PLAY' : `SCORE ${game.score}`, x0 + 12, 32);

    g.textAlign = 'center';
    if (!game.autoAll && game.combo >= 2) {
      g.font = `bold 40px ${FONT}`;
      g.fillStyle = THEME.hud.text;
      g.fillText(String(game.combo), x0 + areaW / 2, judgeY * 0.38);
      g.font = `14px ${FONT}`;
      g.fillStyle = THEME.hud.muted;
      g.fillText('COMBO', x0 + areaW / 2, judgeY * 0.38 + 20);
    }

    // セクション名: 画面上部。ノーツに重なっても読めるよう縁取りする
    const label = activeLabel(labels, t);
    if (label) {
      g.globalAlpha = label.alpha;
      g.font = `bold 30px ${FONT}`;
      g.lineWidth = 5;
      g.strokeStyle = THEME.hud.sectionOutline;
      g.lineJoin = 'round';
      g.strokeText(label.name, x0 + areaW / 2, judgeY * 0.16);
      g.fillStyle = THEME.hud.sectionFill;
      g.fillText(label.name, x0 + areaW / 2, judgeY * 0.16);
      g.globalAlpha = 1;
    }

    const j = game.lastJudgement;
    if (!game.autoAll && j && t - j.at < 0.5) {
      g.globalAlpha = 1 - (t - j.at) / 0.5;
      g.fillStyle = THEME.judgement[j.result];
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
