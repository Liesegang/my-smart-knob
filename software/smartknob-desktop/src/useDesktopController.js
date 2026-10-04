import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { KnobBridge } from "./knob.js";
import { APP_IDS, getControl, initialApps, reduceApps } from "./model.js";

const DESKTOP_CONTROL = {
  key: "desktop:idle", value: 0, min: 0, max: -1,
  width: 8, strength: 0, detents: [], favorites: [],
};
const initialStatus = { connected: false, phase: "disconnected", message: "未接続" };
const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/** The protocol reports presses, but no release/hold state. */
export class PressGesture {
  constructor({ onPress, onLongPress, delay = 350, schedule = setTimeout, cancel = clearTimeout }) {
    Object.assign(this, { onPress, onLongPress, delay, schedule, cancel });
    this.pending = null;
  }
  receive(count, target) {
    if (!Number.isFinite(count) || count < 1 || !target) return;
    if (this.pending && this.pending.target !== target) this.clear();
    if (count >= 2 || this.pending) {
      this.clear();
      this.onLongPress(target);
      return;
    }
    const pending = { target, timer: null };
    this.pending = pending;
    pending.timer = this.schedule(() => {
      if (this.pending !== pending) return;
      this.pending = null;
      this.onPress(target);
    }, this.delay);
  }
  clear() {
    if (this.pending) this.cancel(this.pending.timer);
    this.pending = null;
  }
}

