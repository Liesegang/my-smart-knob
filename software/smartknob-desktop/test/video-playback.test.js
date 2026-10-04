import test from 'node:test';
import assert from 'node:assert/strict';
import { VideoPlayback } from '../src/apps/videoPlayback.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class NativeVideo {
  constructor() {
    this.readyState = 1;
    this.seeking = false;
    this.paused = true;
    this.duration = 634.599;
    this.time = 0;
    this.seeks = [];
    this.plays = [];
  }
  get currentTime() { return this.time; }
  set currentTime(value) {
    this.time = value;
    this.seeks.push(value);
    this.seeking = true;
  }
  pause() { this.paused = true; }
  play() {
    this.paused = false;
    const request = deferred();
    this.plays.push({ time: this.time, ...request });
    return request.promise;
  }
  finishSeek(playback) { this.seeking = false; playback.flush(); }
}

test('play waits for the newest requested seek rather than discarding it', async () => {
  const video = new NativeVideo();
  const playback = new VideoPlayback(video);
  playback.seek(10);
  playback.seek(20);
  playback.seek(30);
  playback.setPlaying(true);
  assert.deepEqual(video.seeks, [10]);
  assert.equal(video.plays.length, 0);
  video.finishSeek(playback);
  assert.deepEqual(video.seeks, [10, 30]);
  assert.equal(video.plays.length, 0);
  video.finishSeek(playback);
  assert.deepEqual(video.plays.map((request) => request.time), [30]);
  video.plays[0].resolve();
  await Promise.resolve();
});

test('pause samples the live native position instead of an older timeupdate frame', () => {
  const video = new NativeVideo();
  const playback = new VideoPlayback(video);
  video.time = 7.244; // Last model timeupdate can still be at 7.0 seconds.
  playback.playing = true;
  video.paused = false;
  const frame = playback.pauseAtCurrentFrame(30);
  assert.equal(frame, 217);
  assert.equal(video.paused, true);
  assert.equal(playback.playing, false);
  assert.equal(video.currentTime, 217 / 30);
});

test('pause during a queued seek keeps the latest requested position', () => {
  const video = new NativeVideo();
  const playback = new VideoPlayback(video);
  playback.seek(10);
  playback.seek(20);
  playback.setPlaying(true);
  assert.equal(playback.pauseAtCurrentFrame(30), 600);
  video.finishSeek(playback);
  video.finishSeek(playback);
  assert.deepEqual(video.seeks, [10, 20]);
  assert.equal(video.plays.length, 0);
});

test('an old rejected play cannot stop a newer playback request', async () => {
  for (const name of ['AbortError', 'NotAllowedError']) {
    const video = new NativeVideo();
    const errors = [];
    const stopped = [];
    const playback = new VideoPlayback(video, { onError: (error) => errors.push(error), onStopped: () => stopped.push(true) });
    playback.setPlaying(true);
    playback.setPlaying(false);
    playback.setPlaying(true);
    video.plays[0].reject(Object.assign(new Error('old request'), { name }));
    await Promise.resolve();
    assert.equal(playback.playing, true);
    assert.equal(video.paused, false);
    assert.equal(errors.length, 0);
    assert.equal(stopped.length, 0);
    video.plays[1].resolve();
    await Promise.resolve();
  }
});

test('current playback failures are reported, but callbacks end when a window closes', async () => {
  const video = new NativeVideo();
  const errors = [];
  let stopped = 0;
  const playback = new VideoPlayback(video, { onError: (error) => errors.push(error.name), onStopped: () => stopped++ });
  playback.setPlaying(true);
  video.plays[0].reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
  await Promise.resolve();
  assert.deepEqual(errors, ['NotAllowedError']);
  assert.equal(stopped, 1);
  video.paused = true;
  playback.setPlaying(true);
  playback.destroy();
  video.plays[1].reject(Object.assign(new Error('closed window'), { name: 'AbortError' }));
  await Promise.resolve();
  assert.equal(stopped, 1);
  assert.equal(errors.length, 1);
});

test('a request made before metadata waits for both metadata and the final seek', () => {
  const video = new NativeVideo();
  video.readyState = 0;
  const playback = new VideoPlayback(video);
  playback.seek(12);
  playback.setPlaying(true);
  assert.equal(video.seeks.length, 0);
  assert.equal(video.plays.length, 0);
  video.readyState = 1;
  playback.flush();
  assert.deepEqual(video.seeks, [12]);
  assert.equal(video.plays.length, 0);
  video.finishSeek(playback);
  assert.equal(video.plays[0].time, 12);
  video.plays[0].resolve();
});
