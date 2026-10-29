# ジャンベ音ゲー

## プロジェクト概要
- ブラウザで動くジャンベ音ゲー。素のJavaScript(ES Modules)、ビルド不要、TypeScriptは使わない
- リズム練習にも使える。最終的にGitHub Pages等で静的公開し、仲間(スマホ含む)が使う想定
- 作者は経験30年超のSE。JSは実務経験が豊富、TypeScriptは実務未経験。**プログラミング/JSの基礎説明は不要**
- 設計判断は理由を簡潔に添える。特にブラウザ固有の部分(Web Audioの遅延、入力遅延、モバイルのautoplay制限、描画ループ)は理由を添える
- 目的の一つはClaude Codeでの開発の学習。進め方で気づいた点は提案してよい
- 動作確認はローカルサーバーで行う(`python3 -m http.server 8000` → http://localhost:8000/)。file:// では ES Modules が動かない
- 型はJSDocで注釈。`jsconfig.json` で `checkJs` + `strict` を有効にしており、VSCodeで型チェックできる

## ゲーム仕様
- 6レーン(左から: 左高・左中・左低・右低・右中・右高)、上からノーツが降る
- 音は高・中・低の3種類。最初はWeb Audio APIで生成した仮の音。後で録音音源に差し替え可能な構造(`src/voices.js` の `Voice` 関数 + `AudioEngine.setVoices`)
- 操作: キーボード(A S D / J K L = 左高・左中・左低 / 右低・右中・右高)と画面タップ。マルチタッチ対応
- 音ごとの判定: PERFECT / GOOD / MISSED
- 曲ごとの判定: PERFECT / GREAT / GOOD / TRY AGAIN(基準は `src/constants.js` の `SONG_RANKS` に集約)
- 判定オフセット(ms)を画面上で調整でき、localStorageに保存する
  - 符号: 正 = 「自分は遅れて叩きがち/音が遅れて聞こえる」ので判定を後ろへずらす。`補正後の差 = 叩いた時刻 - ノーツ時刻 - offset`
- 時間管理はWeb Audio APIの `currentTime` を基準にする(setTimeoutやDate.nowは基準にしない)
- 「タップして開始」ボタンでAudioContextを開始する(モバイルのautoplay制限対応)
- 描画はcanvasとrequestAnimationFrame

## 譜面の内部形式
`{ beat, sound, hand, flam }`
- sound: `high` / `mid` / `low`、hand: `L` / `R`、flam: boolean
- `Chart = { bpm, notes: ChartNote[] }`
- ゲーム本体は内部形式だけを読む。文字譜は変換して内部形式にする
- 判定側(ノーツの時刻・レーン)は文字譜の仕様変更の影響を受けない構造にする
  - `chart.js` の `buildPlayNotes` が内部形式 → `{time, lane, sound, result}` に変換する唯一の場所
  - レーンは `LANES` 定義(hand + sound → lane)から導出
- flam:true の `hand` は「着地側(2音目)の手」。直前(`FLAM_GAP_BEATS` 前)に反対の手の前打音を1つ足す(= 2つの近接ノーツ)。将来1ノーツ表示にする場合は `expandFlams` だけを変更する

## 文字譜の仕様(段階4で実装。段階1〜3では未実装)
- ド=低音、ト=中音、タ=高音、ロ=中音フラム、ラ=高音フラム、ッ=休符
- 1文字=8分音符、1小節=8文字、1行=16文字(2小節)
- 行の文字数が16でなければ警告を出す
- ヘッダー: BPM、拍子
- `[パート名]` で区切る。`[パート名] x8` でそのパートを8回繰り返す
- 手の割り当て: パート内の文字位置が奇数なら右手、偶数なら左手(休符も1文字として数える。位置はパートの頭から数え直す)
- 食い(前の小節にはみ出す音)も、書かれた位置の奇偶で手を決める
- フラム(ロ・ラ)は位置が奇数なら「右→左」、偶数なら「左→右」の2音
- 手の例外指定は将来追加する。自動割り当てを上書きできる設計にしておく
- テスト曲: `songs/djole.txt`(合図→伴奏x8→合図→ショフ→合図、BPM130、全30小節)

## コード構成の方針
- 譜面の変換処理(文字譜→内部形式)は、DOMやWeb Audioに依存しない純粋関数として分離する
- 変換処理にはNode標準の `node:test` でユニットテストを書く(追加パッケージ不要。段階4で実施)
- テスト対象: 手の割り当て、フラムの偶奇、繰り返し、行の文字数チェック
- 純粋ロジック(`chart.js` / `judge.js` / `constants.js`)はDOM・AudioContextに触れない。`game.js` も時刻を引数で受け取り、自前で時計を持たない

## ファイル構成
```
index.html / style.css / jsconfig.json
src/
  types.js      JSDoc typedef のみ
  constants.js  レーン定義・判定窓・スコア・曲ランク基準・タイミング定数
  chart.js      内部形式 → 再生用ノーツ(純粋)
  judge.js      判定窓/曲ランク(純粋)
  game.js       ゲーム状態(スコア/コンボ/判定)。時刻は引数
  voices.js     合成音 Voice と sampleVoice(録音差し替え用)
  audio.js      AudioEngine(unlock / 再生)
  input.js      キーボード + Pointer Events
  renderer.js   canvas描画、レイアウト、座標→レーン
  storage.js    オフセットのlocalStorage(try/catch済み)
  ui.js         開始/リザルト/オフセットのDOM
  main.js       状態遷移とrAFループ
  data/demoChart.js  仮譜面(約30秒、内部形式)
  data/easyChart.js  判定確認用の易しい譜面(BPM60、20ノーツ)
  data/charts.js     譜面レジストリ(URL ?chart=easy / ?chart=demo で切替)
songs/djole.txt 文字譜(段階4で使用)
```

## 進捗
- [x] 段階1〜3: 画面、入力と判定、リザルト、オフセットUI(仮譜面)
- [ ] 段階4: 文字譜パーサ + node:test
- [ ] 以降: 録音音源への差し替え、手の例外指定、フラム1ノーツ表示、公開
