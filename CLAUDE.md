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
- 拍音(メトロノーム): 4分音符ごと、小節頭は高め・強め。ジャンベと聞き分けやすい非ノイズのベル系合成音(`playClick`)。判定・スコアには関与せず、判定オフセットも掛けない。速さ倍率に追従。リードイン中も鳴らす(カウントイン)
  - `AudioContext.currentTime` 基準の先読みスケジュール(`LookaheadScheduler.tick()` を毎フレーム呼び、先読み0.25秒分を予約。拍音と自動音で共用)。setTimeout/setIntervalで鳴らさない: タイマー精度がそのまま拍のずれになるため
  - リードインは秒ではなく小節数(`LEAD_IN_BARS`=1)で持つ。秒固定だとBPM/倍率次第でカウントインが小節頭から始まらないため
- 自動音(autoPlay): 譜面の指定したパートのノーツを、ノーツの時刻ちょうどに自動で鳴らす(合図などアンサンブルの入りの基準。ずれると意味がない)
  - 拍音と同じ先読みスケジュールで予約する。MISSED確定後に鳴らす方式は不可(判定の遅れ分だけ遅れるため)
  - 判定・スコア・コンボは通常どおり(自動音は判定に関与しない)。プレイヤーが叩いた音は従来どおり即時再生で、自動音と重なってよい
  - 判定オフセットは掛けない(常に譜面の時刻ちょうど)。音量は固定で、ジャンベと同じ経路(別バス・UIなし)
  - 対象は最初の[合図]だけ(`songs/djole.txt` の最初の `[合図] 自動音`)。「採点なし」案は不採用
  - 自動音と叩いた音の二重再生の聞こえ方は、実機で聞いてから対応を判断する(未対応)
- セクション名表示: 文字譜の `[パート名]` を、そのパートのノーツが上から降り始める頃(開始の `FALL_SEC` 前)に、画面上部へフェードイン(0.3秒)→保持→フェードアウト(0.5秒)で出す(判定の文字と同じ大きさ)。表示の長さは文字譜1行分(2小節 = `SECTION_LABEL_BARS`)の演奏時間で、BPM・倍率に追従(130BPMで約3.7秒)。`x` の繰り返しは最初の1回だけ。全パートを表示。時刻は拍から計算するので速さ倍率に追従
  - `Chart.sections = [{ beat, name }]`(`parseNotation` が生成。demo/easyは無し)。表示タイミングは `src/sections.js`(純粋)、描画は `renderer.js`
- 判定位置の可視化: 判定ライン周辺に判定窓(`PERFECT_WINDOW_MS` / `GOOD_WINDOW_MS`)を落下距離に換算した帯を描く(GOOD は薄く、内側の PERFECT は濃く)。位置は拍線・ノーツと同じ `yOf(time, t)`
  - 帯の中心は判定オフセット分ずれる(`windowBands(offsetSec)`)。判定が実際に通る範囲を示すため。白い判定ライン自体は動かない
  - 未判定ノーツは、GOOD帯に入ると明るい色、PERFECT帯に入ると更に明るく+光る(`zoneOfNote`。判定と同じ `judgeDelta` を使う)
  - 叩いたレーンの判定ライン上にヒットエフェクト(リング、0.3秒)。PERFECT/GOOD のみで、MISSED と空打ちは出さない(`Game.laneEffects`)
  - リングが切れないよう、判定ラインの下に余白を確保する(`layout.js` の `ringMargin` = リング最大半径を切り上げ。`HIT_RING_*` 定数から計算するのでエフェクトのサイズ変更に追従)。判定ライン(canvas高さの0.8)・落下距離・帯の幅は変えず、キー表示の帯がその余白の下に下がる
