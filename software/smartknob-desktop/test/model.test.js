import test from "node:test";
import assert from "node:assert/strict";
import { APP_IDS, APP_INFO, initialApps, reduceApps, getControl, getAppValue } from "../src/model.js";
import { BROWSER_TABS, REVIEW_FILES, READER_PAGES, READER_CHAPTERS, ZOOM_LEVELS } from "../src/content.js";
import { VIDEO_CHAPTERS, VIDEO_CHAPTER_SNAP_STRENGTH, VIDEO_FPS } from "../src/chapters.js";
import { DEMO } from "../../smartknob-demo/src/player.js";
import { VideoControl } from "../../smartknob-demo/src/video.js";

const send = (apps, app, type, fields = {}) => reduceApps(apps, { app, type, now: 1000, ...fields });
const set = (apps, app, key, value) => send(apps, app, "set", { key, value });
function freeze(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

test("twelve independent app states have bounded controls and immutable transitions", () => {
  assert.equal(APP_IDS.length, 12);
  assert.equal(new Set(APP_IDS).size, 12);
  const original = freeze(initialApps());
  const variants = [
    ...APP_IDS.map((app) => [app, null, null]),
    ["photo", "parameter", "saturation"],
    ["photo", "parameter", "temperature"],
    ["video", "mode", "coarse"],
    ["music", "parameter", "bpm"],
    ["lights", "parameter", "temperature"],
    ["review", "file", 1],
    ["review", "file", 2],
    ["input", "field", "priority"],
    ["input", "field", "quantity"],
  ];
  for (const [app, key, value] of variants) {
    const apps = key ? set(original, app, key, value) : original;
    const control = getControl(apps, app);
    assert.equal(APP_INFO[app].id, app);
    assert.equal(getAppValue(apps, app), control.value);
    assert.ok(control.min <= control.value && control.value <= control.max, app);
    assert.ok(Number.isInteger(control.value), app);
    assert.ok(control.width > 0 && control.strength >= 0 && control.strength <= 1, app);
    const upper = send(apps, app, "turn", { delta: 100000 });
    assert.equal(getControl(upper, app).value, control.max, app);
    const lower = send(apps, app, "turn", { delta: -100000 });
    assert.equal(getControl(lower, app).value, control.min, app);
    for (const other of APP_IDS.filter((id) => id !== app)) {
      assert.equal(upper[other], apps[other], `${app} changed ${other}`);
      assert.equal(lower[other], apps[other], `${app} changed ${other}`);
    }
  }
  assert.deepEqual(original, initialApps());
});

test("direct numeric UI changes clamp every editable numeric field and reject invalid values", () => {
  const fields = {
    browser: ["tabIndex", "activeTab"], windows: ["index"], timer: ["minutes", "remaining"],
    photo: ["exposure", "saturation", "temperature"], video: ["frame"], music: ["rate", "bpm"],
    audio: ["pan"], lights: ["brightness", "temperature"], review: ["file", "hunk"],
    reader: ["page"], map: ["zoom"], input: ["rating", "priority", "quantity"],
  };
  const expected = {
    browser: [[0, 3], [0, 3]], windows: [[0, 11]], timer: [[1, 120], [0, 7200]],
    photo: [[-30, 30], [0, 200], [20, 100]], video: [[0, 19037]], music: [[50, 150], [40, 200]],
    audio: [[-10, 10]], lights: [[0, 100], [20, 65]], review: [[0, 2], [0, 2]],
    reader: [[0, 7]], map: [[0, 8]], input: [[0, 5], [0, 3], [1, 12]],
  };
  const initial = freeze(initialApps());
  for (const [app, keys] of Object.entries(fields)) {
    keys.forEach((key, index) => {
      const [min, max] = expected[app][index];
      assert.equal(set(initial, app, key, -1e9)[app][key], min, `${app}.${key}`);
      assert.equal(set(initial, app, key, 1e9)[app][key], max, `${app}.${key}`);
      for (const invalid of [NaN, Infinity, -Infinity, "10", undefined, null])
        assert.deepEqual(set(initial, app, key, invalid), initial, `${app}.${key}`);
    });
  }
  for (const app of APP_IDS) {
    assert.equal(set(initial, app, "unsupported", 10), initial);
    assert.equal(send(initial, app, "turn", { delta: Infinity }), initial);
  }
  assert.equal(set(initial, "photo", "parameter", "invalid"), initial);
  assert.equal(set(initial, "video", "mode", "invalid"), initial);
  assert.equal(set(initial, "music", "playing", "false"), initial);
});

test("browser selection is a preview until press commits the active tab", () => {
  const initial = initialApps();
  const preview = send(initial, "browser", "turn", { delta: 2 });
  assert.deepEqual(preview.browser, { tabIndex: 2, activeTab: 0 });
  assert.deepEqual(send(preview, "browser", "longPress").browser, initial.browser);
  const committed = send(preview, "browser", "press");
  assert.deepEqual(committed.browser, { tabIndex: 2, activeTab: 2 });
  assert.equal(send(initial, "windows", "press"), initial);
});

test("timer uses elapsed milliseconds across app focus changes and preserves paused time", () => {
  let apps = set(initialApps(), "timer", "minutes", 2);
  apps = send(apps, "timer", "press", { now: 1000 });
  assert.equal(apps.timer.deadline, 121000);
  apps = send(apps, "photo", "tick", { now: 12650 });
  assert.equal(apps.timer.remaining, 108.35);
  assert.equal(apps.timer.running, true);
  apps = send(apps, "timer", "press", { now: 20000 });
  assert.equal(apps.timer.remaining, 101);
  assert.equal(apps.timer.running, false);
  assert.equal(apps.timer.deadline, null);
  const paused = apps;
  apps = send(apps, "reader", "tick", { now: 90000 });
  assert.equal(apps, paused);
  apps = send(apps, "timer", "press", { now: 90000 });
  assert.equal(apps.timer.deadline, 191000);
  apps = send(apps, "map", "tick", { now: 191500 });
  assert.deepEqual(apps.timer, { minutes: 2, running: false, remaining: 0, deadline: null });
  apps = send(apps, "timer", "press", { now: 200000 });
  assert.equal(apps.timer.remaining, 120);
  assert.equal(apps.timer.deadline, 320000);
  apps = send(apps, "timer", "longPress");
  assert.deepEqual(apps.timer, { minutes: 2, running: false, remaining: 120, deadline: null });
});

test("timer rotation adds whole minutes without discarding elapsed time", () => {
  let apps = send(initialApps(), "timer", "press", { now: 1000 });
  apps = send(apps, "timer", "turn", { now: 31000, delta: 1 });
  assert.equal(apps.timer.minutes, 25);
  assert.equal(apps.timer.remaining, 1530);
  assert.equal(apps.timer.deadline, 1561000);
  apps = send(apps, "timer", "longPress");
  assert.deepEqual(apps.timer, { minutes: 25, remaining: 1500, running: false, deadline: null });
  apps = set(apps, "timer", "minutes", 5);
  assert.deepEqual(apps.timer, { minutes: 5, remaining: 300, running: false, deadline: null });
});

test("timer control follows remaining minutes down to zero and rotations use that current position", () => {
  let apps = send(initialApps(), "timer", "press", { now: 1000 });
  assert.equal(getControl(apps, "timer").value, 25);
  apps = send(apps, "reader", "tick", { now: 61000 });
  assert.equal(getControl(apps, "timer").value, 24);
  assert.equal(getControl(apps, "timer").valueText, "24 分");
  apps = send(apps, "map", "tick", { now: 1466000 });
  assert.equal(apps.timer.remaining, 35);
  assert.equal(getControl(apps, "timer").value, 1);
  apps = send(apps, "timer", "turn", { now: 1466000, delta: 1 });
  assert.equal(apps.timer.remaining, 95);
  assert.equal(getControl(apps, "timer").value, 2);
  assert.equal(apps.timer.deadline, 1561000);
  assert.equal(apps.timer.minutes, 25);
  apps = send(apps, "timer", "turn", { now: 1466000, delta: -999 });
  assert.equal(apps.timer.remaining, 0);
  assert.equal(apps.timer.running, false);
  assert.equal(apps.timer.deadline, null);
  assert.equal(getControl(apps, "timer").value, 0);
  assert.equal(getControl(apps, "timer").min, 0);
  assert.equal(getControl(apps, "timer").valueText, "0 分");
  apps = send(apps, "timer", "turn", { delta: 999 });
  assert.equal(apps.timer.remaining, 7200);
  assert.equal(getControl(apps, "timer").value, 120);
  assert.equal(apps.timer.minutes, 25);
  apps = send(apps, "timer", "longPress");
  assert.equal(apps.timer.remaining, 1500);
  apps = send(apps, "timer", "turn", { delta: 5 });
  assert.equal(apps.timer.minutes, 30);
  assert.equal(apps.timer.remaining, 1800);
  apps = send(apps, "timer", "press", { now: 2000000 });
  apps = send(apps, "photo", "tick", { now: 3800000 });
  assert.equal(getControl(apps, "timer").value, 0);
  assert.equal(apps.timer.running, false);
});

test("video press switches frame resolution without changing time or toggling playback", () => {
  let apps = set(initialApps(), "video", "frame", 77);
  apps = set(apps, "video", "playing", true);
  const fine = getControl(apps, "video");
  apps = send(apps, "video", "press");
  const coarse = getControl(apps, "video");
  assert.equal(apps.video.frame, 77);
  assert.equal(apps.video.playing, true);
  assert.equal(coarse.value, 2);
  assert.equal(coarse.max, 634);
  assert.notEqual(coarse.key, fine.key);
  apps = send(apps, "video", "turn", { delta: 2 });
  assert.equal(apps.video.frame, 137);
  assert.equal(apps.video.playing, false);
  apps = send(apps, "video", "press");
  apps = send(apps, "video", "turn", { delta: -1 });
  assert.equal(apps.video.frame, 136);
  apps = send(apps, "video", "longPress");
  assert.equal(apps.video.frame, 0);
});

test("video chapters reuse the demo landmarks with stronger exact-frame favorites in both modes", () => {
  assert.deepEqual(VIDEO_CHAPTERS.map(({ time, label }) => ({ time, label })), DEMO.scenes);
  assert.ok(VIDEO_CHAPTER_SNAP_STRENGTH > new VideoControl(null, null, null).strength);
  assert.ok(VIDEO_CHAPTER_SNAP_STRENGTH <= 1);
  for (const chapter of VIDEO_CHAPTERS) {
    assert.equal(chapter.frame, chapter.time * VIDEO_FPS);
    for (const mode of ["fine", "coarse"]) {
      let apps = set(initialApps(), "video", "mode", mode);
      apps = set(apps, "video", "frame", chapter.frame);
      const control = getControl(apps, "video");
      assert.ok(control.favorites.includes(control.value));
      assert.deepEqual(control.detents, [], "sparse detents would disable the ordinary frame/second clicks");
      assert.equal(control.favoriteStrength, VIDEO_CHAPTER_SNAP_STRENGTH);
      apps = set(apps, "video", "frame", chapter.frame + 1);
      assert.deepEqual(getControl(apps, "video").favorites, [], "a coarse chapter second is not necessarily the chapter frame");
      apps = set(apps, "video", "frame", chapter.frame);
      apps = set(apps, "video", "playing", true);
      assert.deepEqual(getControl(apps, "video").favorites, [], "playback must not strengthen an unrelated physical knob position");
    }
  }
});

test("coarse turns land on exact chapter frames even when the previous frame has a subsecond remainder", () => {
  for (const chapter of VIDEO_CHAPTERS.slice(1)) {
    for (const direction of [-1, 1]) {
      let apps = set(initialApps(), "video", "mode", "coarse");
      apps = set(apps, "video", "frame", chapter.frame - direction * VIDEO_FPS + 17);
      apps = send(apps, "video", "turn", { delta: direction });
      assert.equal(apps.video.frame, chapter.frame, `${chapter.label}, direction ${direction}`);
      assert.equal(getControl(apps, "video").value, chapter.time);
      assert.ok(getControl(apps, "video").favorites.includes(chapter.time));
      apps = send(apps, "video", "turn", { delta: direction });
      assert.equal(apps.video.frame, chapter.frame + direction * VIDEO_FPS);
      assert.deepEqual(getControl(apps, "video").favorites, []);
    }
  }
  let ordinary = set(initialApps(), "video", "mode", "coarse");
  ordinary = set(ordinary, "video", "frame", 77);
  ordinary = send(ordinary, "video", "turn", { delta: 2 });
  assert.equal(ordinary.video.frame, 137, "nonchapter steps retain their frame remainder");
});

test("parameter cycling and resets retain other edited values", () => {
  let apps = set(initialApps(), "photo", "exposure", 12);
  apps = set(apps, "photo", "saturation", 145);
  apps = send(apps, "photo", "press");
  assert.equal(apps.photo.parameter, "saturation");
  apps = send(apps, "photo", "longPress");
  assert.equal(apps.photo.saturation, 100);
  assert.equal(apps.photo.exposure, 12);
  apps = send(apps, "photo", "press");
  apps = send(apps, "photo", "press");
  assert.equal(apps.photo.parameter, "exposure");
  apps = send(apps, "lights", "press");
  assert.equal(apps.lights.parameter, "temperature");
  apps = set(apps, "lights", "temperature", 20);
  apps = set(apps, "lights", "on", false);
  apps = send(apps, "lights", "longPress");
  assert.equal(apps.lights.temperature, 40);
  assert.equal(apps.lights.on, true);
  for (const app of ["audio", "music"]) {
    apps = send(apps, app, "press");
    assert.equal(apps[app].playing, true);
    apps = send(apps, app, "press");
    assert.equal(apps[app].playing, false);
  }
  apps = set(apps, "audio", "pan", -7);
  apps = send(apps, "audio", "longPress");
  assert.equal(apps.audio.pan, 0);
  apps = set(apps, "music", "parameter", "bpm");
  apps = set(apps, "music", "bpm", 180);
  apps = send(apps, "music", "longPress");
  assert.equal(apps.music.bpm, 96);
});

test("review expansion is per hunk and file changes use that file's own bounds", () => {
  let apps = send(initialApps(), "review", "press");
  apps = send(apps, "review", "turn", { delta: 1 });
  apps = send(apps, "review", "press");
  assert.deepEqual(apps.review.expanded, ["0:0", "0:1"]);
  apps = send(apps, "review", "press");
  assert.deepEqual(apps.review.expanded, ["0:0"]);
  apps = send(apps, "review", "longPress");
  assert.equal(apps.review.file, 1);
  assert.equal(apps.review.hunk, 0);
  apps = set(apps, "review", "hunk", 999);
  assert.equal(apps.review.hunk, REVIEW_FILES[1].hunks.length - 1);
  assert.deepEqual(apps.review.expanded, ["0:0"]);
});

test("chapter navigation wraps at book ends and map reset returns to 100 percent", () => {
  let apps = initialApps();
  for (const page of [3, 6, 0]) {
    apps = send(apps, "reader", "press");
    assert.equal(apps.reader.page, page);
  }
  apps = send(apps, "reader", "longPress");
  assert.equal(apps.reader.page, 6);
  apps = set(apps, "reader", "page", 5);
  apps = send(apps, "reader", "longPress");
  assert.equal(apps.reader.page, 3);
  apps = set(apps, "map", "zoom", 8);
  apps = send(apps, "map", "press");
  assert.equal(ZOOM_LEVELS[apps.map.zoom], 100);
});

test("input press commits only the current field before advancing to the next one", () => {
  const initial = freeze(initialApps());
  let apps = set(initial, "input", "rating", 5);
  assert.equal(apps.input.confirmed.rating, null);
  apps = send(apps, "input", "press");
  assert.equal(apps.input.field, "priority");
  assert.deepEqual(apps.input.confirmed, { rating: 5, priority: null, quantity: null });
  apps = send(apps, "input", "press");
  apps = set(apps, "input", "quantity", 8);
  apps = send(apps, "input", "press");
  assert.equal(apps.input.field, "rating");
  assert.deepEqual(apps.input.confirmed, { rating: 5, priority: 1, quantity: 8 });
  apps = send(apps, "input", "longPress");
  assert.deepEqual(apps.input, initial.input);
});

test("magnetic stops and stronger regular clicks stay distinct and match content boundaries", () => {
  const apps = initialApps();
  const timer = getControl(apps, "timer");
  assert.deepEqual(timer.detents, Array.from({ length: 25 }, (_, i) => i * 5));
  assert.ok(timer.detents.length > 5, "hardware can choose its nearest five without losing model landmarks");
  const windows = getControl(apps, "windows");
  assert.deepEqual(windows.detents, []);
  assert.deepEqual(new Set(windows.favorites.map((index) => APP_IDS[index])), new Set(["photo", "timer", "music"]));
  const reader = getControl(apps, "reader");
  assert.deepEqual(reader.detents, []);
  assert.deepEqual(reader.favorites, READER_CHAPTERS.map((chapter) => chapter.page));
  assert.deepEqual(getControl(apps, "audio").detents, [0]);
  assert.deepEqual(getControl(apps, "music").detents, [100]);
  assert.deepEqual(getControl(apps, "lights").detents, [70]);
  assert.deepEqual(getControl(set(apps, "lights", "parameter", "temperature"), "lights").detents, [40]);
  assert.deepEqual(getControl(apps, "map").detents, []);
  assert.deepEqual(getControl(apps, "map").favorites, [3]);
  assert.equal(ZOOM_LEVELS[getControl(apps, "map").favorites[0]], 100);
  for (const id of APP_IDS) {
    const control = getControl(apps, id);
    for (const value of [...control.detents, ...control.favorites])
      assert.ok(Number.isInteger(value) && value >= control.min && value <= control.max, id);
  }
  assert.equal(BROWSER_TABS.length, 4);
  assert.equal(REVIEW_FILES.length, 3);
  assert.equal(READER_PAGES.length, 8);
  assert.ok(REVIEW_FILES.every((file) => file.hunks.length >= 2 && file.hunks.every((hunk) => hunk.lines.length)));
});
