import {
  BROWSER_TABS, REVIEW_FILES, READER_PAGES, READER_CHAPTERS,
  ZOOM_LEVELS, INPUT_FIELDS, PRIORITY_LABELS,
} from "./content.js";
import { VIDEO_CHAPTERS, VIDEO_CHAPTER_SNAP_STRENGTH, VIDEO_FPS } from "./chapters.js";

export const APP_IDS = ["browser", "windows", "timer", "photo", "video", "music", "audio", "lights", "review", "reader", "map", "input"];
export const APP_INFO = {
  browser: { id: "browser", name: "ブラウザ", color: "#258bdf", icon: "globe" },
  windows: { id: "windows", name: "ウィンドウ", color: "#6387e6", icon: "panels-top-left" },
  timer: { id: "timer", name: "タイマー", color: "#ee8c38", icon: "timer" },
  photo: { id: "photo", name: "写真", color: "#df6588", icon: "image" },
  video: { id: "video", name: "動画", color: "#805fc8", icon: "clapperboard" },
  music: { id: "music", name: "音楽", color: "#e66f8d", icon: "music" },
  audio: { id: "audio", name: "オーディオ", color: "#b765d6", icon: "headphones" },
  lights: { id: "lights", name: "照明", color: "#dcaf40", icon: "sun" },
  review: { id: "review", name: "レビュー", color: "#69a780", icon: "git-compare" },
  reader: { id: "reader", name: "リーダー", color: "#d88b48", icon: "book-open" },
  map: { id: "map", name: "マップ", color: "#60a98b", icon: "map" },
  input: { id: "input", name: "入力", color: "#8090bd", icon: "list-check" },
};

const PHOTO_DEFAULTS = { exposure: 0, saturation: 100, temperature: 65 };
const PHOTO_BOUNDS = { exposure: [-30, 30], saturation: [0, 200], temperature: [20, 100] };
const PHOTO_PARAMETERS = Object.keys(PHOTO_DEFAULTS);
const LIGHT_DEFAULTS = { brightness: 70, temperature: 40 };
const LIGHT_BOUNDS = { brightness: [0, 100], temperature: [20, 65] };
const VIDEO_LAST_FRAME = 19037;
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const integer = (value, min, max, fallback) => finite(value) ? clamp(Math.round(value), min, max) : fallback;
const cycle = (values, value, delta = 1) => values[(values.indexOf(value) + delta + values.length) % values.length];
const nextIn = (value, count) => (value + 1) % count;
const nowOf = (action) => finite(action.now) ? action.now : 0;
const inputBounds = { rating: [0, 5], priority: [0, 3], quantity: [1, 12] };

export function initialApps() {
  return {
    browser: { tabIndex: 0, activeTab: 0 },
    windows: { index: 0 },
    timer: { minutes: 25, running: false, remaining: 1500, deadline: null },
    photo: { parameter: "exposure", ...PHOTO_DEFAULTS },
    video: { frame: 0, fps: VIDEO_FPS, duration: 634.599, mode: "fine", playing: false },
    music: { parameter: "rate", rate: 100, bpm: 96, playing: false },
    audio: { pan: 0, playing: false },
    lights: { parameter: "brightness", ...LIGHT_DEFAULTS, on: true },
    review: { file: 0, hunk: 0, expanded: [] },
    reader: { page: 0 },
    map: { zoom: 3 },
    input: { field: "rating", rating: 3, priority: 1, quantity: 1, confirmed: { rating: null, priority: null, quantity: null } },
  };
}

function elapsedTimer(timer, now) {
  if (!timer.running || !finite(timer.deadline)) return timer;
  const remaining = clamp((timer.deadline - now) / 1000, 0, 7200);
  if (remaining === timer.remaining) return timer;
  return { ...timer, remaining, running: remaining > 0, deadline: remaining > 0 ? timer.deadline : null };
}

