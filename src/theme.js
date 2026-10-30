// ゲーム画面(canvas)の色の定義。色の調整はここだけで済む(描画は paint.js / renderer.js がここを読む)。
// 開始画面などDOM側の色は style.css。
//
// 書式の約束(dev/color-tuner.html が、コメントを残したまま値だけ差し替えて書き出すために読む):
//   - 値は1行に1つ。入れ子は `key: {` ... `},`(深さは何段でもよい)
//   - 色は '#rgb' / '#rrggbb' / 'rgba(r, g, b, a)'、割合・不透明度は 0..1 の数値
// 実行時に値を書き換えるのは調整ページだけ(描画は毎フレーム読み直すので、書き換えるとすぐ反映される)。

export const THEME = {
  // 画面全体の背景(レーンの外側に見える色)
  background: '#12141a',

  // 音ごとのノーツの基本色。ノーツ本体に加えて、叩いたレーンの光・下部のキー表示・PERFECT帯での発光にも使う。
  // 判定の色(judgement)と被ると叩いた音の色と取り違えるので、judgement とは別の色相にする
  sound: {
    high: '#ffff40', // 高音のノーツ
    mid: '#40ff40'  , // 中音のノーツ
    low: '#ff4040', // 低音のノーツ
  },

  // ノーツの状態ごとの変化
  note: {
    goodMix: 0.4, // GOOD帯に入った未判定ノーツ: 音の色を白へ混ぜる割合(0 = 音の色のまま、1 = 白)
    perfectMix: 0.75, // PERFECT帯に入った未判定ノーツ: 同上(goodMix より大きくする)
    perfectOutline: '#ffffff', // PERFECT帯のノーツの縁取り(発光の色は音の色)
    missed: '#777', // MISSEDになったノーツの色
    missedAlpha: 0.3, // MISSEDノーツの不透明度
  },

  // 判定の色。判定の文字・ずれ(ms)の表示・ヒットリング・太鼓の光で共通
  judgement: {
    PERFECT: '#fcd66f', // PERFECT
    GOOD: '#ffffff', // GOOD  
    MISSED: '#888888', // MISSED
  },  

  // 判定帯(判定ライン周辺の、判定が通る範囲を示す帯)。白の透明度で重ねる
  band: {
    good: 'rgba(255, 255, 255, 0.06)', // GOOD の範囲(広い側)
    perfect: 'rgba(255, 255, 255, 0.12)', // PERFECT の範囲(内側。GOOD の上に重なる)
  },

  // ヒットエフェクト(叩いたレーンの判定ライン上に広がるリング)。色は judgement
  hitEffect: {
    fillAlpha: 0.3, // 円の塗りの最大不透明度(時間とともに薄くなる)
    ringAlpha: 0.85, // リング線の最大不透明度(同上)
  },

  // 背景の太鼓
  drum: {
    skin: 'rgba(255, 255, 255, 0.07)', // 皮の塗り
    line: 'rgba(255, 255, 255, 0.07)', // 外周とゾーンの境目の線
    glowAlpha: 0.5, // 叩いた位置が光る最大不透明度(時間とともに薄くなる)。色は judgement
  },

  // 拍線(横線)
  beatLine: {
    bar: 'rgba(255,255,255,0.3)', // 小節の頭(濃い)
    beat: 'rgba(255,255,255,0.1)', // それ以外の拍(薄い)
  },

  // レーン
  lane: {
    even: '#1c2029', // 左から1・3・5番目のレーンの背景
    odd: '#181b23', // 左から2・4・6番目のレーンの背景
    flashAlpha: 0.35, // 叩いたとき、レーン全体が音の色で光る最大不透明度
    line: '#2c313d', // レーンの区切り線
    handDivider: '#4a5163', // 左手と右手の境目(中央の線)
  },

  // 判定ライン
  judgeLine: '#ffffff',

  // 画面下部のキー表示の帯
  keyStrip: {
    background: '#0d0f14', // 帯の背景
    text: '#8a91a1', // 「左高」などの小さい文字(キー文字は音の色)
  },

  // 文字(HUD)
  hud: {
    text: '#fff', // SCORE / AUTO PLAY / コンボの数
    muted: '#8a91a1', // COMBO の文字
    sectionFill: '#ffffff', // セクション名の文字
    sectionOutline: '#12141a', // セクション名の縁取り
  },
};
