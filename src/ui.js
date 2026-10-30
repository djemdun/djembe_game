import { OFFSET_MIN_MS, OFFSET_MAX_MS } from './constants.js';
import { SPEED_MIN, SPEED_MAX, SPEED_STEP } from './settings.js';

/** @typedef {import('./types.js').Counts} Counts */
/** @typedef {import('./settings.js').Settings} Settings */
/** @typedef {import('./notation.js').NotationWarning} NotationWarning */

const MAX_WARNINGS_SHOWN = 8;

/** @param {string} id */
function el(id) {
  const e = document.getElementById(id);
  if (!e) throw new Error(`#${id} not found`);
  return e;
}

/**
 * 開始/リザルト/設定/オフセット調整のDOM。ゲーム状態は持たない。
 * @param {object} p
 * @param {number} p.initialOffsetMs
 * @param {(ms: number) => void} p.onOffsetChange
 * @param {Settings} p.settings
 * @param {number | null} p.urlSpeed URLの ?speed=。指定があれば設定の速さより優先される
 * @param {(s: Settings) => void} p.onSettingsChange
 * @param {(autoAll: boolean) => void} p.onStart 開始。true = 自動演奏(お手本)。押したボタンでモードが決まる
 * @param {(id: string) => void} p.onSongChange TOP画面で曲が選ばれた(songs/index.json の id)
 */