function turn(state, id, delta, now) {
  if (!finite(delta)) return state;
  const d = Math.trunc(delta);
  if (!d) return state;
  switch (id) {
    case "browser": return { ...state, tabIndex: clamp(state.tabIndex + d, 0, BROWSER_TABS.length - 1) };
    case "windows": return { ...state, index: clamp(state.index + d, 0, APP_IDS.length - 1) };
    case "timer": {
      const current = elapsedTimer(state, now);
      const position = Math.ceil(current.remaining / 60);
      const nextPosition = clamp(position + d, 0, 120);
      const remaining = nextPosition === 0 ? 0 : clamp(current.remaining + (nextPosition - position) * 60, 0, 7200);
      // Before starting, rotation sets the duration. Once time has elapsed,
      // adjustment changes only the remaining time, retaining the reset point.
      const settingDuration = !current.running && current.remaining === current.minutes * 60;
      const minutes = settingDuration && nextPosition > 0 ? nextPosition : current.minutes;
      const running = current.running && remaining > 0;
      return { ...current, minutes, remaining, running, deadline: running ? now + remaining * 1000 : null };
    }
    case "photo": {
      const key = state.parameter;
      return { ...state, [key]: clamp(state[key] + d, ...PHOTO_BOUNDS[key]) };
    }
    case "video": {
      let frame = clamp(state.frame + d * (state.mode === "fine" ? 1 : VIDEO_FPS), 0, VIDEO_LAST_FRAME);
      if (state.mode === "coarse") {
        // Preserve fractional-second frames normally, but land exactly on a
        // chapter when its logical second is selected from either direction.
        const chapter = VIDEO_CHAPTERS.find((entry) => entry.time === Math.floor(frame / VIDEO_FPS));
        if (chapter) frame = chapter.frame;
      }
      return { ...state, frame, playing: false };
    }
    case "music": {
      const key = state.parameter;
      return { ...state, [key]: clamp(state[key] + d, ...(key === "rate" ? [50, 150] : [40, 200])) };
    }
    case "audio": return { ...state, pan: clamp(state.pan + d, -10, 10) };
    case "lights": {
      const key = state.parameter;
      return { ...state, [key]: clamp(state[key] + d, ...LIGHT_BOUNDS[key]) };
    }
    case "review": return { ...state, hunk: clamp(state.hunk + d, 0, REVIEW_FILES[state.file].hunks.length - 1) };
    case "reader": return { ...state, page: clamp(state.page + d, 0, READER_PAGES.length - 1) };
    case "map": return { ...state, zoom: clamp(state.zoom + d, 0, ZOOM_LEVELS.length - 1) };
    case "input": {
      const key = state.field;
      return { ...state, [key]: clamp(state[key] + d, ...inputBounds[key]) };
    }
    default: return state;
  }
}

function press(state, id, now) {
  switch (id) {
    case "browser": return { ...state, activeTab: state.tabIndex };
    case "timer": {
      const current = elapsedTimer(state, now);
      if (current.running) return { ...current, running: false, deadline: null };
      const remaining = current.remaining > 0 ? current.remaining : current.minutes * 60;
      return { ...current, remaining, running: true, deadline: now + remaining * 1000 };
    }
    case "photo": return { ...state, parameter: cycle(PHOTO_PARAMETERS, state.parameter) };
    case "video": return { ...state, mode: state.mode === "fine" ? "coarse" : "fine" };
    case "music": case "audio": return { ...state, playing: !state.playing };
    case "lights": return { ...state, parameter: state.parameter === "brightness" ? "temperature" : "brightness" };
    case "review": {
      const key = `${state.file}:${state.hunk}`;
      return { ...state, expanded: state.expanded.includes(key) ? state.expanded.filter((item) => item !== key) : [...state.expanded, key] };
    }
    case "reader": return { ...state, page: READER_CHAPTERS.find((chapter) => chapter.page > state.page)?.page ?? READER_CHAPTERS[0].page };
    case "map": return { ...state, zoom: 3 };
    case "input": return { ...state, confirmed: { ...state.confirmed, [state.field]: state[state.field] }, field: cycle(INPUT_FIELDS, state.field) };
    default: return state;
  }
}

