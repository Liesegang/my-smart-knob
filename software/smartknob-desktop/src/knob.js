const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const noop = () => {};
const finiteInteger = (value) => Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX;

function normalize(control) {
  if (!control || typeof control.key !== "string" || !control.key)
    throw new TypeError("Knob control needs a non-empty key.");
  for (const field of ["value", "min", "max"])
    if (!finiteInteger(control[field])) throw new RangeError(`Knob ${field} must fit int32.`);
  if (!Number.isFinite(control.width) || control.width <= 0 || control.width > 360)
    throw new RangeError("Knob width must be between 0 and 360 degrees.");
  if (!Number.isFinite(control.strength) || control.strength < 0 || control.strength > 1)
    throw new RangeError("Knob strength must be between 0 and 1.");
  const favoriteStrength = control.favoriteStrength ?? 0.85;
  if (!Number.isFinite(favoriteStrength) || favoriteStrength < 0 || favoriteStrength > 1)
    throw new RangeError("Knob favorite strength must be between 0 and 1.");
  const bounded = control.min <= control.max;
  const positions = (values = []) => {
    if (!Array.isArray(values) || values.some((value) => !finiteInteger(value)))
      throw new RangeError("Knob detent positions must fit int32.");
    return [...new Set(values)].filter((value) => !bounded || (value >= control.min && value <= control.max));
  };
  return {
    ...control,
    value: bounded ? Math.max(control.min, Math.min(control.max, control.value)) : control.value,
    detents: positions(control.detents),
    favorites: positions(control.favorites),
    favoriteStrength,
  };
}

function nearest(positions, value) {
  return [...positions]
    .sort((a, b) => Math.abs(a - value) - Math.abs(b - value) || a - b)
    .slice(0, 5)
    .sort((a, b) => a - b);
}

/** One USB owner; active controls exchange whole, idempotent firmware configs. */
export class KnobBridge {
  constructor({
    onRotate = noop,
    onPress = noop,
    onStatus = noop,
    onError = noop,
    serial = globalThis.navigator?.serial,
    connectionFactory = async (onState, onFailure) => {
      const { Connection } = await import("../.generated/transport.js");
      return new Connection(onState, onFailure);
    },
  } = {}) {
    Object.assign(this, { onRotate, onPress, onStatus, onError, serial, connectionFactory });
    this.connected = false;
    this.phase = "disconnected";
    this.status = { connected: false, phase: this.phase, message: "未接続" };
    this.control = null;
    this.config = null;
    this.connection = null;
    this.generation = 0;
    this.positionNonce = 0;
    this.session = 0;
    this.lastPosition = null;
    this.lastPressNonce = null;
    this.awaitingAnchor = false;
    this.cleanup = Promise.resolve();
  }

  setStatus(phase, message) {
    this.phase = phase;
    this.status = { connected: this.connected, phase, message };
    this.onStatus(this.status);
  }

  connect() {
    if (this.connected) return Promise.resolve(true);
    if (this.connectPromise) return this.connectPromise;
    if (!this.serial?.requestPort) {
      const message = "USB接続にはPC版Chromeが必要です。";
      this.setStatus("error", message);
      this.onError(message);
      return Promise.resolve(false);
    }
    const session = ++this.session;
    this.lastPressNonce = null;
    this.setStatus("selecting", "デバイスを選択");
    let selection;
    try {
      // Keep requestPort inside the caller's user activation, before any await.
      selection = this.serial.requestPort();
    } catch (error) {
      this.connectionError(error, session);
      return Promise.resolve(false);
    }
    let cancel;
    const cancelled = new Promise((resolve) => { cancel = () => resolve(false); });
    this.cancelConnect = cancel;
    const attempt = (async () => {
      let connection;
      try {
        const port = await Promise.race([selection, cancelled]);
        if (port === false) return false;
        if (session !== this.session) return false;
        await this.cleanup;
        if (session !== this.session) return false;
        this.setStatus("connecting", "SmartKnobに接続中");
        const factory = Promise.resolve(this.connectionFactory(
          (state) => { if (session === this.session) this.receive(state); },
          (message) => this.connectionError(new Error(message), session),
        ));
        connection = await Promise.race([factory, cancelled]);
        if (connection === false) {
          // Loading cannot be aborted, but its eventual instance must never open
          // a port after the user has closed this connection attempt.
          void factory.then((late) => late.close()).catch(noop);
          return false;
        }
        if (session !== this.session) {
          await connection.close();
          return false;
        }
        this.connection = connection;
        const ready = await Promise.race([
          connection.open(port).then(() => true),
          cancelled,
        ]);
        if (!ready || session !== this.session) {
          await connection.close();
          return false;
        }
        this.connected = true;
        this.setStatus("connected", "USB接続中");
        if (this.control) this.sync(this.control, { reanchor: true });
        return true;
      } catch (error) {
        if (session === this.session) this.connectionError(error, session);
        if (connection) await connection.close();
        return false;
      } finally {
        if (this.connectPromise === attempt) {
          this.connectPromise = null;
          this.cancelConnect = null;
        }
      }
    })();
    this.connectPromise = attempt;
    return attempt;
  }

