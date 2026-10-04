import test from "node:test";
import assert from "node:assert/strict";
import { KnobBridge } from "../src/knob.js";
import { getControl, initialApps, reduceApps } from "../src/model.js";
import { VIDEO_CHAPTERS, VIDEO_CHAPTER_SNAP_STRENGTH } from "../src/chapters.js";

const basic = (changes = {}) => ({
  key: "audio:volume", value: 4, min: 0, max: 100,
  width: 8, strength: 0.3, detents: [], favorites: [], ...changes,
});
const anchorFields = (config) => ({
  position: config.position,
  subPositionUnit: config.subPositionUnit,
  positionNonce: config.positionNonce,
  text: config.text,
});

function setup({ selection, initialNonce = 254, open } = {}) {
  const rotations = [], presses = [], statuses = [], errors = [], connections = [], order = [];
  const port = {};
  let selections = 0;
  const bridge = new KnobBridge({
    onRotate: (value) => rotations.push(value),
    onPress: (count) => presses.push(count),
    onStatus: (status) => statuses.push(status),
    onError: (message) => errors.push(message),
    serial: { requestPort: () => { selections += 1; return selection || Promise.resolve(port); } },
    connectionFactory: (onState, onFailure) => {
      const connection = {
        sent: [], closed: false,
        async open(selected) {
          assert.equal(selected, port);
          onState({ currentPosition: 0, pressNonce: initialNonce, config: { text: "previous-session" } });
          if (open) await open();
        },
        config(config) { this.sent.push(structuredClone(config)); order.push("config"); },
        async drain() { order.push("drain"); },
        async close() { if (!this.closed) { this.closed = true; order.push("close"); } },
        emit(position, nonce = initialNonce, text = bridge.config.text) {
          onState({ currentPosition: position, subPositionUnit: 0.2, pressNonce: nonce, config: { text } });
        },
        fail: onFailure,
      };
      connections.push(connection);
      return connection;
    },
  });
  return { bridge, rotations, presses, statuses, errors, connections, order, port, selections: () => selections };
}

async function connected(control = basic()) {
  const context = setup();
  context.bridge.activate(control);
  assert.equal(await context.bridge.connect(), true);
  context.connection = context.connections[0];
  context.connection.emit(control.value);
  return context;
}

test("USB selection starts synchronously and activation waits for a matching config echo", async () => {
  const { bridge, connections, statuses, rotations, presses, selections } = setup();
  bridge.activate(basic());
  const opening = bridge.connect();
  assert.equal(selections(), 1, "requestPort must preserve the click's user activation");
  assert.equal(bridge.phase, "selecting");
  assert.equal(bridge.connected, false);
  assert.equal(await opening, true);
  assert.deepEqual(statuses.map(({ phase }) => phase), ["selecting", "connecting", "connected"]);
  assert.equal(bridge.status.connected, true);
  connections[0].emit(90, 254, "previous-session");
  connections[0].emit(4);
  assert.deepEqual(rotations, []);
  assert.deepEqual(presses, []);
  connections[0].emit(6);
  assert.deepEqual(rotations, [6]);
  await bridge.close();
});

test("favorite strength retains ordinary clicks and never reanchors a rotating knob", async () => {
  const { bridge, connection, rotations } = await connected(basic({ favorites: [10] }));
  const original = anchorFields(bridge.config);
  connection.emit(10);
  assert.deepEqual(rotations, [10]);
  assert.equal(bridge.config.detentStrengthUnit, 0.85);
  assert.deepEqual(bridge.config.detentPositions, []);
  assert.deepEqual(anchorFields(bridge.config), original);
  const messages = connection.sent.length;
  bridge.sync(basic({ value: 10, favorites: [10] }));
  assert.equal(connection.sent.length, messages, "reducer updates must not resend/reanchor");
  connection.emit(11);
  assert.equal(bridge.config.detentStrengthUnit, 0.3);
  assert.deepEqual(anchorFields(bridge.config), original);
  bridge.sync(basic({ value: 30 }), { reanchor: true });
  assert.equal(bridge.config.position, 30);
  assert.notEqual(bridge.config.positionNonce, original.positionNonce);
  assert.notEqual(bridge.config.text, original.text);
  await bridge.close();
});