function longPress(state, id) {
  switch (id) {
    case "browser": return { ...state, tabIndex: state.activeTab };
    case "timer": return { ...state, remaining: state.minutes * 60, running: false, deadline: null };
    case "photo": return { ...state, [state.parameter]: PHOTO_DEFAULTS[state.parameter] };
    case "video": return { ...state, frame: 0, playing: false };
    case "music": return { ...state, [state.parameter]: state.parameter === "rate" ? 100 : 96 };
    case "audio": return { ...state, pan: 0 };
    case "lights": return { ...state, ...LIGHT_DEFAULTS, on: true };
    case "review": return { ...state, file: nextIn(state.file, REVIEW_FILES.length), hunk: 0 };
    case "reader": return { ...state, page: [...READER_CHAPTERS].reverse().find((chapter) => chapter.page < state.page)?.page ?? READER_CHAPTERS.at(-1).page };
    case "map": return { ...state, zoom: 3 };
    case "input": return initialApps().input;
    default: return state;
  }
}

function set(state, id, key, value, now) {
  const numeric = (min, max) => ({ ...state, [key]: integer(value, min, max, state[key]) });
  const choice = (values) => values.includes(value) ? { ...state, [key]: value } : state;
  const boolean = () => typeof value === "boolean" ? { ...state, [key]: value } : state;
  switch (id) {
    case "browser":
      if (key === "tabIndex" || key === "activeTab") return numeric(0, BROWSER_TABS.length - 1);
      break;
    case "windows": if (key === "index") return numeric(0, APP_IDS.length - 1); break;
    case "timer":
      if (key === "minutes" && finite(value)) {
        const minutes = integer(value, 1, 120, state.minutes);
        return { ...state, minutes, remaining: minutes * 60, running: false, deadline: null };
      }
      if (key === "running" && typeof value === "boolean") {
        const current = elapsedTimer(state, now);
        if (current.running === value) return current;
        return value ? press(current, id, now) : { ...current, running: false, deadline: null };
      }
      if (key === "remaining" && finite(value)) {
        const remaining = clamp(value, 0, 7200);
        const running = state.running && remaining > 0;
        return { ...state, remaining, running, deadline: running ? now + remaining * 1000 : null };
      }
      break;
    case "photo":
      if (key === "parameter") return choice(PHOTO_PARAMETERS);
      if (Object.hasOwn(PHOTO_BOUNDS, key)) return numeric(...PHOTO_BOUNDS[key]);
      break;
    case "video":
      if (key === "frame") return numeric(0, VIDEO_LAST_FRAME);
      if (key === "mode") return choice(["fine", "coarse"]);
      if (key === "playing") return boolean();
      break;
    case "music":
      if (key === "parameter") return choice(["rate", "bpm"]);
      if (key === "rate") return numeric(50, 150);
      if (key === "bpm") return numeric(40, 200);
      if (key === "playing") return boolean();
      break;
    case "audio":
      if (key === "pan") return numeric(-10, 10);
      if (key === "playing") return boolean();
      break;
    case "lights":
      if (key === "parameter") return choice(Object.keys(LIGHT_DEFAULTS));
      if (Object.hasOwn(LIGHT_BOUNDS, key)) return numeric(...LIGHT_BOUNDS[key]);
      if (key === "on") return boolean();
      break;
    case "review":
      if (key === "file" && finite(value)) return { ...state, file: integer(value, 0, REVIEW_FILES.length - 1, state.file), hunk: 0 };
      if (key === "hunk") return numeric(0, REVIEW_FILES[state.file].hunks.length - 1);
      break;
    case "reader": if (key === "page") return numeric(0, READER_PAGES.length - 1); break;
    case "map": if (key === "zoom") return numeric(0, ZOOM_LEVELS.length - 1); break;
    case "input":
      if (key === "field") return choice(INPUT_FIELDS);
      if (Object.hasOwn(inputBounds, key)) return numeric(...inputBounds[key]);
      break;
  }
  return state;
}