export function useDesktopController({ active, onOpen, bridgeFactory, enabled = true }) {
  const [apps, setApps] = useState(initialApps);
  const [status, setStatus] = useState(initialStatus);
  const [notice, setNotice] = useState("");
  const appsRef = useRef(apps);
  const activeRef = useRef(null);
  const onOpenRef = useRef(onOpen);
  const bridgeRef = useRef(null);
  const gestureRef = useRef(null);
  const callbacksRef = useRef({});
  const deviceRef = useRef(null);
  const mountedRef = useRef(false);
  const suspendedRef = useRef(hidden());
  const enabledRef = useRef(enabled);
  onOpenRef.current = onOpen;

  const targetKey = useCallback(() => {
    if (!enabledRef.current || !activeRef.current || suspendedRef.current || hidden()) return null;
    return getControl(appsRef.current, activeRef.current).key;
  }, []);

  if (!bridgeRef.current) {
    const options = {
      onRotate: (value) => callbacksRef.current.rotate?.(value),
      onPress: (count) => gestureRef.current?.receive(count, targetKey()),
      onStatus: (next) => {
        if (mountedRef.current) setStatus(next);
        if (!next.connected) {
          gestureRef.current?.clear();
          deviceRef.current = null;
        } else if (bridgeRef.current?.externalConnection && bridgeRef.current.config) {
          const bridge = bridgeRef.current;
          deviceRef.current = { key: bridge.control.key, value: bridge.config.position, text: bridge.config.text };
        }
      },
      onError: (message) => { if (mountedRef.current) setNotice(message); },
    };
    bridgeRef.current = bridgeFactory ? bridgeFactory(options) : new KnobBridge(options);
  }
  if (!gestureRef.current) {
    gestureRef.current = new PressGesture({
      onPress: (target) => {
        if (targetKey() === target) callbacksRef.current.press?.();
      },
      onLongPress: (target) => {
        if (targetKey() === target) callbacksRef.current.longPress?.();
      },
    });
  }

  const syncBridge = useCallback(({ reanchor = false } = {}) => {
    const bridge = bridgeRef.current;
    if (!enabledRef.current && bridge.externalConnection) return;
    const id = activeRef.current;
    const control = enabledRef.current && id && !suspendedRef.current && !hidden()
      ? getControl(appsRef.current, id)
      : DESKTOP_CONTROL;
    const anchor = reanchor || !bridge.config || bridge.control?.key !== control.key;
    const config = bridge.sync(control, { reanchor: anchor });
    if (anchor) {
      gestureRef.current.clear();
      deviceRef.current = { key: control.key, value: control.value, text: config.text };
    }
  }, []);

  const apply = useCallback((raw, origin = "ui") => {
    if (!raw || typeof raw !== "object") return;
    const action = { ...raw, app: raw.app ?? activeRef.current, now: performance.now() };
    const before = appsRef.current;
    const next = reduceApps(before, action);
    if (next === before) return;
    appsRef.current = next;
    setApps(next);
    if (before.timer.running && !next.timer.running && next.timer.remaining === 0)
      setNotice("タイマーが終了しました。");

    const id = activeRef.current;
    if (!enabledRef.current || !id || suspendedRef.current || hidden()) return;
    const previous = getControl(before, id);
    const current = getControl(next, id);
    const changedTarget = previous.key !== current.key;
    const changedValue = previous.value !== current.value;
    const playbackFrame = action.app === "video" && action.type === "set" && action.key === "frame" && (
      action.source === "media" || (action.source !== "ui" && before.video.playing)
    );
    const timerTick = action.type === "tick" && id === "timer";
    const takingOverPlayback = origin === "device" && id === "video" && before.video.playing;
    const playbackStopped = id === "video" && before.video.playing && !next.video.playing;
    const directValue = origin !== "device" && action.type !== "tick" && !playbackFrame && changedValue;
    syncBridge({ reanchor: changedTarget || takingOverPlayback || playbackStopped || (timerTick && changedValue) || directValue });
  }, [syncBridge]);

  const press = useCallback(() => {
    const id = activeRef.current;
    if (!enabledRef.current || !id || suspendedRef.current || hidden()) return;
    gestureRef.current.clear();
    if (id === "windows") {
      onOpenRef.current?.(APP_IDS[appsRef.current.windows.index]);
      return;
    }
    apply({ type: "press", app: id });
  }, [apply]);

  const longPress = useCallback(() => {
    const id = activeRef.current;
    if (!enabledRef.current || !id || suspendedRef.current || hidden()) return;
    gestureRef.current.clear();
    apply({ type: "longPress", app: id });
  }, [apply]);

  const rotateDevice = useCallback((value) => {
    const id = activeRef.current;
    const device = deviceRef.current;
    const bridge = bridgeRef.current;
    if (!enabledRef.current || !id || suspendedRef.current || hidden() || !device || !Number.isInteger(value)) return;
    const current = getControl(appsRef.current, id);
    if (device.key !== current.key || bridge.control?.key !== current.key) return;
    // Auto playback changes the screen's value independently of the physical dial.
    // Always accumulate from the last physical value, never the moving playhead.
    const delta = value - device.value;
    deviceRef.current = { key: current.key, value, text: bridge.config?.text };
    if (delta) apply({ type: "turn", app: id, delta }, "device");
  }, [apply]);

  callbacksRef.current = { rotate: rotateDevice, press, longPress };

  const dispatch = useCallback((action) => apply(action), [apply]);
  const turn = useCallback((delta) => {
    if (!enabledRef.current || !activeRef.current || suspendedRef.current || hidden() || !Number.isFinite(delta)) return;
    apply({ type: "turn", app: activeRef.current, delta });
  }, [apply]);
  const clearNotice = useCallback(() => setNotice(""), []);
  const connect = useCallback(() => {
    gestureRef.current.clear();
    setNotice("");
    syncBridge({ reanchor: true });
    // Do not await anything before this call: requestPort needs this click.
    const opening = bridgeRef.current.connect();
    return opening.then((ready) => {
      if (ready && mountedRef.current) {
        const bridge = bridgeRef.current;
        deviceRef.current = {
          key: bridge.control.key,
          value: bridge.config.position,
          text: bridge.config.text,
        };
      }
      return ready;
    });
  }, [syncBridge]);
  const disconnect = useCallback(() => {
    gestureRef.current.clear();
    deviceRef.current = null;
    return bridgeRef.current.disconnect();
  }, []);

  // Update the input destination only after React commits the focused window.
  useLayoutEffect(() => {
    enabledRef.current = enabled;
    activeRef.current = APP_IDS.includes(active) ? active : null;
    gestureRef.current.clear();
    if (!enabled) {
      deviceRef.current = null;
      for (const id of ["video", "music", "audio"])
        if (appsRef.current[id].playing)
          apply({ type: "set", app: id, key: "playing", value: false }, "host");
    }
    syncBridge({ reanchor: true });
  }, [active, enabled, apply, syncBridge]);

  useEffect(() => {
    mountedRef.current = true;
    setStatus(bridgeRef.current.status);
    const tick = () => apply({ type: "tick" }, "timer");
    const timer = setInterval(tick, 250);
    const onVisibility = () => {
      suspendedRef.current = hidden();
      gestureRef.current.clear();
      tick();
      syncBridge({ reanchor: true });
    };
    const onPageHide = () => {
      suspendedRef.current = true;
      gestureRef.current.clear();
      deviceRef.current = null;
      void bridgeRef.current.close();
    };
    const onPageShow = () => {
      suspendedRef.current = hidden();
      syncBridge({ reanchor: true });
      if (bridgeRef.current.externalConnection)
        bridgeRef.current.setEnabled(enabledRef.current);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      gestureRef.current.clear();
      deviceRef.current = null;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      void bridgeRef.current.close();
    };
  }, [apply, syncBridge]);

  const control = APP_IDS.includes(active) ? getControl(apps, active) : null;
  return { apps, dispatch, control, status, notice, clearNotice, connect, disconnect, turn, press, longPress };
}
