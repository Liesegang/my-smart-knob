import { KnobBridge } from "./knob.js";

/** Haptics routing only. The containing page owns the USB connection. */
export class HostedKnobBridge extends KnobBridge {
  constructor({ sendConfig, ...callbacks }) {
    super({ ...callbacks, serial: null });
    this.externalConnection = true;
    this.enabled = false;
    this.hostSendConfig = sendConfig;
  }

  sendConfig() {
    if (this.enabled && this.connected && this.config)
      this.hostSendConfig(this.config);
  }

  setConnected(connected) {
    const next = Boolean(connected);
    if (this.connected === next) return;
    this.connected = next;
    this.lastPressNonce = null;
    this.awaitingAnchor = true;
    if (next && this.enabled && this.control)
      this.sync(this.control, { reanchor: true });
    if (!next) this.lastPosition = null;
    this.setStatus(next ? "connected" : "disconnected", next ? "USB接続中" : "未接続");
  }

  setEnabled(enabled) {
    const next = Boolean(enabled);
    if (next === this.enabled) return;
    // Close this gate before any React cleanup can send its neutral config.
    this.enabled = next;
    this.lastPressNonce = null;
    this.awaitingAnchor = true;
    if (next && this.control) this.sync(this.control, { reanchor: true });
  }

  receive(state) {
    if (this.enabled && this.connected) super.receive(state);
  }

  connect() {
    return Promise.resolve(this.connected);
  }

  disconnect() {
    this.setEnabled(false);
    return Promise.resolve();
  }

  close() {
    return this.disconnect();
  }
}
