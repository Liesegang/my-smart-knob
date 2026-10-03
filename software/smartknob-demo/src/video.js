import { markers, nearest, seekTime, timestamp } from "./model.js";
import { shuttleSpeed } from "./haptics.js";
import { DEMO } from "./player.js";

export class VideoControl {
  constructor(player, sendConfig, onView) {
    this.player = player;
    this.sendConfig = sendConfig;
    this.onView = onView;
    this.state = null;
    this.config = null;
    this.nonce = 0;
    this.lastMotion = 0;
    this.lastValue = null;
    this.enabled = false;
    this.control = "position";
    this.width = 3;
    this.strength = 0.6;
    this.manual = [];
    this.detents = [];
    this.speed = 0;
    this.targetTime = null;
    this.lastTick = 0;
  }
  poll(now = performance.now()) {
    const state = this.player.snapshot();
    if (!state) {
      this.invalidate();
      return;
    }
    const changed = state.id !== this.state?.id;
    this.state = state;
    this.detents = markers(
      [...DEMO.timestamps, ...this.manual],
      state.duration,
    );
    if (this.enabled) {
      if (changed || !this.config) this.sync();
      else if (this.control === "position") {
        this.refreshDetents(this.lastValue ?? state.time);
        if (
          now - this.lastMotion > 1800 &&
          Math.abs(state.time - (this.lastValue ?? state.time)) > 1.5
        )
          this.sync();
      }
    }
    this.onView({
      ...state,
      markers: this.detents,
      speed: this.speed,
      control: this.control,
    });
  }
  invalidate() {
    this.cancelSeek();
    this.speed = 0;
    this.targetTime = null;
    this.state = null;
    this.config = null;
    this.onView(null);
  }
  settings(width, strength, manual) {
    const parsed = manual
      .trim()
      .split(/[\s,、]+/)
      .filter(Boolean)
      .map(timestamp);
    if (parsed.some((n) => n === null))
      throw new Error(
        "タイムスタンプは 1:23 または 1:02:03 の形式で入力してください。",
      );
    if (
      ![1, 3, 6].includes(width) ||
      !Number.isFinite(strength) ||
      strength < 0 ||
      strength > 1
    )
      throw new Error("設定値が範囲外です。");
    this.width = width;
    this.strength = strength;
    this.manual = parsed;
    if (this.state)
      this.detents = markers(
        [...DEMO.timestamps, ...parsed],
        this.state.duration,
      );
    this.sync();
    this.poll();
  }
  setControl(control) {
    if (!["position", "speed"].includes(control)) return;
    if (control === "speed" && this.state?.canShuttle === false) return;
    this.cancelSeek();
    this.setSpeed(0);
    this.control = control;
    if (control === "speed") this.player.pause();
    this.sync();
    this.poll();
  }
  sync() {
    if (!this.enabled || !this.state) return;
    this.cancelSeek();
    this.speed = 0;
    this.targetTime = null;
    const time = this.state.time,
      position = Math.round(time);
    this.nonce++;
    const speed = this.control === "speed";
    this.config = {
      position: speed ? 0 : position,
      subPositionUnit: speed ? 0 : time - position,
      positionNonce: this.nonce % 256,
      minPosition: 0,
      maxPosition: speed ? 0 : Math.ceil(this.state.duration),
      positionWidthRadians: ((speed ? 60 : this.width) * Math.PI) / 180,
      detentStrengthUnit: speed
        ? 0.01
        : this.detents.length
          ? this.strength
          : 0,
      endstopStrengthUnit: speed ? 0.45 : 0.6,
      snapPoint: speed ? 1.1 : 0.7,
      snapPointBias: 0,
      detentPositions: speed ? [] : nearest(this.detents, time),
      text: `video:${this.control}:${this.nonce}`,
      ledHue: speed ? 170 : 0,
    };
    this.lastValue = speed ? 0 : time;
    this.lastMotion = performance.now();
    this.awaitingAnchor = true;
    this.sendConfig(this.config);
  }
  refreshDetents(position) {
    if (!this.config || this.control !== "position") return;
    const close = nearest(this.detents, position),
      strength = this.detents.length ? this.strength : 0;
    if (
      close.join(",") === this.config.detentPositions.join(",") &&
      strength === this.config.detentStrengthUnit
    )
      return;
    // Updating the detent list must never reset the current physical position.
    this.config = {
      ...this.config,
      detentPositions: close,
      detentStrengthUnit: strength,
    };
    this.sendConfig(this.config);
  }
  onKnob(state) {
    if (
      !this.enabled ||
      !this.state ||
      !this.config ||
      state.config?.text !== this.config.text
    )
      return;
    const value = state.currentPosition + state.subPositionUnit;
    if (!Number.isFinite(value)) return;
    if (this.awaitingAnchor) {
      this.awaitingAnchor = false;
      this.lastValue = value;
      return;
    }
    if (this.control === "speed") {
      this.setSpeed(shuttleSpeed(value * 3));
      return;
    }
    if (Math.abs(value - this.lastValue) < 0.025) return;
    this.lastValue = value;
    this.lastMotion = performance.now();
    this.refreshDetents(value);
    this.queueSeek(
      seekTime(
        state.currentPosition,
        state.subPositionUnit,
        this.detents,
        this.state.duration,
      ),
    );
  }
  cancelSeek() {
    clearTimeout(this.seekTimer);
    this.seekTimer = null;
    this.queuedSeek = undefined;
    this.player.cancelSeek?.();
  }
  queueSeek(time) {
    if (!this.enabled || !this.state || !Number.isFinite(time)) return;
    this.queuedSeek = Math.max(0, Math.min(this.state.duration, time));
    this.lastMotion = performance.now();
    if (!this.seekTimer)
      this.seekTimer = setTimeout(() => {
        this.seekTimer = null;
        if (this.enabled && this.state && this.queuedSeek !== undefined) {
          this.player.seek(this.queuedSeek);
          this.queuedSeek = undefined;
        }
      }, 65);
  }
  setSpeed(speed, { finishSeek = false } = {}) {
    if (!Number.isFinite(speed)) return;
    const next = Math.max(-32, Math.min(32, speed));
    if (next !== 0 && this.speed === 0) {
      this.targetTime = this.player.snapshot()?.time ?? 0;
      this.lastTick = performance.now();
      this.player.pause();
    }
    this.speed = next;
    if (!next) {
      this.targetTime = null;
      this.lastTick = 0;
      if (!finishSeek) this.player.cancelSeek?.();
    }
  }
  tick(now = performance.now()) {
    if (!this.enabled || this.control !== "speed" || !this.speed || !this.state)
      return;
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;
    this.targetTime = Math.max(
      0,
      Math.min(
        this.state.duration,
        (this.targetTime ?? this.state.time) + this.speed * dt,
      ),
    );
    // Signed, time-based seeking gives the same response in both directions.
    this.player.pause();
    this.player.seek(this.targetTime);
    if (this.targetTime === 0 || this.targetTime === this.state.duration)
      this.setSpeed(0, { finishSeek: true });
  }
  stop() {
    this.enabled = false;
    this.cancelSeek();
    this.setSpeed(0);
    this.config = null;
    this.player.pause();
  }
}