/** All device, keyboard and direct UI changes share this immutable state path. */
export function reduceApps(apps, action) {
  if (!action || typeof action !== "object") return apps;
  const now = nowOf(action);
  if (action.type === "tick") {
    if (!finite(action.now)) return apps;
    const timer = elapsedTimer(apps.timer, now);
    return timer === apps.timer ? apps : { ...apps, timer };
  }
  const id = action.app;
  if (!APP_IDS.includes(id)) return apps;
  const current = apps[id];
  let next = current;
  if (action.type === "turn") next = turn(current, id, action.delta, now);
  else if (action.type === "press") next = press(current, id, now);
  else if (action.type === "longPress") next = longPress(current, id);
  else if (action.type === "set") next = set(current, id, action.key, action.value, now);
  return next === current ? apps : { ...apps, [id]: next };
}

export function getControl(apps, id) {
  if (!APP_IDS.includes(id)) throw new Error(`Unknown app: ${id}`);
  const s = apps[id];
  const base = { key: id, label: APP_INFO[id].name, value: 0, min: 0, max: 1, width: 12, strength: 0.45, detents: [], favorites: [], valueText: "", hint: "回して選択", pressHint: "選択", longPressHint: "" };
  let control;
  switch (id) {
    case "browser": control = { key: "browser:tab", label: "タブ", value: s.tabIndex, max: BROWSER_TABS.length - 1, width: 24, valueText: BROWSER_TABS[s.tabIndex].title, pressHint: "タブを開く", longPressHint: "開いているタブへ戻る" }; break;
    case "windows": control = { key: "windows:app", label: "アプリ", value: s.index, max: APP_IDS.length - 1, width: 18, favorites: ["photo", "timer", "music"].map((favorite) => APP_IDS.indexOf(favorite)), valueText: APP_INFO[APP_IDS[s.index]].name, pressHint: "アプリを開く" }; break;
    case "timer": control = { key: "timer:minutes", label: "残り時間", value: Math.ceil(s.remaining / 60), min: 0, max: 120, width: 4, strength: 0.5, detents: Array.from({ length: 25 }, (_, i) => i * 5), valueText: `${Math.ceil(s.remaining / 60)} 分`, hint: "1目盛り1分 · 5分ごとに吸着", pressHint: s.running ? "一時停止" : "開始", longPressHint: "設定時間に戻す" }; break;
    case "photo": {
      const [min, max] = PHOTO_BOUNDS[s.parameter];
      const label = { exposure: "露出", saturation: "彩度", temperature: "色温度" }[s.parameter];
      const valueText = s.parameter === "exposure" ? `${s.exposure > 0 ? "+" : ""}${(s.exposure / 10).toFixed(1)} EV` : s.parameter === "saturation" ? `${s.saturation}%` : `${s.temperature * 100} K`;
      control = { key: `photo:${s.parameter}`, label, value: s[s.parameter], min, max, width: 5, detents: [PHOTO_DEFAULTS[s.parameter]], valueText, hint: "回して補正 · 標準値に吸着", pressHint: "次の補正項目", longPressHint: "この項目をリセット" };
      break;
    }
    case "video": {
      const fine = s.mode === "fine";
      // Playback leaves the hardware's physical position independent of its
      // moving playhead. Enable chapter strength only at an exact paused frame.
      const atChapter = !s.playing && VIDEO_CHAPTERS.some((chapter) => chapter.frame === s.frame);
      control = { key: `video:${s.mode}`, label: fine ? "フレーム" : "秒", value: fine ? s.frame : Math.floor(s.frame / VIDEO_FPS), max: fine ? VIDEO_LAST_FRAME : Math.floor(VIDEO_LAST_FRAME / VIDEO_FPS), width: fine ? 3 : 12, strength: fine ? 0.22 : 0.48, favorites: atChapter ? VIDEO_CHAPTERS.map((chapter) => fine ? chapter.frame : chapter.time) : [], favoriteStrength: VIDEO_CHAPTER_SNAP_STRENGTH, valueText: `${s.frame} f · ${(s.frame / s.fps).toFixed(2)} s`, hint: fine ? "1目盛り1フレーム · 章の先頭に強く吸着" : "1目盛り1秒 · 章の先頭に強く吸着", pressHint: fine ? "1秒単位に切替" : "1フレーム単位に切替", longPressHint: "先頭へ戻る" };
      break;
    }
    case "music": control = { key: `music:${s.parameter}`, label: s.parameter === "rate" ? "再生速度" : "テンポ", value: s[s.parameter], min: s.parameter === "rate" ? 50 : 40, max: s.parameter === "rate" ? 150 : 200, width: 5, strength: 0.4, detents: s.parameter === "rate" ? [100] : [], valueText: s.parameter === "rate" ? `${(s.rate / 100).toFixed(2)}×` : `${s.bpm} BPM`, hint: s.parameter === "rate" ? "1%ずつ調整 · 等速に吸着" : "1目盛り1 BPM", pressHint: s.playing ? "停止" : "再生", longPressHint: "標準値に戻す" }; break;
    case "audio": control = { key: "audio:pan", label: "左右の定位", value: s.pan, min: -10, max: 10, width: 9, strength: 0.6, detents: [0], valueText: s.pan === 0 ? "中央" : `${s.pan < 0 ? "L" : "R"} ${Math.abs(s.pan) * 10}%`, hint: "左から右へ · 中央に吸着", pressHint: s.playing ? "試聴を停止" : "試聴", longPressHint: "中央に戻す" }; break;
    case "lights": {
      const [min, max] = LIGHT_BOUNDS[s.parameter];
      control = { key: `lights:${s.parameter}`, label: s.parameter === "brightness" ? "明るさ" : "色温度", value: s[s.parameter], min, max, width: 4, strength: 0.25, detents: [LIGHT_DEFAULTS[s.parameter]], valueText: s.parameter === "brightness" ? `${s.brightness}%` : `${s.temperature * 100} K`, hint: s.parameter === "brightness" ? "暗く ← → 明るく · 70%に吸着" : "暖かい ← → 白い · 4000 Kに吸着", pressHint: "調整項目を切替", longPressHint: "初期設定に戻す" };
      break;
    }
    case "review": control = { key: `review:${s.file}`, label: "変更箇所", value: s.hunk, max: REVIEW_FILES[s.file].hunks.length - 1, width: 24, strength: 0.55, valueText: `${s.hunk + 1} / ${REVIEW_FILES[s.file].hunks.length}`, hint: "回して変更箇所を移動", pressHint: s.expanded.includes(`${s.file}:${s.hunk}`) ? "差分を閉じる" : "差分を開く", longPressHint: "次のファイル" }; break;
    case "reader": control = { key: "reader:page", label: "ページ", value: s.page, max: READER_PAGES.length - 1, width: 24, favorites: READER_CHAPTERS.map((chapter) => chapter.page), valueText: `${s.page + 1} / ${READER_PAGES.length}`, hint: "1目盛り1ページ · 章の先頭は強いクリック", pressHint: "次の章", longPressHint: "前の章" }; break;
    case "map": control = { key: "map:zoom", label: "拡大率", value: s.zoom, max: ZOOM_LEVELS.length - 1, width: 18, strength: 0.5, favorites: [3], valueText: `${ZOOM_LEVELS[s.zoom]}%`, hint: "回して拡大・縮小 · 100%は強いクリック", pressHint: "100%に戻す", longPressHint: "100%に戻す" }; break;
    case "input": {
      const [min, max] = inputBounds[s.field];
      control = { key: `input:${s.field}`, label: { rating: "評価", priority: "優先度", quantity: "数量" }[s.field], value: s[s.field], min, max, width: s.field === "quantity" ? 15 : 30, strength: 0.6, valueText: s.field === "rating" ? `${s.rating} / 5` : s.field === "priority" ? PRIORITY_LABELS[s.priority] : `${s.quantity} 個`, hint: "回して選択 · 押して確定", pressHint: "確定して次の項目", longPressHint: "入力を初期化" };
      break;
    }
  }
  return { ...base, ...control };
}

export function getAppValue(apps, id) {
  return getControl(apps, id).value;
}