export function createUi({ initialOffsetMs, onOffsetChange, settings, urlSpeed, onSettingsChange, onStart, onSongChange }) {
  const overlay = el('overlay');
  const title = el('screen-title');
  const result = el('screen-result');
  const slider = /** @type {HTMLInputElement} */ (el('offset-slider'));
  const output = el('offset-output');

  // --- オフセット ---
  slider.min = String(OFFSET_MIN_MS);
  slider.max = String(OFFSET_MAX_MS);

  /** @param {number} ms */
  const setOffset = (ms) => {
    const v = Math.min(OFFSET_MAX_MS, Math.max(OFFSET_MIN_MS, Math.round(ms)));
    slider.value = String(v);
    output.textContent = `${v > 0 ? '+' : ''}${v} ms`;
    onOffsetChange(v);
  };
  setOffset(initialOffsetMs);

  slider.addEventListener('input', () => setOffset(Number(slider.value)));
  el('offset-minus').addEventListener('click', () => setOffset(Number(slider.value) - 5));
  el('offset-plus').addEventListener('click', () => setOffset(Number(slider.value) + 5));
  // どのボタンもクリックの中で同期的に onStart を呼ぶ(main 側で AudioContext の unlock が最初の await より前に走る)
  el('start-btn').addEventListener('click', () => onStart(false));
  el('auto-btn').addEventListener('click', () => onStart(true));
  el('retry-btn').addEventListener('click', () => onStart(false));

  // --- 曲の選択(songs/index.json の songs) ---
  const songPicker = el('song-picker');
  const songSelect = /** @type {HTMLSelectElement} */ (el('song-select'));
  songSelect.addEventListener('change', () => onSongChange(songSelect.value));

  // --- 設定(拍音・拍線・速さ) ---
  let current = { ...settings };
  const beatOn = /** @type {HTMLInputElement} */ (el('set-beat-on'));
  const beatVol = /** @type {HTMLInputElement} */ (el('set-beat-vol'));
  const beatLines = /** @type {HTMLInputElement} */ (el('set-beat-lines'));
  beatOn.checked = current.beatOn;
  beatVol.value = String(Math.round(current.beatVolume * 100));
  beatVol.disabled = !current.beatOn;
  beatLines.checked = current.beatLines;

  /** @param {Partial<Settings>} patch */
  const update = (patch) => {
    current = { ...current, ...patch };
    onSettingsChange({ ...current });
  };
  beatOn.addEventListener('change', () => {
    beatVol.disabled = !beatOn.checked;
    update({ beatOn: beatOn.checked });
  });
  beatVol.addEventListener('input', () => update({ beatVolume: Number(beatVol.value) / 100 }));
  beatLines.addEventListener('change', () => update({ beatLines: beatLines.checked }));

  const speedSlider = /** @type {HTMLInputElement} */ (el('set-speed'));
  const speedOutput = el('speed-output');
  speedSlider.min = String(SPEED_MIN);
  speedSlider.max = String(SPEED_MAX);
  speedSlider.step = String(SPEED_STEP);
  speedSlider.value = String(current.speed);
  speedSlider.disabled = urlSpeed !== null;
  /** 譜面BPM。読み込み完了(showSongInfo)まで不明 @type {number | null} */
  let baseBpm = null;
  /** 「×0.85 (BPM 110)」。URL指定時はスライダー範囲外の値もそのまま表示する */
  const renderSpeed = () => {
    const v = urlSpeed ?? current.speed;
    speedOutput.textContent = `×${v}` + (baseBpm === null ? '' : ` (BPM ${Math.round(baseBpm * v)})`);
  };
  renderSpeed();
  speedSlider.addEventListener('input', () => {
    // 0.05刻みの小数誤差(0.8500000001)を丸めて保存する
    update({ speed: Math.round(Number(speedSlider.value) * 100) / 100 });
    renderSpeed();
  });
  if (urlSpeed !== null) {
    const note = el('speed-note');
    note.textContent = `URLの ?speed=${urlSpeed} を使用中(設定より優先)`;
    note.hidden = false;
  }

  return {
    /**
     * 曲の選択肢を作る。選べる曲が2つ未満なら選択欄ごと隠す。
     * @param {{ id: string, title: string }[]} songs
     * @param {string} selectedId 一覧にない(demo など)ときは何も選ばれない状態になる
     */
    setSongs(songs, selectedId) {
      songSelect.replaceChildren(
        ...songs.map((s) => {
          const o = document.createElement('option');
          o.value = s.id;
          o.textContent = s.title;
          return o;
        }),
      );
      songSelect.value = selectedId;
      songPicker.hidden = songs.length < 2;
    },
    /** 読み込みに失敗したとき、選択欄を実際に使っている曲へ戻す @param {string} id */
    setSelectedSong(id) {
      songSelect.value = id;
    },
    /** 譜面の読み込み完了後に呼ぶ。警告は画面にも出す(console.warnだけだと気づけない) */
    /** @param {{ title: string, bpm: number, warnings: NotationWarning[] }} info */
    showSongInfo({ title: songTitle, bpm, warnings }) {
      baseBpm = bpm;
      renderSpeed();
      // 「♪」は CSS(.song-title::before)で付ける。空のときは :empty で非表示になる
      el('song-title').textContent = songTitle ?? '';
      const list = el('warnings');
      list.replaceChildren();
      for (const w of warnings.slice(0, MAX_WARNINGS_SHOWN)) {
        const li = document.createElement('li');
        li.textContent = w.line > 0 ? `行${w.line}: ${w.message}` : w.message;
        list.append(li);
      }
      if (warnings.length > MAX_WARNINGS_SHOWN) {
        const li = document.createElement('li');
        li.textContent = `…ほか${warnings.length - MAX_WARNINGS_SHOWN}件(コンソール参照)`;
        list.append(li);
      }
      list.hidden = warnings.length === 0;
    },
    showTitle() {
      // 曲の選択欄は1つを使い回す(2つ作ると選択状態の同期が要るため)。TOPでは警告欄の上に置く
      title.insertBefore(songPicker, el('warnings'));
      title.hidden = false;
      result.hidden = true;
      overlay.hidden = false;
    },
    hide() {
      overlay.hidden = true;
    },
    /** @param {{ rank: string, accuracy: number, counts: Counts, score: number, maxCombo: number }} s */
    showResult(s) {
      el('result-rank').textContent = s.rank;
      el('result-accuracy').textContent = `${(s.accuracy * 100).toFixed(1)}%`;
      el('count-perfect').textContent = String(s.counts.PERFECT);
      el('count-good').textContent = String(s.counts.GOOD);
      el('count-missed').textContent = String(s.counts.MISSED);
      el('result-score').textContent = String(s.score);
      el('result-combo').textContent = String(s.maxCombo);
      // 結果画面でも曲を選び直せるよう、選択欄を「もう一度」の上へ移す。選んだ曲は「もう一度」で遊べる
      result.insertBefore(songPicker, el('retry-btn'));
      title.hidden = true;
      result.hidden = false;
      overlay.hidden = false;
    },
  };
}