- 背景のジャンベ: レーンの後ろに、ジャンベを上から見た円形の皮を薄く描く(画像素材なし、canvas)。縁は描かない(一度は描いたが、皮が小さくなり高音レーンが縁にかかるため廃止)。皮の半径は領域(レーン幅・判定ラインまでの高さ)の小さい方いっぱい(`DRUM_SIZE_RATIO` = 1。縦画面ではレーン領域の幅いっぱいで、左右の端の高音レーンも太鼓の中に入る)に収め、横はレーン領域の中央・縦は上端〜判定ラインの中央。判定ラインより下には出さないので `ringMargin` や落下距離・帯の幅は変わらない
  - 叩いた位置が光る: 低音=中央、中音=内側リング、高音=外側リング(仮置き)。左手は左半分、右手は右半分。ゾーンの半径は `constants.js` の `DRUM_ZONES`(皮の半径に対する割合)、大きさは `DRUM_SIZE_RATIO`、光の強さは `theme.js` の `drum.glowAlpha`
  - 判定の色は PERFECT=金(#ffd24a)・GOOD=青(#4ac3ff)・MISSED=灰(`theme.js` の `THEME.judgement`。判定の文字・ずれのms表示・ヒットリング・太鼓の光で共通)。ノーツの音の色(`THEME.sound`: 高=オレンジ #ff9a3c・中=緑 #6ee7a0・低=赤 #ff6f6f)とは被らない色にする。以前は PERFECT=黄・GOOD=青で音の色(高=黄・中=青)と被り、太鼓の光が叩いた音と違う色に見えたため。PERFECT を一番目立つ色(金)にする方針で、高音ノーツを黄からオレンジ寄りにし、中音ノーツの青と GOOD の緑を入れ替えた。ピンクは試して不採用(見た目が合わなかった)
  - 光らせる条件・色・長さはヒットエフェクトと同じ。`Game.laneEffects`(PERFECT/GOOD のみ。MISSED・空打ちは入らない。自動演奏の自動ヒットも入る)から作るので、描画の時計も同じ曲時間。計算は `src/drum.js`(`drumLayout` / `drumZoneArc` / `activeGlows`)
  - 表示のみ。タップ入力は変えていない(太鼓モードは将来の候補)
- 全部自動演奏(お手本): 開始画面の副ボタン「自動演奏」で開始する(「タップして開始」の下、広い画面では右)。押したボタンでモードが決まり、ON/OFFの状態は持たない。譜面の確認とお手本が目的。どちらのボタンもクリックの中で同期的に `AudioContext` を unlock する
  - 全ノーツを、自動音と同じ先読みスケジュール(`AudioContext.currentTime` 基準・0.25秒)で時刻ちょうどに予約して鳴らす(`selectAutoNotes(notes, true)`)。MISSED確定後に鳴らす方式は不可
  - ノーツは時刻ちょうどに PERFECT として消化され(`Game` の `autoAll`)、その瞬間に判定ライン上のヒットエフェクトとレーンの光が出る。判定オフセットは掛けない
  - 確認済みの方針: 叩いた音は重ねて鳴らす(判定には使わない) / 音量は固定(ジャンベと同じ経路・UIなし) / スコア・コンボ・判定文字は出さず「AUTO PLAY」表示、曲が終わるとリザルトなしで開始画面へ / 状態を持たないので、次回も自動演奏のまま、という事故は起きない
- 拍線: 小節頭は濃く、他の拍は薄い横線。ノーツと同じ `yOf(time, t)` で位置計算
- 開始画面の設定(localStorage `djembe.settings`): 拍音ON/OFF・音量、拍線ON/OFF、速さ倍率(スライダー0.5〜1.5・刻み0.05、横に「×0.85 (BPM 110)」表示。保存値は0.5〜1.5にクランプ)。`?speed=`(0.1〜4)指定時はそれが優先(スライダーは無効化し理由を表示)。文字譜の警告も開始画面に表示
- TOPページの見た目(`style.css`): タイトルは金のグラデーション文字、曲名はタイトルに次ぐ大きさ(`clamp(22px, 6.4vw, 40px)`)の白い太字で、先頭の「♪」は CSS(`.song-title::before`)で付ける(曲名が空なら `:empty` で非表示)。開始ボタンは金のグラデーションのピル型、設定・オフセットのパネルはすりガラス風。`#screen-title` に `display` を指定しない(`section[hidden]` を ID 指定が上書きして、結果画面でもTOPが残るため)

## 譜面の内部形式
`{ beat, sound, hand, flam, autoPlay? }`
- sound: `high` / `mid` / `low`、hand: `L` / `R`、flam: boolean、autoPlay: boolean(省略時false。trueのノーツは時刻ちょうどに自動再生)
- `Chart = { bpm, beatsPerBar, totalBeats, notes: ChartNote[], sections?: {beat, name}[] }`(beatsPerBar/totalBeats は拍音・拍線の格子用。速さ倍率は bpm にだけ掛かる)
- ゲーム本体は内部形式だけを読む。文字譜は変換して内部形式にする
- 判定側(ノーツの時刻・レーン)は文字譜の仕様変更の影響を受けない構造にする
  - `chart.js` の `buildPlayNotes` が内部形式 → `{time, lane, sound, result}` に変換する唯一の場所
  - レーンは `LANES` 定義(hand + sound → lane)から導出
- flam:true の `hand` は「着地側(2音目)の手」。直前(`FLAM_GAP_BEATS` 前)に反対の手の前打音を1つ足す(= 2つの近接ノーツ)。将来1ノーツ表示にする場合は `expandFlams` だけを変更する

## 文字譜の仕様(段階4で実装済み: `src/notation.js`)
- ド=低音、ト=中音、タ=高音、ロ=中音フラム、ラ=高音フラム、ッ=休符
- 1文字=8分音符、1小節=8文字、1行=16文字(2小節)
- 行の文字数が16でなければ警告を出す
- ヘッダー: BPM、拍子
- `[パート名]` で区切る。`[パート名] x8` でそのパートを8回繰り返す。`[パート名] 自動音` でそのパートのノーツが autoPlay:true になる(`x` 指定と併用可・順不同。例: `[合図] 自動音 x2`)。フラムの前打音・本音は両方 autoPlay
- 手の割り当て: パート内の文字位置が奇数なら右手、偶数なら左手(休符も1文字として数える。位置はパートの頭から数え直す)
- 食い(前の小節にはみ出す音)も、書かれた位置の奇偶で手を決める
- フラム(ロ・ラ)は位置が奇数なら「右→左」、偶数なら「左→右」の2音
- 手の例外指定は将来追加する。自動割り当てを上書きできる設計にしておく
- 実装メモ: 1行の期待文字数は `拍子×4`(拍子4なら16)。警告は `{line, message}` で返し、読み込みは続行する。BPM不正・パート外の譜面は例外。`#` 始まりの行はコメント。x8 は `x`/`X`/`×` を受ける
- 手の割り当ては `assignHand(pos, flam)` に集約(例外指定を足すときはここを呼ぶ側で上書き)。フラムの internal `hand` は本音側
- テスト曲: `songs/djole.txt`(合図[自動音]→伴奏x4→合図→ショフ→合図、BPM130、全22小節。当初は伴奏x8の30小節だったが短縮して正式採用)

## コード構成の方針
- 譜面の変換処理(文字譜→内部形式)は、DOMやWeb Audioに依存しない純粋関数として分離する
- 変換処理にはNode標準の `node:test` でユニットテストを書く(追加パッケージ不要。段階4で実施)
- テスト対象: 手の割り当て、フラムの偶奇、繰り返し、行の文字数チェック
- 純粋ロジック(`chart.js` / `beats.js` / `notation.js` / `settings.js` / `judge.js` / `constants.js`)はDOM・AudioContextに触れない。`game.js` も時刻を引数で受け取り、自前で時計を持たない

## 色の管理
- ゲーム画面(canvas)の色は `src/theme.js` の `THEME` に集約する。各値に「何を変えるものか」のコメントがある。`renderer.js` / `paint.js` に色を直書きしない(DOM側の色は `style.css`)
- `THEME` は毎フレーム読み直す(キャッシュしない)ので、実行時に書き換えると次のフレームから反映される。これが色の調整ページの前提
- 書式の約束: 値は1行に1つ、入れ子は `key: {` ... `},`、色は `#rgb` / `#rrggbb` / `rgba(r, g, b, a)`、割合・不透明度は 0..1(調整ページが theme.js をコメントごと読み書きするため)
- 不変条件(`tests/theme.test.js`): 音の色(高・中・低)と判定の色(PERFECT・GOOD・MISSED)は6色すべて別(被ると叩いた音と取り違える)。`sound.*` は `#rrggbb`(白への混ぜ計算のため)
- 色の調整ページ(`dev/color-tuner.html`。`dev/` は .gitignore で公開・コミットされない): `python3 dev/serve.py` → http://localhost:8000/dev/color-tuner.html。本番と同じ `paint.js` / `Renderer` で、ノーツ(音×未判定・GOOD帯・PERFECT帯・MISSED)・ヒットリング・太鼓の光・ゲーム画面全体(中音と高音を交互に叩く再生つき)を見ながら、カラーピッカーとスライダーで調整する。決めた値は theme.js 全文(コメントそのまま、変えた行だけ差し替え)として書き出し、貼り付ける。`dev/` はコミットされないので、別の環境では手元で作り直しが必要

## ファイル構成
```
index.html / style.css / jsconfig.json
src/
  types.js      JSDoc typedef のみ
  constants.js  レーン定義・判定窓・スコア・曲ランク基準・タイミング定数
  chart.js      内部形式 → 再生用ノーツ、withSpeed(速さ倍率)(純粋)
  beats.js      拍の時刻計算 gridOf/leadInSec/beatsInWindow(純粋。拍音と拍線が共用)
  settings.js   設定の型・既定値・検証、?speed=の解釈(純粋)
  scheduler.js  先読みスケジューラ(拍音・自動音で共用)
  autoplay.js   自動音の選別と時刻窓(純粋)
  sections.js   セクション名の表示タイミング・不透明度(純粋)
  notation.js   文字譜 → 内部形式 + 警告(純粋)
  songIndex.js  songs/index.json の検証と曲の選択(純粋)
  chartLoader.js ?chart= と index.json から譜面を用意(fetchあり)。失敗時は default → demo + 警告。loadSong(id) はTOP画面の曲の切り替えで使う
  judge.js      判定窓/曲ランク/判定帯の位置(純粋)
  layout.js     canvasレイアウト(判定ライン位置・リングの余白)(純粋)
  drum.js       背景ジャンベの配置・光る領域(音と手→半円環)・今光っているレーン(純粋)
  theme.js      ゲーム画面(canvas)の色の定義。色の調整はここだけ(ノーツ・判定・帯・ヒットリング・太鼓・拍線・レーン・HUD)
  paint.js      色に関わる描画部品(ノーツ・帯・ヒットリング・太鼓の光など)。theme.js だけを読む。renderer.js と色の調整ページが共用
  game.js       ゲーム状態(スコア/コンボ/判定)。時刻は引数
  voices.js     合成音 Voice と sampleVoice(録音差し替え用)
  audio.js      AudioEngine(unlock / 再生)
  input.js      キーボード + Pointer Events
  renderer.js   canvas描画(paint.js の部品を並べる)、レイアウト、座標→レーン
  storage.js    オフセット・設定のlocalStorage(try/catch済み)
  ui.js         開始/リザルト/オフセットのDOM
  main.js       状態遷移とrAFループ
  data/demoChart.js  仮譜面(約30秒、内部形式)
  data/easyChart.js  判定確認用の易しい譜面(BPM60、20ノーツ)
  data/charts.js     内蔵譜面(easy / demo)のレジストリ
tests/*.test.js  node:test(notation / beats / settings)
songs/index.json 曲一覧と既定曲 / songs/<id>.txt 文字譜
```

## 曲の管理
- `songs/index.json` = `{ "default": "<id>", "songs": [{ "id", "title" }] }`。曲の実体は `songs/<id>.txt`
- **既定曲の変更は index.json の `default` の1行を書き換えるだけ**(コード変更不要)。曲を足すときは `songs` に1行足して `<id>.txt` を置く
- 読み込み順: `?chart=<id>`(index.jsonの一覧にあるもの。`easy`/`demo` は内蔵譜面)→ 指定なしまたは一覧にない場合は `default`。
  読み込みに失敗したら default → demo に戻り、理由を開始画面の警告欄に出す。`?speed=0.75` で速さ倍率(0.1〜4)
- id は英数字・`_`・`-` のみ(ファイル名になるため)
- **TOP画面で曲を選べる**: `songs/index.json` の `songs` を、曲名の下の選択欄(ネイティブの `<select>`)に並べる。曲を足すときは index.json に1行足すだけ(コード変更不要)
  - 起動時は従来どおり `?chart=` または `default` の曲を読み、選択欄はその曲が選ばれた状態になる。選ぶと `songs/<id>.txt` だけを読み直し、曲名・BPM・警告欄を更新する
  - 読めなかった曲を選んだら、前の曲のまま選択欄を戻し、理由を警告欄に出す。連続で選んだときは最後に選んだ曲の結果だけを使う(`main.js` の `changeSong`)。選択中の曲の Promise は常に解決する(切り替えが失敗しても前の曲に戻るので、読み込み中に開始ボタンを押しても安全)
  - 選べる曲が2つ未満(1曲だけ・一覧が読めない・`?chart=easy|demo` の内蔵譜面)のときは選択欄を隠す
  - 選んだ曲は保存しない(再読み込みすると default または `?chart=` に戻る)

## 進捗
- [x] 段階1〜3: 画面、入力と判定、リザルト、オフセットUI(仮譜面)
- [x] 段階4: 文字譜パーサ(`src/notation.js`) + node:test(`npm test` = `node --test`)
- [x] 拍音・拍線・開始画面の設定UI・警告表示(拍の計算とsettingsはnode:test済み。音とUIは実機未確認)
- [ ] 以降: 録音音源への差し替え、手の例外指定、フラム1ノーツ表示、公開

## 将来の候補(未実装。実装前に仕様を相談する)
- 太鼓モード(タップUI): ジャンベを上から見た太鼓で、叩く位置でレーンを決める案。背景絵(表示のみ)は実装済みで、`drum.js` の配置・ゾーン定義を入力側でも使える。内側リング=中音・外側リング=高音の割り当てと半径は仮置きのまま(実機で見て調整)
- 背景のジャンベの ON/OFF 設定(未実装。見づらい場合に検討。追加前に相談)
- 手の例外指定(文字譜の記法追加。`assignHand` の呼び出し側(`buildPartNotes`)で上書き)
- 譜面をテキストエリアに貼って即プレイできる画面
- ソロの一部をループ練習する機能
- スクロール速度(ハイスピード)を速さ倍率と独立に設定(遅い倍率のほうが難しく感じる、という体感がある)
- 録音音源への差し替え(`Voice` / `sampleVoice` の構造を利用)
- 16分音符・3連符の記法(ソロを書いて必要になったら)
