import test from "node:test";
import assert from "node:assert/strict";
import { DEMO, VideoPlayer } from "../src/player.js";
import { VideoControl } from "../src/video.js";

class FakeVideo extends EventTarget {
  duration = NaN;
  paused = true;
  muted = false;
  seeking = false;
  time = 0;
  assignments = [];
  loads = 0;
  plays = 0;
  pauses = 0;
  playError = null;

  get currentTime() {
    return this.time;
  }
  set currentTime(value) {
    this.assignments.push(value);
    this.time = value;
    this.seeking = true;
  }
  load() {
    this.loads++;
  }
  metadata(duration = 600) {
    this.duration = duration;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
  finishSeek() {
    this.seeking = false;
    this.dispatchEvent(new Event("seeked"));
  }
  async play() {
    this.plays++;
    if (this.playError) throw this.playError;
    this.paused = false;
  }
  pause() {
    this.pauses++;
    this.paused = true;
  }
}

function fixture() {
  const video = new FakeVideo();
  const errors = [];
  const player = new VideoPlayer((message) => errors.push(message));
  player.mount(video);
  return { video, player, errors };
}

test("local player waits for finite metadata and loads the bundled source only once", async () => {
  const { video, player } = fixture();
  assert.equal(video.src, DEMO.src);
  player.mount(video);
  assert.equal(video.loads, 1);
  assert.equal(player.snapshot(), null);
  player.seek(83);
  await player.play();
  assert.deepEqual(video.assignments, []);
  assert.equal(video.plays, 0);
  for (const invalid of [NaN, Infinity, 0, -1]) {
    video.metadata(invalid);
    assert.equal(player.snapshot(), null);
  }
  video.metadata();
  assert.deepEqual(player.snapshot(), {
    id: DEMO.id,
    time: 0,
    duration: 600,
    paused: true,
    muted: false,
    canShuttle: true,
    title: DEMO.title,
  });
});

test("seeking works before first playback and preserves paused or playing state", async () => {
  const { video, player } = fixture();
  video.metadata();
  player.seek(83);
  assert.equal(video.currentTime, 83);
  assert.equal(video.paused, true);
  assert.equal(video.plays, 0);
  video.finishSeek();
  await player.play();
  player.seek(296);
  assert.equal(video.currentTime, 296);
  assert.equal(video.paused, false);
  assert.equal(video.plays, 1);
  assert.equal(video.pauses, 0);
  player.pause();
  assert.equal(player.snapshot().paused, true);
  player.toggleMute();
  assert.equal(player.snapshot().muted, true);
  player.toggleMute();
  assert.equal(player.snapshot().muted, false);
});

test("seek clamps to the video bounds and ignores nonfinite or negligible requests", () => {
  const { video, player } = fixture();
  video.metadata();
  player.seek(83);
  video.finishSeek();
  for (const invalid of [NaN, Infinity, -Infinity, undefined, "150"])
    player.seek(invalid);
  player.seek(83.0005);
  assert.deepEqual(video.assignments, [83]);
  player.seek(-20);
  assert.equal(video.currentTime, 0);
  video.finishSeek();
  player.seek(1000);
  assert.equal(video.currentTime, 600);
  video.finishSeek();
  player.seek(600);
  assert.deepEqual(video.assignments, [83, 0, 600]);
});

test("decoder seeks are serialized and only the latest requested frame follows seeked", () => {
  const { video, player } = fixture();
  video.metadata();
  player.seek(30);
  player.seek(83);
  player.seek(150);
  player.seek(296);
  assert.deepEqual(video.assignments, [30]);
  video.finishSeek();
  assert.deepEqual(video.assignments, [30, 296]);
  assert.equal(video.seeking, true);
  video.finishSeek();
  assert.deepEqual(video.assignments, [30, 296]);
});

test("cancelSeek discards a queued destination without preventing later deliberate seeks", () => {
  const { video, player } = fixture();
  video.metadata();
  player.seek(30);
  player.seek(450);
  player.cancelSeek();
  video.finishSeek();
  assert.deepEqual(video.assignments, [30]);
  player.seek(83);
  video.finishSeek();
  assert.deepEqual(video.assignments, [30, 83]);
});

test("a media error invalidates readiness and cancels queued decoder work", () => {
  const { video, player, errors } = fixture();
  video.metadata();
  player.seek(30);
  player.seek(450);
  video.dispatchEvent(new Event("error"));
  assert.equal(player.snapshot(), null);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /big-buck-bunny\.mp4/);
  video.finishSeek();
  player.seek(83);
  assert.deepEqual(video.assignments, [30]);
});

test("play rejection is reported, but intentional cancellation is silent", async () => {
  const { video, player, errors } = fixture();
  video.metadata();
  video.playError = new DOMException("Interrupted by pause", "AbortError");
  await player.play();
  assert.deepEqual(errors, []);
  video.playError = new DOMException("User gesture required", "NotAllowedError");
  await player.play();
  assert.equal(errors.length, 1);
  assert.equal(video.paused, true);
  video.playError = null;
  await player.play();
  assert.equal(video.paused, false);
});

test("centering the shuttle cancels the queued decoder seek instead of jumping after stopping", () => {
  const { video, player } = fixture();
  video.metadata();
  video.time = 80;
  const control = new VideoControl(player, () => {}, () => {});
  control.enabled = true;
  control.poll();
  control.setControl("speed");
  control.setSpeed(8);
  const start = control.lastTick;
  control.tick(start + 100);
  control.tick(start + 200);
  assert.equal(video.assignments.length, 1);
  const stoppedTime = video.currentTime;
  control.setSpeed(0);
  video.finishSeek();
  control.tick(start + 300);
  video.finishSeek();
  assert.equal(video.currentTime, stoppedTime);
  assert.equal(video.assignments.length, 1);
  assert.equal(control.speed, 0);
  control.stop();
});

test("automatic shuttle stop at either endpoint still completes the final queued seek", () => {
  for (const [initialTime, speed, endpoint] of [[599.7, 2, 600], [0.3, -2, 0]]) {
    const { video, player } = fixture();
    video.metadata();
    video.time = initialTime;
    const control = new VideoControl(player, () => {}, () => {});
    control.enabled = true;
    control.poll();
    control.setControl("speed");
    control.setSpeed(speed);
    const start = control.lastTick;
    control.tick(start + 100);
    control.tick(start + 200);
    assert.equal(control.speed, 0);
    assert.equal(video.assignments.length, 1);
    assert.notEqual(video.currentTime, endpoint);
    video.finishSeek();
    assert.equal(video.currentTime, endpoint);
    assert.equal(video.assignments.length, 2);
    video.finishSeek();
    control.tick(start + 300);
    assert.equal(video.assignments.length, 2);
    control.stop();
  }
});
