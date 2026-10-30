import { LANE_COUNT, NOTE_POINTS, END_PAD_SEC } from './constants.js';
import { judgeDelta, GOOD_WINDOW_SEC } from './judge.js';

/** @typedef {import('./types.js').PlayNote} PlayNote */
/** @typedef {import('./types.js').NoteResult} NoteResult */
/** @typedef {import('./types.js').Counts} Counts */

/**
 * ゲーム状態。時計は持たず、曲時間(秒)を引数で受け取る。
 * DOM/AudioContext に依存しないので単体テストしやすい。
 */
export class Game {
  /** @param {PlayNote[]} notes 時刻順 */
  constructor(notes) {
    this.notes = notes;
    /** @type {PlayNote[][]} レーンごとの時刻順キュー */
    this.queues = Array.from({ length: LANE_COUNT }, () => []);
    for (const n of notes) this.queues[n.lane].push(n);
    /** 各レーンで「次に判定する」ノーツの位置。ミスは必ず先頭から確定するので前進のみ */
    this.heads = new Array(LANE_COUNT).fill(0);

    /** @type {Counts} */
    this.counts = { PERFECT: 0, GOOD: 0, MISSED: 0 };
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    /** 判定オフセット(秒)。正 = 判定時刻を後ろへずらす */
    this.offsetSec = 0;

    /** 描画用フィードバック @type {{ result: NoteResult, deltaSec: number | null, at: number } | null} */
    this.lastJudgement = null;
    /** レーンごとの最終入力時刻(曲時間)。ヒット演出用 */
    this.laneHitAt = new Array(LANE_COUNT).fill(-Infinity);
    /** レーンごとの最後のヒット(PERFECT/GOOD)。判定ライン上のエフェクト用。MISSEDと空打ちは入らない @type {({ result: 'PERFECT' | 'GOOD', at: number } | null)[]} */
    this.laneEffects = new Array(LANE_COUNT).fill(null);
    this.judgedCount = 0;
    this.lastNoteTime = notes.length ? notes[notes.length - 1].time : 0;
  }

  /**
   * 入力。窓内のノーツがあれば判定、なければ空打ち(null)。
   * @param {number} lane
   * @param {number} songTime 入力時刻(曲時間・秒)
   */
  hit(lane, songTime) {
    this.laneHitAt[lane] = songTime;
    const note = this.queues[lane][this.heads[lane]];
    if (!note) return null;
    const deltaSec = songTime - this.offsetSec - note.time;
    const result = judgeDelta(deltaSec);
    if (!result) return null;
    this.heads[lane]++;
    this.#settle(note, result, deltaSec, songTime);
    this.laneEffects[lane] = { result, at: songTime };
    return result;
  }

  /**
   * 毎フレーム呼ぶ。判定窓を過ぎた未判定ノーツをMISSEDにする。
   * @param {number} songTime
   */
  update(songTime) {
    const t = songTime - this.offsetSec;
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const q = this.queues[lane];
      while (this.heads[lane] < q.length && t - q[this.heads[lane]].time > GOOD_WINDOW_SEC) {
        this.#settle(q[this.heads[lane]++], 'MISSED', null, songTime);
      }
    }
  }

  /** @param {number} songTime */
  isFinished(songTime) {
    return this.judgedCount === this.notes.length && songTime >= this.lastNoteTime + END_PAD_SEC;
  }

  /**
   * @param {PlayNote} note
   * @param {NoteResult} result
   * @param {number | null} deltaSec
   * @param {number} songTime
   */
  #settle(note, result, deltaSec, songTime) {
    note.result = result;
    this.judgedCount++;
    this.counts[result]++;
    this.score += NOTE_POINTS[result];
    this.combo = result === 'MISSED' ? 0 : this.combo + 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.lastJudgement = { result, deltaSec, at: songTime };
  }
}
