import test from "node:test";
import assert from "node:assert/strict";
import { PB, frame, unframe, crc32, Connection } from "../src/protocol.js";
import { decode } from "../../js/packages/smartknobjs-core/src/cobs.ts";
import { timestamp, markers, nearest, seekTime } from "../src/model.js";
import { presets, presetConfig } from "../src/presets.js";
import {
  advancePosition,
  forceAt,
  waveSamples,
  waveAxes,
  waveDomain,
  waveAngle,
  wrappedValue,
  shuttleSpeed,
} from "../src/haptics.js";
import { VideoControl } from "../src/video.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wire = (payload) =>
  frame(PB.FromSmartKnob.encode({ protocolVersion: 1, ...payload }).finish());
const toMessage = (bytes) =>
  PB.ToSmartknob.decode(decode(bytes.subarray(0, -1)).subarray(0, -4));

test("CRC32 agrees with the standard known vector; corrupted and truncated frames are rejected", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
  const bytes = wire({ ack: { nonce: 0x12345678 } });
  assert.equal(bytes.at(-1), 0);
  assert.equal(unframe(bytes.subarray(0, -1)).ack.nonce, 0x12345678);
  bytes[3] ^= 0x10;
  assert.throws(() => unframe(bytes.subarray(0, -1)));
  assert.throws(() => unframe(Uint8Array.from([4, 1])));
  assert.throws(() =>
    unframe(
      frame(
        PB.FromSmartKnob.encode({
          protocolVersion: 9,
          ack: { nonce: 1 },
        }).finish(),
      ).subarray(0, -1),
    ),
  );
});
test("generated protobuf preserves negative bounds, fractions and repeated magnetic positions", () => {
  const config = {
    ...presetConfig(presets[1], 255),
    minPosition: -7,
    position: -4,
    subPositionUnit: -0.25,
    detentPositions: [-4, 0, 9],
  };
  const state = unframe(
    wire({
      smartknobState: { currentPosition: -4, subPositionUnit: -0.25, config },
    }).subarray(0, -1),
  ).smartknobState;
  assert.equal(state.currentPosition, -4);
  assert.equal(state.config.minPosition, -7);
  assert.equal(state.subPositionUnit, -0.25);
  assert.deepEqual(state.config.detentPositions, [-4, 0, 9]);
});
test("timestamps, nearest five, and exact magnetic snap handle boundaries", () => {
  assert.equal(timestamp("1:02:03"), 3723);
  assert.equal(timestamp("4:56"), 296);
  assert.equal(timestamp("1:99"), null);
  assert.equal(timestamp("1:99:00"), null);
  assert.equal(timestamp("hello"), null);
  assert.deepEqual(markers([0, 0, -1, 9, 10, Infinity], 10), [0, 9]);
  assert.deepEqual(
    nearest([0, 10, 20, 30, 40, 50, 60, 70], 52),
    [30, 40, 50, 60, 70],
  );
  assert.equal(seekTime(83, 0.1, [83], 600), 83);
  assert.equal(seekTime(83, 0.3, [83], 600), 83.3);
  assert.equal(seekTime(0, -20, [], 600), 0);
  assert.equal(seekTime(601, 0, [], 600), 600);
});
test("eight themes and variants fit firmware limits and provide distinct configurations", () => {
  assert.equal(presets.length, 8);
  for (const preset of presets)
    for (const variant of [0, 1]) {
      const c = presetConfig(preset, 300, variant);
      assert.equal(c.positionNonce, 44);
      assert.ok(c.detentPositions.length <= 5);
      assert.ok(c.detentStrengthUnit >= 0 && c.detentStrengthUnit <= 1);
      assert.ok(c.endstopStrengthUnit >= 0 && c.endstopStrengthUnit <= 1);
    }
  const toggle = presetConfig(
    presets.find((p) => p.id === "switch"),
    1,
  );
  assert.equal(toggle.snapPoint, 0.55);
  assert.equal(
    presetConfig(
      presets.find((p) => p.id === "spring"),
      1,
    ).maxPosition,
    0,
  );
  assert.equal(
    presetConfig(
      presets.find((p) => p.id === "spring"),
      1,
      1,
    ).snapPointBias,
    0.4,
  );
});
test("hysteresis uses direction-dependent states; cursor wraps on both sides", () => {
  const c = presetConfig(
    presets.find((p) => p.id === "switch"),
    1,
  );
  assert.equal(advancePosition(0, 0.5, c), 0);
  assert.equal(advancePosition(1, 0.5, c), 1);
  assert.ok(forceAt(0.5, 0, c) < 0);
  assert.ok(forceAt(0.5, 1, c) > 0);
  assert.equal(advancePosition(0, 0.6, c), 1);
  assert.equal(advancePosition(1, 0.4, c), 0);
  assert.equal(wrappedValue(3, -3, 3), -3);
  assert.equal(wrappedValue(-3.1, -3, 3), 2.9000000000000004);
  const samples = waveSamples(c);
  assert.equal(samples.forward.length, waveAxes.samples + 1);
  assert.equal(samples.reverse.length, waveAxes.samples + 1);
  assert.ok(samples.forward.every((p) => Number.isFinite(p.force)));
});
test("every preset and variant uses the same physical angle range", () => {
  for (const preset of presets) {
    for (let variant = 0; variant < (preset.variants?.length || 1); variant++) {
      const c = presetConfig(preset, 1, variant);
      const [min, max] = waveDomain(c);
      assert.ok(Math.abs(waveAngle(min, c) + 240) < 1e-9);
      assert.ok(Math.abs(waveAngle(max, c) - 240) < 1e-9);
      assert.ok(Math.abs(waveAngle((min + max) / 2, c)) < 1e-9);
      const samples = waveSamples(c);
      assert.ok([...samples.forward, ...samples.reverse].every(
        ({ force }) => Number.isFinite(force) && force >= -1 && force <= 1,
      ));
      assert.equal(wrappedValue(241, -240, 240), -239);
      assert.equal(wrappedValue(-241, -240, 240), 239);
    }
  }
});
test("force compares the same angular error on one shared firmware P scale", () => {
  const coarse = presetConfig(presets.find((p) => p.id === "coarse"), 1);
  const fine = presetConfig(presets.find((p) => p.id === "fine"), 1);
  // Both have a 1° dead zone and the same strength. A 2° displacement
  // must give the same force despite their different step widths.
  const expected = -(Math.PI / 180) * 0.65 * 4 / 10;
  assert.ok(Math.abs(forceAt(2 / 30, 0, coarse) - expected) < 1e-12);
  assert.ok(Math.abs(forceAt(2 / 6, 0, fine) - expected) < 1e-12);
  const coarseStep = waveAngle(1, coarse) - waveAngle(0, coarse);
  const fineStep = waveAngle(1, fine) - waveAngle(0, fine);
  assert.ok(Math.abs(coarseStep / fineStep - 5) < 1e-12);
});
test("endstop strength remains comparable without preset-specific rescaling", () => {
  const preset = presets.find((p) => p.id === "limit");
  const soft = presetConfig(preset, 1, 0);
  const hard = presetConfig(preset, 1, 1);
  assert.deepEqual(waveDomain(soft), waveDomain(hard));
  assert.ok(Math.abs(forceAt(-0.5, 0, hard) / forceAt(-0.5, 0, soft) - 0.9 / 0.35) < 1e-12);
});
function fakeVideo() {
  return {
    time: 80,
    duration: 600,
    seeks: [],
    pauses: 0,
    snapshot() {
      return {
        id: "big-buck-bunny",
        time: this.time,
        duration: this.duration,
        paused: true,
      };
    },
    seek(time) {
      this.seeks.push(time);
      this.time = time;
    },
    pause() {
      this.pauses++;
    },
  };
}
test("VideoControl updates five nearest detents without recentering and ignores old mode state", async () => {
  const video = fakeVideo(),
    configs = [],
    y = new VideoControl(
      video,
      (c) => configs.push(c),
      () => {},
    );
  y.enabled = true;
  y.poll();
  const initial = y.config;
  y.onKnob({ currentPosition: 80, subPositionUnit: 0, config: initial });
  y.onKnob({ currentPosition: 296, subPositionUnit: 0.1, config: initial });
  assert.equal(y.config.position, initial.position);
  assert.equal(y.config.positionNonce, initial.positionNonce);
  assert.equal(y.config.detentPositions.length, 5);
  await sleep(90);
  assert.equal(video.seeks.at(-1), 296);
  y.setControl("speed");
  y.onKnob({ currentPosition: 400, subPositionUnit: 0, config: initial });
  assert.equal(y.speed, 0);
  y.stop();
});
test("manual markers become magnetic immediately; invalid settings are rejected without mutation", () => {
  const y = new VideoControl(
    fakeVideo(),
    () => {},
    () => {},
  );
  y.enabled = true;
  y.poll();
  y.settings(6, 0.8, "1:24 1:25");
  assert.ok(y.detents.includes(84));
  assert.ok(y.detents.includes(85));
  assert.throws(() => y.settings(3, 0.6, "1:99"));
  assert.equal(y.width, 6);
  y.stop();
});
test("shuttle is symmetric, stops at center and advances by elapsed time with endpoint clamps", () => {
  assert.equal(shuttleSpeed(0.1), 0);
  assert.equal(shuttleSpeed(-2), -shuttleSpeed(2));
  assert.equal(shuttleSpeed(10), 32);
  const video = fakeVideo(),
    y = new VideoControl(
      video,
      () => {},
      () => {},
    );
  y.enabled = true;
  y.poll();
  y.setControl("speed");
  y.setSpeed(8);
  const start = y.lastTick;
  y.tick(start + 100);
  assert.ok(Math.abs(video.time - 80.8) < 0.0001);
  y.setSpeed(-8);
  y.tick(start + 200);
  assert.ok(Math.abs(video.time - 80) < 0.0001);
  y.setSpeed(0);
  const count = video.seeks.length;
  y.tick(start + 300);
  assert.equal(video.seeks.length, count);
  video.time = 599.9;
  y.setSpeed(32);
  y.tick(y.lastTick + 100);
  assert.equal(video.time, 600);
  assert.equal(y.speed, 0);
  y.stop();
});
test("leaving VideoControl cancels a queued seek and shuttle", async () => {
  const video = fakeVideo(),
    y = new VideoControl(
      video,
      () => {},
      () => {},
    );
  y.enabled = true;
  y.poll();
  y.queueSeek(400);
  y.stop();
  await sleep(90);
  assert.equal(video.seeks.length, 0);
  assert.equal(y.speed, 0);
});
function makePort(handler) {
  let input;
  const port = {
    written: [],
    closed: false,
    readable: new ReadableStream({
      start(c) {
        input = c;
      },
    }),
    writable: new WritableStream({
      write(bytes) {
        port.written.push(bytes);
        handler?.(bytes, port);
      },
    }),
    emit(message) {
      const bytes = wire(message);
      input.enqueue(bytes.subarray(0, 3));
      input.enqueue(bytes.subarray(3));
    },
    async open(options) {
      assert.equal(options.baudRate, 921600);
    },
    async close() {
      this.closed = true;
    },
  };
  return port;
}
test("serial handshake, fragmented frames, stale ACK, queue coalescing and cleanup", async () => {
  const port = makePort((bytes, p) => {
    if (bytes.every((n) => n === 0)) return;
    const message = toMessage(bytes);
    if (message.requestState) {
      p.emit({ ack: { nonce: message.nonce } });
      p.emit({ smartknobState: { currentPosition: 3 } });
    }
  });
  const states = [],
    c = new Connection(
      (s) => states.push(s),
      () => {},
    );
  await c.open(port);
  assert.equal(states[0].currentPosition, 3);
  c.config(presetConfig(presets[1], 1));
  await sleep(5);
  const pendingNonce = c.pending.nonce;
  c.config(presetConfig(presets[2], 2));
  c.config(presetConfig(presets[3], 3));
  port.emit({ ack: { nonce: pendingNonce + 100 } });
  await sleep(5);
  assert.equal(c.pending.nonce, pendingNonce);
  port.emit({ ack: { nonce: pendingNonce } });
  await sleep(5);
  const latest = toMessage(port.written.at(-1));
  assert.equal(latest.smartknobConfig.text, "studio:limit:3");
  port.emit({ ack: { nonce: latest.nonce } });
  await c.drain();
  await c.close();
  assert.ok(c.closed);
  assert.ok(port.closed);
  assert.equal(port.readable.locked, false);
  assert.equal(port.writable.locked, false);
});
test("serial retries the same nonce and closes without leaking retry timers", async () => {
  const port = makePort((bytes, p) => {
    if (bytes.every((n) => n === 0)) return;
    const m = toMessage(bytes);
    if (m.requestState) {
      p.emit({ ack: { nonce: m.nonce } });
      p.emit({ smartknobState: {} });
    }
  });
  const c = new Connection(
    () => {},
    () => {},
  );
  await c.open(port);
  c.config(presetConfig(presets[0], 1));
  await sleep(300);
  const messages = port.written
    .filter((b) => !b.every((n) => n === 0))
    .map(toMessage)
    .filter((m) => m.smartknobConfig);
  assert.ok(messages.length >= 2);
  assert.equal(messages[0].nonce, messages[1].nonce);
  await c.close();
  const count = port.written.length;
  await sleep(280);
  assert.equal(port.written.length, count);
});

test("shuttle mode respects player readiness", () => {
  const video = fakeVideo();
  const base = video.snapshot.bind(video);
  video.snapshot = () => ({ ...base(), canShuttle: false });
  const y = new VideoControl(
    video,
    () => {},
    () => {},
  );
  y.enabled = true;
  y.poll();
  y.setControl("speed");
  assert.equal(y.control, "position");
  video.snapshot = () => ({ ...base(), canShuttle: true });
  y.poll();
  y.setControl("speed");
  assert.equal(y.control, "speed");
  y.stop();
});
