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
  'カ': { sound: 'clap', flam: false }, // クラップ。譜面では1ノーツ。左高と右高の同時打ちに展開される(chart.js)
});

const DEFAULT_BEATS_PER_BAR = 4;
/** 1文字 = 8分音符 = 0.5拍 */
const BEATS_PER_CHAR = 0.5;
/** 1行 = 2小節 */
const BARS_PER_LINE = 2;

/** 連符の長さ(文字数)の省略時の値。`3タタタ` = `3/4タタタ`(4文字 = 2拍に3音) */
export const DEFAULT_TUPLET_SPAN = 4;

/**
 * 譜面の1要素。連符は「span 文字ぶんの時間に count 音を等間隔」(例: `3/4タタタ`)。
 * @typedef {{ kind: 'char', ch: string, line: number }
 *   | { kind: 'tuplet', count: number, span: number, chars: string[], line: number }} NotationItem
 */

const PART_HEADER = /^\[(.+?)\]\s*(.*)$/;
export const AUTO_PLAY_KEYWORD = '自動音';
/** `順手` / `順手(左)` / `順手（右）`。休符を数えず、叩く音だけで交互にする。括弧で最初の手を指定(省略時は右) */
const SEQUENTIAL_HAND = /順手(?:\s*[（(]\s*([左右LRlr])\s*[）)])?/;
const HEADER_LINE = /^(タイトル|BPM|拍子)\s*[:：]\s*(.*)$/i;

/**
 * パート名の後ろの指定(例: "x8" / "自動音" / "順手(左)" / "自動音 x2" / "x2 自動音")を読む。順不同。
 * @param {string} rest `[名前]` より後ろの文字列
 * @returns {{ repeat: number, autoPlay: boolean, sequential: Hand | null, unknown: string[] }} sequential = 順手の最初の手(指定なしは null)
 */
export function parsePartOptions(rest) {
  let repeat = 1;
  let autoPlay = false;
  /** @type {Hand | null} */
  let sequential = null;
  const seq = SEQUENTIAL_HAND.exec(rest);
  if (seq) {
    sequential = seq[1] === '左' || /^[lL]$/.test(seq[1] ?? '') ? 'L' : 'R';
    rest = rest.replace(SEQUENTIAL_HAND, ' ');
  }
  /** @type {string[]} */
  const unknown = [];
  // "x 8" のような空白入りも "x8" として扱う
  for (const tok of rest.replace(/([xX×])\s+(\d)/g, '$1$2').split(/\s+/).filter(Boolean)) {
    const m = /^[xX×](\d+)$/.exec(tok);
    if (m) repeat = Number(m[1]);
    else if (tok === AUTO_PLAY_KEYWORD) autoPlay = true;
    else unknown.push(tok);
  }
  return { repeat, autoPlay, sequential, unknown };
}

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
 * 全角の数字・スラッシュを半角にする(連符の記法用)。
 * @param {string} ch
 */
const halfWidth = (ch) => (ch === '／' ? '/' : /[０-９]/.test(ch) ? String.fromCharCode(ch.charCodeAt(0) - 0xfee0) : ch);
const isDigit = (/** @type {string} */ ch) => /^[0-9]$/.test(halfWidth(ch));

/**
 * 1行ぶんの文字を要素に分ける。連符 `n/m` + 音n文字(mは省略可。省略時 DEFAULT_TUPLET_SPAN)を1要素にする。
 * 連符は行をまたがない。音が足りない、数字が不正な連符は警告して捨てる(その分の時間は数えない)。
 * @param {string[]} chars 空白を除いた1行
 * @param {number} line
 * @param {NotationWarning[]} warnings
 * @returns {{ items: NotationItem[], length: number }} length = 占める時間(文字数換算)
 */
