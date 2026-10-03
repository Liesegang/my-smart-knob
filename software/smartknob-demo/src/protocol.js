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
  constructor(onState, onStatus) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.nonce = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
    this.pending = null;
    this.latest = null;
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
    this.watchdog = setInterval(() => {
      if (performance.now() - this.lastStateAt > 10000)
        this.fail(new Error("デバイスの状態更新が停止しました。"));
    }, 1000);
  }
  config(config) {
    this.send({ smartknobConfig: config });
  }
  send(payload) {
    if (this.closed) return;
    if (this.pending) {
      this.latest = payload;
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
              const next = this.latest;
              this.latest = null;
              if (next) this.send(next);
            }
            if (message.smartknobState) {
              this.receivedState = true;
              this.lastStateAt = performance.now();
              clearTimeout(this.readyTimer);
              this.resolveReady?.();
              this.resolveReady = null;
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
    void this.close();
    this.onStatus(error.message);
  }
  async drain(timeout = 1000) {
    const until = performance.now() + timeout;
    while (
      !this.closed &&
      (this.pending || this.latest) &&
      performance.now() < until
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  async close() {
    if (this.closing) return this.closing;
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.readyTimer);
    clearInterval(this.watchdog);
    this.pending = null;
    this.latest = null;
    this.closing = (async () => {
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
