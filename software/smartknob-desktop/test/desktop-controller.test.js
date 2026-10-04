import test from "node:test";
import assert from "node:assert/strict";
import { PressGesture } from "../src/useDesktopController.js";

function gesture() {
  const events = [];
  const jobs = new Map();
  let time = 0, nextId = 0;
  const value = new PressGesture({
    onPress: (target) => events.push(["press", target]),
    onLongPress: (target) => events.push(["longPress", target]),
    schedule(callback, delay) { const id = ++nextId; jobs.set(id, { at: time + delay, callback }); return id; },
    cancel(id) { jobs.delete(id); },
  });
  const advance = (delta) => {
    time += delta;
    for (const [id, job] of jobs) {
      if (job.at <= time) { jobs.delete(id); job.callback(); }
    }
  };
  return { value, events, advance, jobs };
}

test("one hardware press waits for the double-press window and fires once", () => {
  const { value, events, advance } = gesture();
  value.receive(1, "browser:tab");
  advance(349);
  assert.deepEqual(events, []);
  advance(1);
  assert.deepEqual(events, [["press", "browser:tab"]]);
  advance(1000);
  assert.equal(events.length, 1);
});

test("two close presses or a dropped-state press count trigger one secondary action", () => {
  const { value, events, advance, jobs } = gesture();
  value.receive(1, "photo:exposure");
  advance(300);
  value.receive(1, "photo:exposure");
  assert.deepEqual(events, [["longPress", "photo:exposure"]]);
  assert.equal(jobs.size, 0);
  advance(1000);
  value.receive(3, "reader:page");
  assert.deepEqual(events.at(-1), ["longPress", "reader:page"]);
  assert.equal(jobs.size, 0, "a packet containing several presses must not leave a delayed short press");
});

test("pending presses cannot cross app or parameter changes or visibility cancellation", () => {
  const { value, events, advance } = gesture();
  value.receive(1, "photo:exposure");
  advance(200);
  value.receive(1, "photo:temperature");
  advance(150);
  assert.deepEqual(events, []);
  advance(200);
  assert.deepEqual(events, [["press", "photo:temperature"]]);
  value.receive(1, "timer:minutes");
  value.clear();
  advance(1000);
  assert.equal(events.length, 1);
  value.receive(1, null);
  value.receive(NaN, "timer:minutes");
  assert.equal(events.length, 1);
});