test("video chapter entry strengthens ordinary clicks without sparse magnetic mode or reanchoring", async () => {
  const chapter = VIDEO_CHAPTERS.find((entry) => entry.time === 83);
  for (const mode of ["fine", "coarse"]) {
    for (const direction of [-1, 1]) {
      let apps = initialApps();
      apps.video = { ...apps.video, mode, frame: chapter.frame - direction * (mode === "fine" ? 1 : 30) + (mode === "fine" ? 0 : 17) };
      const control = getControl(apps, "video");
      const { bridge, connection } = await connected(control);
      const anchor = anchorFields(bridge.config);
      bridge.onRotate = (position) => {
        const delta = position - getControl(apps, "video").value;
        apps = reduceApps(apps, { type: "turn", app: "video", delta });
        bridge.sync(getControl(apps, "video"));
      };
      assert.equal(bridge.config.detentStrengthUnit, control.strength);
      const chapterPosition = mode === "fine" ? chapter.frame : chapter.time;
      connection.emit(chapterPosition);
      assert.equal(apps.video.frame, chapter.frame);
      assert.equal(bridge.config.detentStrengthUnit, VIDEO_CHAPTER_SNAP_STRENGTH);
      assert.deepEqual(bridge.config.detentPositions, []);
      assert.deepEqual(anchorFields(bridge.config), anchor);
      connection.emit(chapterPosition + direction);
      assert.equal(bridge.config.detentStrengthUnit, control.strength);
      assert.deepEqual(bridge.config.detentPositions, []);
      assert.deepEqual(anchorFields(bridge.config), anchor);
      await bridge.close();
    }
  }
});

test("off-chapter coarse playback never boosts an old chapter position on the physical knob", async () => {
  const chapter = VIDEO_CHAPTERS.find((entry) => entry.time === 83);
  let apps = initialApps();
  apps.video = { ...apps.video, mode: "coarse", frame: chapter.frame };
  const { bridge } = await connected(getControl(apps, "video"));
  const anchor = anchorFields(bridge.config);
  assert.equal(bridge.config.detentStrengthUnit, VIDEO_CHAPTER_SNAP_STRENGTH);
  apps = reduceApps(apps, { type: "set", app: "video", key: "playing", value: true });
  bridge.sync(getControl(apps, "video"));
  assert.equal(bridge.config.detentStrengthUnit, 0.48);
  for (const frame of [chapter.frame + 1, chapter.frame + 17, VIDEO_CHAPTERS[3].frame]) {
    apps = reduceApps(apps, { type: "set", app: "video", key: "frame", value: frame });
    bridge.sync(getControl(apps, "video"));
    assert.equal(bridge.config.detentStrengthUnit, 0.48);
    assert.deepEqual(anchorFields(bridge.config), anchor);
  }
  apps = reduceApps(apps, { type: "set", app: "video", key: "frame", value: chapter.frame + 17 });
  apps = reduceApps(apps, { type: "set", app: "video", key: "playing", value: false });
  bridge.sync(getControl(apps, "video"));
  assert.equal(bridge.config.detentStrengthUnit, 0.48, "stopping in the chapter's second must not imply an exact chapter landing");
  assert.deepEqual(bridge.config.detentPositions, []);
  await bridge.close();
});

test("magnetic mode tracks the nearest five bounded unique detents without resetting position", async () => {
  const points = [-5, 0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 20];
  const { bridge, connection } = await connected(basic({ value: 0, detents: points }));
  const original = anchorFields(bridge.config);
  assert.deepEqual(bridge.config.detentPositions, [0, 10, 20, 30, 40]);
  connection.emit(67);
  assert.deepEqual(bridge.config.detentPositions, [50, 60, 70, 80, 90]);
  assert.deepEqual(anchorFields(bridge.config), original);
  connection.emit(100);
  assert.deepEqual(bridge.config.detentPositions, [60, 70, 80, 90, 100]);
  assert.equal(bridge.config.detentStrengthUnit, 0.3);
  await bridge.close();
});

test("press nonce baselines, wraparound and dropped press counts do not leak across app switches", async () => {
  const { bridge, connection, presses, rotations } = await connected();
  connection.emit(4, 255);
  connection.emit(4, 0);
  connection.emit(4, 3);
  assert.deepEqual(presses, [1, 1, 3]);
  const oldText = bridge.config.text;
  bridge.activate(basic({ key: "reader:page", value: 2, max: 7 }));
  connection.emit(90, 4, oldText);
  connection.emit(2, 4);
  assert.deepEqual(presses, [1, 1, 3]);
  assert.deepEqual(rotations, []);
  connection.emit(3, 5);
  assert.deepEqual(rotations, [3]);
  assert.deepEqual(presses, [1, 1, 3, 1]);
  await bridge.close();
});

