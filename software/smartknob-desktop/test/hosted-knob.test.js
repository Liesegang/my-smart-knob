import test from "node:test";
import assert from "node:assert/strict";
import { HostedKnobBridge } from "../src/hostedKnob.js";

const control = (changes = {}) => ({
  key: "photo:exposure", value: 0, min: -30, max: 30,
  width: 5, strength: 0.4, detents: [0], favorites: [], ...changes,
});
const state = (bridge, value, nonce, text = bridge.config.text) => ({
  currentPosition: value, subPositionUnit: 0, pressNonce: nonce, config: { text },
});

function setup() {
  const sent = [], rotated = [], pressed = [], statuses = [];
  const bridge = new HostedKnobBridge({
    sendConfig: (config) => sent.push(structuredClone(config)),
    onRotate: (value) => rotated.push(value),
    onPress: (count) => pressed.push(count),
    onStatus: (value) => statuses.push(value),
  });
  bridge.sync(control());
  return { bridge, sent, rotated, pressed, statuses };
}

test("embedded USB status and enable calls are idempotent and default to a closed config gate", () => {
  const { bridge, sent, statuses } = setup();
  assert.equal(bridge.enabled, false);
  bridge.setConnected(true);
  assert.equal(sent.length, 0);
  bridge.setEnabled(true);
  assert.equal(sent.length, 1);
  const nonce = bridge.config.positionNonce;
  bridge.setConnected(true);
  bridge.setEnabled(true);
  assert.equal(sent.length, 1);
  assert.equal(bridge.config.positionNonce, nonce);
  assert.equal(statuses.length, 1);
  assert.equal(statuses[0].connected, true);
});

test("disabling immediately prevents delayed React or cleanup configs from replacing haptics", async () => {
  const { bridge, sent } = setup();
  bridge.setConnected(true);
  bridge.setEnabled(true);
  bridge.setEnabled(false);
  sent.push({ text: "haptics:coarse" }); // The parent has now selected its other tab.
  bridge.sync(control({ key: "desktop:idle", value: 0, min: 0, max: -1, strength: 0, detents: [] }), { reanchor: true });
  await bridge.close();
  assert.equal(sent.at(-1).text, "haptics:coarse");
  assert.equal(bridge.connected, true, "React cleanup must never close the parent's USB session");
  assert.equal(bridge.connection, null);
});

test("re-enabling anchors the latest model control instead of a stale physical position", () => {
  const { bridge, sent } = setup();
  bridge.setConnected(true);
  bridge.setEnabled(true);
  const previousNonce = bridge.config.positionNonce;
  bridge.setEnabled(false);
  bridge.sync(control({ value: 12 }), { reanchor: true });
  assert.equal(sent.length, 1);
  bridge.setEnabled(true);
  assert.equal(sent.length, 2);
  assert.equal(sent.at(-1).position, 12);
  assert.notEqual(sent.at(-1).positionNonce, previousNonce);
});

test("disabled or previous-mode device states cannot rotate or press the hosted desktop", () => {
  const { bridge, rotated, pressed } = setup();
  bridge.setConnected(true);
  bridge.setEnabled(true);
  bridge.receive(state(bridge, 0, 10));
  bridge.receive(state(bridge, 1, 11));
  assert.deepEqual(rotated, [1]);
  assert.deepEqual(pressed, [1]);
  const oldText = bridge.config.text;
  bridge.setEnabled(false);
  bridge.receive(state(bridge, 9, 12, oldText));
  bridge.setEnabled(true);
  bridge.receive(state(bridge, 9, 12, oldText));
  bridge.receive(state(bridge, bridge.control.value, 12));
  assert.deepEqual(rotated, [1]);
  assert.deepEqual(pressed, [1]);
  bridge.receive(state(bridge, 2, 13));
  assert.deepEqual(rotated, [1, 2]);
  assert.deepEqual(pressed, [1, 1]);
});

test("parent disconnection resets press history and reconnect does not request another port", async () => {
  const { bridge, sent, pressed } = setup();
  bridge.setConnected(true);
  bridge.setEnabled(true);
  bridge.receive(state(bridge, 0, 254));
  bridge.receive(state(bridge, 0, 255));
  bridge.setConnected(false);
  const count = sent.length;
  bridge.receive(state(bridge, 10, 0));
  assert.equal(await bridge.connect(), false);
  assert.equal(sent.length, count);
  bridge.setConnected(true);
  assert.equal(await bridge.connect(), true);
  bridge.receive(state(bridge, 0, 0));
  assert.deepEqual(pressed, [1]);
  bridge.receive(state(bridge, 0, 2));
  assert.deepEqual(pressed, [1, 2]);
});
