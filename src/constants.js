/** @typedef {import('./types.js').Sound} Sound */
/** @typedef {import('./types.js').Hand} Hand */

/**
 * 左から順。hand+sound → レーンの対応と、キー割り当てはここが唯一の定義。
 * code は KeyboardEvent.code(キー配列に依存しない物理キー)。
 * @type {ReadonlyArray<{ hand: Hand, sound: Sound, code: string, keyLabel: string, soundLabel: string }>}
 */
export const LANES = Object.freeze([
  { hand: 'L', sound: 'high', code: 'KeyA', keyLabel: 'A', soundLabel: '高' },
  { hand: 'L', sound: 'mid', code: 'KeyS', keyLabel: 'S', soundLabel: '中' },
  { hand: 'L', sound: 'low', code: 'KeyD', keyLabel: 'D', soundLabel: '低' },
  { hand: 'R', sound: 'low', code: 'KeyJ', keyLabel: 'J', soundLabel: '低' },
  { hand: 'R', sound: 'mid', code: 'KeyK', keyLabel: 'K', soundLabel: '中' },
  { hand: 'R', sound: 'high', code: 'KeyL', keyLabel: 'L', soundLabel: '高' },
]);
export const LANE_COUNT = LANES.length;

// --- 判定(音ごと) ---
export const PERFECT_WINDOW_MS = 60;
export const GOOD_WINDOW_MS = 130;
export const NOTE_POINTS = Object.freeze({ PERFECT: 100, GOOD: 50, MISSED: 0 });

// --- 判定(曲ごと): accuracy = 得点 / (ノーツ数 × PERFECT点)。上から順に最初に満たしたもの ---
export const SONG_RANKS = Object.freeze([
  { name: 'PERFECT', minAccuracy: 0.95 },
  { name: 'GREAT', minAccuracy: 0.85 },
  { name: 'GOOD', minAccuracy: 0.7 },
]);
export const SONG_RANK_FALLBACK = 'TRY AGAIN';

// --- タイミング ---
/** ノーツが画面上端から判定ラインに届くまでの秒数(小さいほど速い) */
export const FALL_SEC = 1.6;
/**
 * 開始ボタンから譜面の拍0までのリードイン(小節数)。秒ではなく拍で持つことで、
 * BPM・速さ倍率が変わっても常に小節頭から数え始められる(カウントイン兼用)
 */
export const LEAD_IN_BARS = 1;
/** メトロノームの先読み幅(秒)。フレームが多少詰まっても次の拍を取りこぼさない長さ */
export const METRONOME_LOOKAHEAD_SEC = 0.25;
/**
 * セクション名表示: ノーツが上から降り始める頃(= 開始の FALL_SEC 前)に、フェードイン→保持→フェードアウト。
 * 全体の長さは文字譜の1行分(= SECTION_LABEL_BARS 小節)の演奏時間で、BPM・速さ倍率に追従する
 */
export const SECTION_LABEL_BARS = 2;
export const SECTION_FADE_IN_SEC = 0.3;
export const SECTION_FADE_OUT_SEC = 0.5;
/** ノーツの半径: レーン幅の割合(上限あり) */
export const NOTE_RADIUS_RATIO = 0.36;
export const NOTE_RADIUS_MAX = 28;
/** ヒットエフェクトのリング: 半径は START → START+GROW (ノーツ半径の倍率)、線幅は最大 LINE_MAX px から1pxへ。
 *  判定ラインの下の余白(layout.js)はここから計算する */
export const HIT_RING_START = 1.0;
export const HIT_RING_GROW = 0.9;
export const HIT_RING_LINE_MAX = 5;
/** ヒットエフェクト(判定ライン上のリング)の表示時間 */
export const HIT_EFFECT_SEC = 0.3;
/**
 * 背景のジャンベ(上から見た絵)。ゾーンの半径は仮置きで、ここを変えれば絵と光る範囲が一緒に変わる。
 * 半径は皮(skin)の半径に対する割合。低音=中央、中音=内側リング、高音=外側リング。左手は左半分・右手は右半分
 */
export const DRUM_SIZE_RATIO = 1; // 縁を含む外径 / 使える領域(幅・判定ラインまでの高さ)の小さい方の半分。1 = 縦画面ではレーン領域の幅いっぱい(高音レーンも太鼓の中に入る)
export const DRUM_SKIN_RATIO = 0.86; // 皮の半径 / 縁を含む外径
export const DRUM_ZONES = Object.freeze({
  low: Object.freeze({ rIn: 0, rOut: 0.4 }),
  mid: Object.freeze({ rIn: 0.4, rOut: 0.72 }),
  high: Object.freeze({ rIn: 0.72, rOut: 1 }),
});
/** 叩いた位置が光る強さ(最大不透明度)。色と長さ(HIT_EFFECT_SEC)はヒットエフェクトと同じ */
export const DRUM_GLOW_ALPHA = 0.5;
/** 最後のノーツ後、リザルトへ移るまでの余韻 */
export const END_PAD_SEC = 1;
/** フラムの前打音を着地音の何拍前に置くか */
export const FLAM_GAP_BEATS = 0.125;

// --- オフセット ---
export const OFFSET_MIN_MS = -300;
export const OFFSET_MAX_MS = 300;
export const OFFSET_STORAGE_KEY = 'djembe.offsetMs';
export const SETTINGS_STORAGE_KEY = 'djembe.settings';