test("disconnect drains a neutral config before releasing the port and reconnect resets the press baseline", async () => {
  const { bridge, connection, connections, presses, order } = await connected();
  await bridge.disconnect();
  const neutral = connection.sent.at(-1);
  assert.equal(neutral.detentStrengthUnit, 0);
  assert.equal(neutral.endstopStrengthUnit, 0);
  assert.ok(neutral.maxPosition < neutral.minPosition);
  assert.deepEqual(order.slice(-3), ["config", "drain", "close"]);
  assert.equal(bridge.connected, false);
  assert.equal(bridge.phase, "disconnected");
  assert.equal(await bridge.connect(), true);
  const fresh = connections[1];
  fresh.emit(4);
  assert.deepEqual(presses, []);
  fresh.emit(4, 255);
  assert.deepEqual(presses, [1]);
  connection.emit(7, 2);
  assert.deepEqual(presses, [1], "closed-session callbacks must be ignored");
  await bridge.close();
});

test("disconnect cancels an in-flight handshake without leaving connect pending", async () => {
  const { bridge, connections } = setup({ open: () => new Promise(() => {}) });
  const opening = bridge.connect();
  await new Promise(setImmediate);
  assert.equal(connections.length, 1);
  await bridge.close();
  assert.equal(await opening, false);
  assert.equal(connections[0].closed, true);
  assert.equal(bridge.phase, "disconnected");
});

test("closing a pending device chooser ignores its eventual selection", async () => {
  let choose;
  const selection = new Promise((resolve) => { choose = resolve; });
  const { bridge, connections, port } = setup({ selection });
  const opening = bridge.connect();
  await bridge.close();
  assert.equal(await opening, false);
  choose(port);
  await new Promise(setImmediate);
  assert.equal(connections.length, 0);
  assert.equal(bridge.connected, false);
});

test("closing while the transport loads settles immediately and disposes its late instance", async () => {
  let resolveFactory;
  let opened = 0, closed = 0, selections = 0;
  const bridge = new KnobBridge({
    serial: { requestPort() { selections += 1; return Promise.resolve({}); } },
    connectionFactory: () => new Promise((resolve) => { resolveFactory = resolve; }),
  });
  const opening = bridge.connect();
  assert.equal(selections, 1, "lazy loading must not precede requestPort");
  await new Promise(setImmediate);
  assert.equal(bridge.phase, "connecting");
  await bridge.close();
  assert.equal(await opening, false, "close must not wait for a module download");
  resolveFactory({
    async open() { opened += 1; },
    async close() { closed += 1; },
  });
  await new Promise(setImmediate);
  assert.equal(opened, 0);
  assert.equal(closed, 1);
  assert.equal(bridge.connected, false);
  assert.equal(bridge.phase, "disconnected");
});

test("unsupported USB, cancelled selection and invalid configs produce explicit safe outcomes", async () => {
  const statuses = [], errors = [];
  const unsupported = new KnobBridge({ serial: null, onStatus: (s) => statuses.push(s), onError: (e) => errors.push(e) });
  assert.equal(await unsupported.connect(), false);
  assert.equal(statuses.at(-1).phase, "error");
  assert.equal(errors.length, 1);
  const cancelled = setup({ selection: Promise.reject(Object.assign(new Error("cancelled"), { name: "NotFoundError" })) });
  assert.equal(await cancelled.bridge.connect(), false);
  assert.equal(cancelled.bridge.phase, "disconnected");
  assert.deepEqual(cancelled.errors, []);
  for (const invalid of [{ value: 2 ** 31 }, { min: -Infinity }, { width: 0 }, { strength: 1.1 }, { favoriteStrength: 1.01 }, { favoriteStrength: -0.1 }, { favoriteStrength: NaN }, { detents: [0.5] }])
    assert.throws(() => unsupported.sync(basic(invalid)), RangeError);
  unsupported.sync(basic({ key: "video:frame", value: 19037, max: 19037 }));
  assert.equal(unsupported.config.position, 19037);
  assert.ok(new TextEncoder().encode(unsupported.config.text).length <= 50);
});
