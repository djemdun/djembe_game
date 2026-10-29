// 文字譜 → 内部形式。DOM / Web Audio に依存しない純粋関数だけを置く。

/** @typedef {import('./types.js').Chart} Chart */
/** @typedef {import('./types.js').ChartNote} ChartNote */
/** @typedef {import('./types.js').Hand} Hand */
/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {{ line: number, message: string }} NotationWarning */

/**
 * @typedef {object} ParsedNotation
 * @property {string} title
 * @property {number} bpm
 * @property {number} beatsPerBar
 * @property {number} totalBeats
 * @property {Chart} chart
 * @property {NotationWarning[]} warnings
 */

export const REST_CHAR = 'ッ';
/** @type {Readonly<Record<string, { sound: Sound, flam: boolean }>>} */
export const NOTE_CHARS = Object.freeze({
  'ド': { sound: 'low', flam: false },
  'ト': { sound: 'mid', flam: false },
  'タ': { sound: 'high', flam: false },
  'ロ': { sound: 'mid', flam: true },
  'ラ': { sound: 'high', flam: true },
});

const DEFAULT_BEATS_PER_BAR = 4;
/** 1文字 = 8分音符 = 0.5拍 */
const BEATS_PER_CHAR = 0.5;
/** 1行 = 2小節 */
const BARS_PER_LINE = 2;

const PART_HEADER = /^\[(.+?)\]\s*(?:[xX×]\s*(\d+))?\s*$/;
const HEADER_LINE = /^(タイトル|BPM|拍子)\s*[:：]\s*(.*)$/i;

/**
 * 手の割り当て。pos はパート内の1始まりの文字位置(休符も数える)。
 * 奇数 = 右、偶数 = 左。フラムは前打音がその手、本音(= internal の hand)は反対の手。
 *   奇数: 前打音 右 → 本音 左 / 偶数: 前打音 左 → 本音 右
 * 手の例外指定を足すときは、この関数の呼び出し側(buildPartNotes)で
 * 「指定があればそれを優先」するだけでよい。
 * @param {number} pos
 * @param {boolean} flam
 * @returns {Hand}
 */
export function assignHand(pos, flam) {
  const stepHand = pos % 2 === 1 ? 'R' : 'L';
  if (!flam) return stepHand;
  return stepHand === 'R' ? 'L' : 'R';
}

/**
 * 1行あたりの期待文字数(拍子4なら16)
 * @param {number} beatsPerBar
 */
export function charsPerLine(beatsPerBar) {
  return (beatsPerBar / BEATS_PER_CHAR) * BARS_PER_LINE;
}

/**
 * @param {string} text 文字譜全体
 * @returns {ParsedNotation}
 * @throws {Error} BPM不正、パート外の譜面など、続行できない構造エラー
 */
export function parseNotation(text) {
  /** @type {NotationWarning[]} */
  const warnings = [];
  /** @type {{ title?: string, bpm?: number, beatsPerBar?: number }} */
  const header = {};
  /** @type {{ name: string, repeat: number, chars: { ch: string, line: number }[], line: number }[]} */
  const parts = [];
  let current = null;

  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    const partMatch = PART_HEADER.exec(line);
    if (partMatch) {
      let repeat = partMatch[2] ? Number(partMatch[2]) : 1;
      if (repeat < 1) {
        warnings.push({ line: lineNo, message: `繰り返し回数が0です。1回として扱います: ${line}` });
        repeat = 1;
      }
      current = { name: partMatch[1], repeat, chars: [], line: lineNo };
      parts.push(current);
      return;
    }

    if (!current) {
      const h = HEADER_LINE.exec(line);
      if (!h) throw new Error(`行${lineNo}: パート([名前])より前に譜面または不明な行があります: ${line}`);
      const value = h[2].trim();
      if (h[1] === 'タイトル') header.title = value;
      else if (h[1].toUpperCase() === 'BPM') header.bpm = Number(value);
      else {
        const n = parseInt(value, 10); // "4" も "4/4" も先頭の数を拍数とみなす
        if (Number.isFinite(n) && n > 0) header.beatsPerBar = n;
        else warnings.push({ line: lineNo, message: `拍子を読めません(${value})。${DEFAULT_BEATS_PER_BAR}として扱います` });
      }
      return;
    }

    const chars = [...line.replace(/[\s　]/g, '')];
    const expected = charsPerLine(header.beatsPerBar ?? DEFAULT_BEATS_PER_BAR);
    if (chars.length !== expected) {
      warnings.push({ line: lineNo, message: `1行は${expected}文字のはずですが${chars.length}文字です: ${line}` });
    }
    for (const ch of chars) current.chars.push({ ch, line: lineNo });
  });

  if (header.bpm === undefined || !Number.isFinite(header.bpm) || header.bpm <= 0) {
    throw new Error('BPMが未指定、または不正です(例: BPM: 130)');
  }
  const beatsPerBar = header.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;

  /** @type {ChartNote[]} */
  const notes = [];
  let cursorBeat = 0;
  for (const part of parts) {
    if (part.chars.length === 0) {
      warnings.push({ line: part.line, message: `パート[${part.name}]に譜面がありません` });
    }
    const partNotes = buildPartNotes(part.chars, warnings);
    const partBeats = part.chars.length * BEATS_PER_CHAR;
    for (let r = 0; r < part.repeat; r++) {
      for (const n of partNotes) notes.push({ ...n, beat: cursorBeat + n.beat });
      cursorBeat += partBeats;
    }
  }

  return {
    title: header.title ?? '',
    bpm: header.bpm,
    beatsPerBar,
    totalBeats: cursorBeat,
    chart: { bpm: header.bpm, notes },
    warnings,
  };
}

/**
 * 1パート分(繰り返し前)をパート先頭基準のbeatで内部形式にする。
 * 食い(前の小節にはみ出す音)も特別扱いせず、書かれた位置の奇偶で手が決まる。
 * @param {{ ch: string, line: number }[]} chars
 * @param {NotationWarning[]} warnings
 * @returns {ChartNote[]}
 */
function buildPartNotes(chars, warnings) {
  /** @type {ChartNote[]} */
  const out = [];
  chars.forEach(({ ch, line }, i) => {
    if (ch === REST_CHAR) return;
    const def = NOTE_CHARS[ch];
    if (!def) {
      warnings.push({ line, message: `未対応の文字「${ch}」を休符として扱います` });
      return;
    }
    const pos = i + 1;
    out.push({ beat: i * BEATS_PER_CHAR, sound: def.sound, hand: assignHand(pos, def.flam), flam: def.flam });
  });
  return out;
}
