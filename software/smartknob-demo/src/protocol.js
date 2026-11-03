import protobuf from "../.generated/smartknob.cjs";
import { encode, decode } from "../../js/packages/smartknobjs-core/src/cobs.ts";
export const PB = protobuf.PB;
export function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
export function frame(payload) {
  const bytes = new Uint8Array(payload.length + 4);
  bytes.set(payload);
  new DataView(bytes.buffer).setUint32(payload.length, crc32(payload), true);
  const encoded = encode(bytes);
  const result = new Uint8Array(encoded.length + 1);
  result.set(encoded);
  return result;
}
export function unframe(bytes) {
  // Reject malformed COBS rather than accepting truncated data.
  for (let i = 0; i < bytes.length;) {
    const code = bytes[i];
    if (!code || i + code > bytes.length) throw new Error("Invalid COBS");
    i += code;
  }
  const raw = decode(bytes);
  if (raw.length < 5) throw new Error("Short packet");
  const body = raw.subarray(0, -4);
  if (
    new DataView(raw.buffer, raw.byteOffset + raw.length - 4, 4).getUint32(
      0,
      true,
    ) !== crc32(body)
  )
    throw new Error("CRC mismatch");
  const message = PB.FromSmartKnob.decode(body);
  if (message.protocolVersion !== 1) throw new Error("Unsupported protocol");
  return message;
}
export class Connection {
  constructor(onState, onStatus, onButton = () => {}) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.onButton = onButton;
    this.nonce = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    this.pending = null;
    this.latest = null;
    this.control = null;
    this.stateRequest = false;
    this.lastConfig = null;
    this.lastResyncAt = -Infinity;
    this.confirmedRemote = false;
    this.buffer = [];
    this.closed = true;
  }
  async open(port) {
    this.port = port;
    await port.open({ baudRate: 921600 });
    this.writer = port.writable.getWriter();
    this.reader = port.readable.getReader();
    this.closed = false;
    const ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.readyTimer = setTimeout(
      () => this.fail(new Error("デバイス状態を受信できません。")),
      6000,
    );
    this.loopPromise = this.readLoop();
    this.send({ requestState: {} });
    await ready;
    this.startSession();
    this.renewControl();
    this.heartbeat = setInterval(() => this.renewControl(), 1000);
    await this.drain(1000);
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastStateAt > 10000)
        this.fail(new Error("デバイスの状態更新が停止しました。"));
    }, 1000);
  }
  config(config) {
    if (this.closing) return;
    this.lastConfig = config;
    this.send({ smartknobConfig: config });
  }
  startSession() {
    const previous = this.sessionId;
    this.sessionId = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    if (this.sessionId === previous) this.sessionId = ((previous + 1) >>> 0) || 1;
    this.lastButtonSequence = 0;
    this.confirmedRemote = false;
  }
  renewControl(enabled = true) {
    if (!this.sessionId) return;
    this.send({ hostControl: {
      enabled, sessionId: this.sessionId,
      acknowledgedButtonSequence: this.lastButtonSequence,
    } });
  }
  pump() {
    const next = this.control || this.latest || (this.stateRequest ? { requestState: {} } : null);
    if (this.control) this.control = null;
    else if (this.latest) this.latest = null;
    else this.stateRequest = false;
    if (next) this.send(next);
  }
  send(payload) {
    if (this.closed) return;
    if (this.pending) {
      // Heartbeats and button ACKs must never overwrite a queued config.
      if (payload.hostControl) this.control = payload;
      else if (payload.smartknobConfig) this.latest = payload;
      else if (payload.requestState) this.stateRequest = true;
      return;
    }
    this.nonce = (this.nonce + 1) >>> 0;
    this.pending = {
      nonce: this.nonce,
      bytes: frame(
        PB.ToSmartknob.encode({
          protocolVersion: 1,
          nonce: this.nonce,
          ...payload,
        }).finish(),
      ),
      attempts: 0,
    };
    this.transmit();
  }
  async transmit() {
    const packet = this.pending;
    if (!packet || this.closed) return;
    if (++packet.attempts > (this.receivedState ? 8 : 20)) {
      this.fail(
        new Error(
          "デバイスから応答がありません。接続とファームウェアを確認してください。",
        ),
      );
      return;
    }
    try {
      if (!this.receivedState) await this.writer.write(new Uint8Array(8));
      await this.writer.write(packet.bytes);
      if (this.pending === packet && !this.closed)
        this.timer = setTimeout(() => this.transmit(), 250);
    } catch (error) {
      this.fail(error);
    }
  }
  async readLoop() {
    try {
      while (!this.closed) {
        const { value, done } = await this.reader.read();
        if (done) break;
        for (const byte of value) {
          if (byte) {
            this.buffer.push(byte);
            if (this.buffer.length > 4096) this.buffer = [];
          } else {
            const bytes = Uint8Array.from(this.buffer);
            this.buffer = [];
            let message;
            try {
              message = unframe(bytes);
            } catch {
              continue;
            }
            if (message.ack && message.ack.nonce === this.pending?.nonce) {
              clearTimeout(this.timer);
              this.pending = null;
              this.pump();
            }
            if (message.buttonEvent && !this.closing) {
              const event = message.buttonEvent;
              if (event.sessionId === this.sessionId) {
                // Firmware retries an event until this session acknowledges it.
                // Consume each sequence once, in order, across config traffic.
                if (event.sequence === ((this.lastButtonSequence + 1) >>> 0 || 1)) {
                  this.onButton(event.action);
                  this.lastButtonSequence = event.sequence;
                }
                this.renewControl();
              }
            }
            if (message.smartknobState) {
              this.receivedState = true;
              this.lastStateAt = performance.now();
              clearTimeout(this.readyTimer);
              this.resolveReady?.();
              this.resolveReady = null;
              if (this.lastConfig && message.smartknobState.config?.text === this.lastConfig.text)
                this.confirmedRemote = true;
              // A suspended tab may outlive the firmware's ownership lease.
              // Reclaim before resending the same idempotent config, rather
              // than leaving the UI and standalone state at different modes.
              if (!this.closing && this.lastConfig &&
                  message.smartknobState.config?.text !== this.lastConfig.text &&
                  performance.now() - this.lastResyncAt > 300) {
                this.lastResyncAt = performance.now();
                if (this.confirmedRemote && message.smartknobState.config?.text?.startsWith("demo:"))
                  this.startSession();
                this.renewControl();
                this.send({ smartknobConfig: this.lastConfig });
              }
              this.onState(message.smartknobState);
            }
          }
        }
      }
      if (!this.closed) this.fail(new Error("USB接続が切れました。"));
    } catch (error) {
      if (!this.closed) this.fail(error);
    } finally {
      this.reader.releaseLock();
    }
  }
  fail(error) {
    if (this.closed) return;
    this.rejectReady?.(error);
    this.rejectReady = null;
    void this.close({ release: false });
    this.onStatus(error.message);
  }
  async drain(timeout = 1000) {
    const until = performance.now() + timeout;
    while (
      !this.closed &&
      (this.pending || this.latest || this.control || this.stateRequest) &&
      performance.now() < until
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  async close({ release = true } = {}) {
    if (this.closing) return this.closing;
    clearInterval(this.heartbeat);
    clearInterval(this.watchdog);
    this.closing = (async () => {
      if (release && !this.closed && this.sessionId) {
        await this.drain(350);
        this.latest = null;
        this.control = null;
        this.stateRequest = false;
        this.renewControl(false);
        await this.drain(600);
      }
      this.closed = true;
      clearTimeout(this.timer);
      clearTimeout(this.readyTimer);
      this.pending = this.latest = this.control = null;
      this.stateRequest = false;
      try {
        await this.reader?.cancel();
      } catch {}
      await this.loopPromise;
      try {
        await this.writer?.close();
      } catch {}
      try {
        this.writer?.releaseLock();
      } catch {}
      try {
        await this.port?.close();
      } catch {}
    })();
    return this.closing;
  }
}