export function parseLineItems(chars, line, warnings) {
  /** @type {NotationItem[]} */
  const items = [];
  let length = 0;
  for (let i = 0; i < chars.length; i++) {
    if (!isDigit(chars[i])) {
      items.push({ kind: 'char', ch: chars[i], line });
      length += 1;
      continue;
    }
    let j = i;
    let countText = '';
    while (j < chars.length && isDigit(chars[j])) countText += halfWidth(chars[j++]);
    let spanText = '';
    const hasSpan = halfWidth(chars[j] ?? '') === '/';
    if (hasSpan) {
      j++;
      while (j < chars.length && isDigit(chars[j])) spanText += halfWidth(chars[j++]);
    }
    const count = Number(countText);
    const span = hasSpan ? Number(spanText) : DEFAULT_TUPLET_SPAN;
    const written = chars.slice(i, j).join('');
    const body = chars.slice(j, j + count);
    const problem =
      !(count >= 1) ? '音数が不正です'
      : !(span >= 1) ? '長さ(文字数)が不正です'
      : body.length < count || body.some(isDigit) ? `音が${count}個ありません`
      : null;
    if (problem) {
      warnings.push({ line, message: `連符「${written}」を無視します(${problem}): ${chars.join('')}` });
      i = j - 1; // 数字部分だけ読み飛ばし、後ろは通常の文字として続ける
      continue;
    }
    items.push({ kind: 'tuplet', count, span, chars: body, line });
    length += span;
    i = j + count - 1;
  }
  return { items, length };
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
  /** @type {{ name: string, repeat: number, autoPlay: boolean, sequential: Hand | null, items: NotationItem[], length: number, line: number }[]} */
  const parts = [];
  let current = null;

  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, idx) => {
    const lineNo = idx + 1;
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;

    const partMatch = PART_HEADER.exec(line);
    if (partMatch) {
      const opts = parsePartOptions(partMatch[2]);
      for (const tok of opts.unknown) {
        warnings.push({ line: lineNo, message: `パート指定「${tok}」は未対応です(無視します): ${line}` });
      }
      let repeat = opts.repeat;
      if (repeat < 1) {
        warnings.push({ line: lineNo, message: `繰り返し回数が0です。1回として扱います: ${line}` });
        repeat = 1;
      }
      current = { name: partMatch[1], repeat, autoPlay: opts.autoPlay, sequential: opts.sequential, items: [], length: 0, line: lineNo };
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
    const parsed = parseLineItems(chars, lineNo, warnings);
    if (parsed.length !== expected) {
      warnings.push({ line: lineNo, message: `1行は${expected}文字のはずですが${parsed.length}文字です: ${line}` });
    }
    current.items.push(...parsed.items);
    current.length += parsed.length;
  });

  if (header.bpm === undefined || !Number.isFinite(header.bpm) || header.bpm <= 0) {
    throw new Error('BPMが未指定、または不正です(例: BPM: 130)');
  }
  const beatsPerBar = header.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;

  /** @type {ChartNote[]} */
  const notes = [];
  /** @type {{ beat: number, name: string }[]} */
  const sections = [];
  let cursorBeat = 0;
  for (const part of parts) {
    if (part.length === 0) {
      warnings.push({ line: part.line, message: `パート[${part.name}]に譜面がありません` });
    }
    const partNotes = buildPartNotes(part.items, warnings, part.autoPlay, part.sequential);
    const partBeats = part.length * BEATS_PER_CHAR;
    sections.push({ beat: cursorBeat, name: part.name }); // x指定の繰り返しは最初の1回だけ
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
    chart: { bpm: header.bpm, beatsPerBar, totalBeats: cursorBeat, notes, sections },
    warnings,
  };
}

/**
 * 1パート分(繰り返し前)をパート先頭基準のbeatで内部形式にする。
 * 食い(前の小節にはみ出す音)も特別扱いせず、書かれた位置の奇偶で手が決まる。
 * 連符は、先頭の手を開始位置の奇偶で決め、中は交互に叩く。連符の後ろの位置は span 文字ぶん進む。
 * @param {NotationItem[]} items
 * @param {NotationWarning[]} warnings
 * @param {boolean} autoPlay
 * @param {Hand | null} sequential 順手の最初の手。null = 位置の奇偶で決める(休符も数える)
 * @returns {ChartNote[]}
 */
function buildPartNotes(items, warnings, autoPlay, sequential) {
  /** @type {ChartNote[]} */
  const out = [];
  /** @param {ChartNote} note */
  const push = (note) => {
    if (autoPlay) note.autoPlay = true; // falseのときはキーを付けない(省略 = false)
    out.push(note);
  };
  /** @param {string} ch @param {number} line @returns {{ sound: Sound, flam: boolean } | null} */
  const noteOf = (ch, line) => {
    if (ch === REST_CHAR) return null;
    const def = NOTE_CHARS[ch];
    if (!def) warnings.push({ line, message: `未対応の文字「${ch}」を休符として扱います` });
    return def ?? null;
  };

  // 順手: 休符を数えず、叩く音だけで交互にする。nextHand = 次に叩く音の手
  /** @type {Hand} */
  let nextHand = sequential ?? 'R';
  const flip = (/** @type {Hand} */ h) => (h === 'R' ? 'L' : 'R');
  /**
   * 音1つの手を決める。順手でなければ位置の奇偶(assignHand)。
   * 順手: 通常の音は nextHand で、次は反対の手。フラムは前打音が nextHand・本音が反対で、次は前打音と同じ手。
   * クラップは両手なので手を進めない
   * @param {number} pos 1始まりの文字位置
   * @param {{ sound: Sound, flam: boolean }} def
   * @returns {Hand}
   */
  const handOf = (pos, def) => {
    if (sequential === null) return assignHand(pos, def.flam);
    if (def.sound === 'clap') return nextHand;
    if (def.flam) return flip(nextHand); // 本音。次の音は nextHand のまま(= 前打音と同じ手)
    const h = nextHand;
    nextHand = flip(h);
    return h;
  };

  let at = 0; // ここまでに占めた文字数(0始まりの位置)
  for (const item of items) {
    if (item.kind === 'char') {
      const def = noteOf(item.ch, item.line);
      if (def) push({ beat: at * BEATS_PER_CHAR, sound: def.sound, hand: handOf(at + 1, def), flam: def.flam });
      at += 1;
      continue;
    }
    const first = assignHand(at + 1, false); // 順手では使わない
    item.chars.forEach((ch, k) => {
      const def = noteOf(ch, item.line);
      if (!def) return;
      if (def.flam) warnings.push({ line: item.line, message: `連符の中ではフラム「${ch}」は使えません(通常の音として扱います)` });
      const hand = sequential !== null ? handOf(at + 1, { sound: def.sound, flam: false }) : k % 2 === 0 ? first : flip(first);
      // 掛け算を先にして割る(2/3 などの丸め誤差を最小にする)
      push({ beat: ((at * item.count + k * item.span) / item.count) * BEATS_PER_CHAR, sound: def.sound, hand, flam: false });
    });
    at += item.span;
  }
  return out;
}