  connectionError(error, session) {
    if (session !== this.session) return;
    ++this.session;
    this.cancelConnect?.();
    this.connected = false;
    this.lastPressNonce = null;
    const connection = this.connection;
    this.connection = null;
    this.cleanup = Promise.resolve(connection?.close()).catch(noop);
    if (error?.name === "NotFoundError") {
      this.setStatus("disconnected", "接続をキャンセルしました");
    } else {
      const message = error?.message || "USB接続を確認してください。";
      this.setStatus("error", message);
      this.onError(message);
    }
  }

  activate(control) {
    return this.sync(control);
  }

  sync(control, { reanchor = false } = {}) {
    const next = normalize(control);
    const anchor = reanchor || !this.config || this.control?.key !== next.key;
    this.control = next;
    if (anchor) {
      this.generation += 1;
      this.positionNonce = (this.positionNonce + 1) & 255;
      this.lastPosition = next.value;
      this.awaitingAnchor = true;
      const key = next.key.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 24);
      this.config = {
        position: next.value,
        subPositionUnit: 0,
        positionNonce: this.positionNonce,
        text: `desk:${key}:${this.generation.toString(36)}`,
        ...this.feel(next.value),
      };
      this.sendConfig();
    } else {
      this.refreshFeel(this.lastPosition ?? next.value);
    }
    return this.config;
  }

  feel(position) {
    const control = this.control;
    const magnetic = control.detents.length > 0;
    return {
      minPosition: control.min,
      maxPosition: control.max,
      positionWidthRadians: control.width * Math.PI / 180,
      detentStrengthUnit: !magnetic && control.favorites.includes(position)
        ? Math.max(control.strength, control.favoriteStrength)
        : control.strength,
      endstopStrengthUnit: 0.65,
      snapPoint: 0.7,
      snapPointBias: 0,
      detentPositions: magnetic ? nearest(control.detents, position) : [],
      ledHue: 150,
    };
  }

  refreshFeel(position) {
    if (!this.config || !this.control) return;
    const config = { ...this.config, ...this.feel(position) };
    if (JSON.stringify(config) !== JSON.stringify(this.config)) {
      this.config = config;
      this.sendConfig();
    }
  }

  sendConfig() {
    if (this.connected && this.connection && this.config)
      this.connection.config(this.config);
  }

  receive(state) {
    const nonce = Number(state.pressNonce ?? 0) & 255;
    const presses = this.lastPressNonce === null ? 0 : (nonce - this.lastPressNonce + 256) & 255;
    // Baseline even stale states, so a press from the old app never reaches the new app.
    this.lastPressNonce = nonce;
    if (!this.connected || !this.config || state.config?.text !== this.config.text) return;
    const text = this.config.text;
    const position = state.currentPosition;
    if (!finiteInteger(position)) return;
    const previous = this.lastPosition;
    this.lastPosition = position;
    if (this.awaitingAnchor) {
      this.awaitingAnchor = false;
    } else if (position !== previous) {
      this.refreshFeel(position);
      this.onRotate(position);
    }
    if (presses && this.config?.text === text) this.onPress(presses);
  }

  disconnect() {
    if (this.phase === "disconnecting") return this.cleanup;
    const session = ++this.session;
    this.cancelConnect?.();
    this.cancelConnect = null;
    this.connectPromise = null;
    const connection = this.connection;
    const wasConnected = this.connected;
    this.connection = null;
    this.connected = false;
    this.lastPressNonce = null;
    this.awaitingAnchor = true;
    this.setStatus("disconnecting", "USB接続を終了中");
    const previousCleanup = this.cleanup;
    this.cleanup = (async () => {
      await previousCleanup;
      if (connection) {
        try {
          if (wasConnected) {
            this.positionNonce = (this.positionNonce + 1) & 255;
            connection.config({
              position: this.lastPosition ?? 0,
              subPositionUnit: 0,
              positionNonce: this.positionNonce,
              minPosition: 0,
              maxPosition: -1,
              positionWidthRadians: 5 * Math.PI / 180,
              detentStrengthUnit: 0,
              endstopStrengthUnit: 0,
              snapPoint: 0.7,
              snapPointBias: 0,
              detentPositions: [],
              text: "desk:disconnected",
              ledHue: 0,
            });
            await connection.drain(600);
          }
        } finally {
          await connection.close();
        }
      }
      if (session === this.session) this.setStatus("disconnected", "未接続");
    })().catch((error) => {
      if (session === this.session) this.connectionError(error, session);
    });
    return this.cleanup;
  }

  close() {
    return this.disconnect();
  }
}
