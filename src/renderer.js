import { LANES, LANE_COUNT, FALL_SEC, HIT_EFFECT_SEC, HIT_RING_START, HIT_RING_GROW, HIT_RING_LINE_MAX, DRUM_ZONES, DRUM_GLOW_ALPHA } from './constants.js';
import { computeLayout } from './layout.js';
import { drumLayout, drumZoneArc, activeGlows } from './drum.js';
import { windowBands, zoneOfNote } from './judge.js';
import { beatsInWindow } from './beats.js';
import { activeLabel } from './sections.js';

/** @typedef {import('./game.js').Game} Game */
/** @typedef {import('./beats.js').BeatGrid} BeatGrid */
/** @typedef {import('./sections.js').SectionLabel} SectionLabel */

const SOUND_COLOR = { high: '#ff9a3c', mid: '#6ee7a0', low: '#ff6f6f' };
// 判定の色。ノーツの音の色(高=オレンジ・中=緑・低=赤)と被らないようにする(被ると叩いた音の色と取り違える)
const RESULT_COLOR = { PERFECT: '#ffd24a', GOOD: '#4ac3ff', MISSED: '#9aa0aa' };

/** @param {string} hex #rrggbb @param {number} amount 0..1 白への混ぜ具合 */
function lighten(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (/** @type {number} */ c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
// ノーツが判定帯に入ったときの色(音の色相は保ったまま白に寄せる。GOOD < PERFECT)
const GOOD_ZONE_COLOR = { high: lighten(SOUND_COLOR.high, 0.4), mid: lighten(SOUND_COLOR.mid, 0.4), low: lighten(SOUND_COLOR.low, 0.4) };
const PERFECT_ZONE_COLOR = { high: lighten(SOUND_COLOR.high, 0.75), mid: lighten(SOUND_COLOR.mid, 0.75), low: lighten(SOUND_COLOR.low, 0.75) };
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
    this.drum = { cx: 0, cy: 0, outerR: 0, skinR: 0 };
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
    // 縁→皮の順に薄い白を重ねる(皮のほうがわずかに明るい)。ゾーンの境目は細い線
    g.fillStyle = 'rgba(255, 255, 255, 0.035)';
    g.beginPath();
    g.arc(d.cx, d.cy, d.outerR, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(d.cx, d.cy, d.skinR, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    g.lineWidth = 1;
    for (const r of [d.outerR, d.skinR, DRUM_ZONES.mid.rIn * d.skinR, DRUM_ZONES.high.rIn * d.skinR]) {
      g.beginPath();
      g.arc(d.cx, d.cy, r, 0, Math.PI * 2);
      g.stroke();
    }

    for (const glow of activeGlows(game.laneEffects, t)) {
      const a = drumZoneArc(d, glow.sound, glow.hand);
      g.globalAlpha = glow.fade * DRUM_GLOW_ALPHA;
      g.fillStyle = RESULT_COLOR[glow.result];
      g.beginPath();
      g.arc(a.cx, a.cy, a.rOut, a.a0, a.a1, false);
      g.arc(a.cx, a.cy, a.rIn, a.a1, a.a0, true);
      g.closePath();
      g.fill();
      g.globalAlpha = 1;
    }
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

    this.#drawDrum(game, t);

    // 判定窓の帯(GOOD は薄く、内側の PERFECT は濃く)。位置は拍線・ノーツと同じ yOf。
    // オフセット分だけ中心がずれる(判定が実際に通る範囲を正直に示すため)
    if (game.notes.length > 0) {
      const bands = windowBands(game.offsetSec);
      /** @param {[number, number]} range */
      const bandY = (range) => [this.yOf(t + range[1], t), this.yOf(t + range[0], t)];
      const [gTop, gBottom] = bandY(bands.good);
      const [pTop, pBottom] = bandY(bands.perfect);
      g.fillStyle = 'rgba(255, 255, 255, 0.06)';
      g.fillRect(x0, gTop, areaW, gBottom - gTop);
      g.fillStyle = 'rgba(255, 255, 255, 0.12)';
      g.fillRect(x0, pTop, areaW, pBottom - pTop);
    }

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
    const r = this.noteR;
    for (const n of game.notes) {
      const dt = n.time - t;
      if (dt > FALL_SEC + 0.1) break;
      if (dt < -0.4) continue;
      if (n.result && n.result !== 'MISSED') continue;
      const y = this.yOf(n.time, t);
      const cx = x0 + (n.lane + 0.5) * laneW;
      g.globalAlpha = n.result === 'MISSED' ? 0.3 : 1;
      // 未判定のノーツだけ、今叩いたらどの判定になるかで色を変える(GOOD帯: 明るく / PERFECT帯: さらに明るく+光る)
      const zone = n.result === null ? zoneOfNote(dt, game.offsetSec) : null;
      g.fillStyle = n.result === 'MISSED' ? '#777'
        : zone === 'PERFECT' ? PERFECT_ZONE_COLOR[n.sound]
        : zone === 'GOOD' ? GOOD_ZONE_COLOR[n.sound]
        : SOUND_COLOR[n.sound];
      if (zone === 'PERFECT') {
        g.shadowColor = SOUND_COLOR[n.sound];
        g.shadowBlur = 18;
      }
      g.beginPath();
      g.arc(cx, y, r, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
      if (zone === 'PERFECT') {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        g.stroke();
      }
      g.globalAlpha = 1;
    }

    // ヒットエフェクト: 叩いたレーンの判定ライン上にリングを広げて消す。MISSEDと空打ちは出さない
    for (let i = 0; i < LANE_COUNT; i++) {
      const fx = game.laneEffects[i];
      if (!fx) continue;
      const age = t - fx.at;
      if (age < 0 || age >= HIT_EFFECT_SEC) continue;
      const p = age / HIT_EFFECT_SEC;
      const cx = x0 + (i + 0.5) * laneW;
      g.globalAlpha = (1 - p) * 0.85;
      g.fillStyle = RESULT_COLOR[fx.result];
      g.beginPath();
      g.arc(cx, judgeY, r * (0.9 + 0.6 * p), 0, Math.PI * 2);
      g.globalAlpha = (1 - p) * 0.3;
      g.fill();
      g.globalAlpha = (1 - p) * 0.85;
      g.strokeStyle = RESULT_COLOR[fx.result];
      g.lineWidth = (HIT_RING_LINE_MAX - 1) * (1 - p) + 1;
      g.beginPath();
      g.arc(cx, judgeY, r * (HIT_RING_START + HIT_RING_GROW * p), 0, Math.PI * 2);
      g.stroke();
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
    // 判定ラインの下には ringMargin ぶんの余白(レーンの背景のまま)を空け、リングが切れないようにする
    g.fillRect(x0, labelTop, areaW, labelH);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < LANE_COUNT; i++) {
      const cx = x0 + (i + 0.5) * laneW;
      g.fillStyle = SOUND_COLOR[LANES[i].sound];
      g.font = `bold ${Math.min(laneW * 0.4, 26, labelH * 0.42)}px ${FONT}`;
      g.fillText(LANES[i].keyLabel, cx, labelTop + labelH * 0.38);
      g.fillStyle = '#8a91a1';
      g.font = `${Math.min(laneW * 0.26, 16, labelH * 0.27)}px ${FONT}`;
      g.fillText(`${LANES[i].hand === 'L' ? '左' : '右'}${LANES[i].soundLabel}`, cx, labelTop + labelH * 0.7);
    }

    // HUD
    g.textBaseline = 'alphabetic';
    g.textAlign = 'left';
    g.fillStyle = '#fff';
    g.font = `bold 22px ${FONT}`;
    // 全部自動演奏(お手本)中は採点しないので、スコア・コンボ・判定文字の代わりに表示だけ出す
    g.fillText(game.autoAll ? 'AUTO PLAY' : `SCORE ${game.score}`, x0 + 12, 32);

    g.textAlign = 'center';
    if (!game.autoAll && game.combo >= 2) {
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
    if (!game.autoAll && j && t - j.at < 0.5) {
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
