import { Connection } from "./protocol.js";
import { presets, presetConfig, neutralConfig } from "./presets.js";
import { renderDial, renderWave, updateWaveCursor } from "./visuals.js";
import { advancePosition } from "./haptics.js";

const $ = (id) => document.getElementById(id);
let connection = null,
  connecting = false,
  mode = "haptics",
  selected = presets[1],
  variant = 0;
let nonce = 0,
  config = presetConfig(selected, ++nonce),
  value = 0,
  previewFrame = 0;
let isNeutral = false,
  detentPosition = 0;
const isConnected = () => connection && !connection.closed;
const notice = (text) => {
  $("notice").textContent = text;
};
function sendConfig(next) {
  if (isConnected()) connection.config(next);
}
function idle() {
  if (isConnected() && !isNeutral) {
    sendConfig(neutralConfig(++nonce));
    isNeutral = true;
  }
}
let desktop = null;
let desktopLoading = null;
async function loadDesktop() {
  if (desktop) return desktop;
  if (!desktopLoading) desktopLoading = import("./desktop.js").then(({ mountDesktop }) => {
    desktop = mountDesktop($("desktop-host"), {
      sendConfig: (next) => {
        if (mode === "os" && !document.hidden) {
          isNeutral = false;
          sendConfig(next);
        }
      },
    });
    desktop.setConnected(!!isConnected());
    desktop.setEnabled(mode === "os");
    return desktop;
  }).catch((error) => {
    desktopLoading = null;
    notice(`OS Demoを読み込めませんでした。${error.message}`);
    throw error;
  });
  return desktopLoading;
}

function updateConnectionUI() {
  const connected = isConnected();
  $("connect").hidden = connected;
  $("connect").disabled = connecting;
  $("disconnect").hidden = !connected;
  $("preview").disabled = connected;
  $("reset-preview").disabled = connected;
  $("preview-note").textContent = connected
    ? "USB接続中 · 実機のノブを回してください"
    : "USB未接続 · 画面上のシミュレーション（触覚は再現しません）";
  $("status").textContent = connected
    ? "USB接続中"
    : connecting
      ? "接続しています…"
      : "未接続";
  desktop?.setConnected(!!connected);
}
function draw() {
  renderDial($("dial"), selected, config, value);
  updateWaveCursor($("wave"), config, value, detentPosition);
  $("wave-position").textContent = value.toFixed(2);
  $("preview").value = String(value);
}
function selectPreset(preset, nextVariant = 0) {
  cancelAnimationFrame(previewFrame);
  selected = preset;
  variant = nextVariant;
  config = presetConfig(selected, ++nonce, variant);
  value = config.position;
  detentPosition = config.position;
  for (const button of $("presets").children) {
    const active = button.dataset.id === preset.id;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  $("preset-name").textContent = preset.name;
  $("tag").textContent = `${preset.sound}。${preset.tag}`;
  $("angle").textContent =
    `${Math.round((config.positionWidthRadians * 180) / Math.PI)}° / STEP`;
  $("unit").textContent = preset.unit;
  $("caption").textContent = preset.caption;
  $("description").textContent = preset.description;
  $("variants").replaceChildren();
  (preset.variants || []).forEach((label, index) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.setAttribute("aria-pressed", String(index === variant));
    button.classList.toggle("active", index === variant);
    button.addEventListener("click", () => selectPreset(selected, index));
    $("variants").append(button);
  });
  const bounded = config.minPosition <= config.maxPosition;
  const spring = preset.id === "spring";
  $("preview").min = String(
    spring
      ? -2
      : bounded
        ? config.minPosition
        : -Math.max(12, 360 / preset.width),
  );
  $("preview").max = String(
    spring
      ? 2
      : bounded
        ? config.maxPosition
        : Math.max(12, 360 / preset.width),
  );
  renderWave($("wave"), selected, config);
  draw();
  if (mode === "haptics") {
    isNeutral = false;
    sendConfig(config);
  }
}
for (const [index, preset] of presets.entries()) {
  const button = document.createElement("button");
  button.dataset.id = preset.id;
  button.innerHTML = `<span class="number">${String(index + 1).padStart(2, "0")}</span><span>${preset.name}</span><svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  button.addEventListener("click", () => selectPreset(preset));
  $("presets").append(button);
}
function setMode(next) {
  // Existing video/YouTube bookmarks now open the replacement OS demo.
  if (["youtube", "video", "desktop"].includes(next)) next = "os";
  if (!["haptics", "os"].includes(next)) next = "haptics";
  mode = next;
  notice("");
  desktop?.setEnabled(false);
  $("haptics").hidden = mode !== "haptics";
  $("os").hidden = mode !== "os";
  document.body.classList.toggle("os-mode", mode === "os");
  document.querySelectorAll("nav [data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (mode === "os") {
    cancelAnimationFrame(previewFrame);
    drag = null;
    idle();
    if (desktop) desktop.setEnabled(true);
    else void loadDesktop().catch(() => {});
  } else selectPreset(selected, variant);
}
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    if (location.hash === `#${button.dataset.mode}`)
      setMode(button.dataset.mode);
    else location.hash = button.dataset.mode;
  }),
);
window.addEventListener("hashchange", () => setMode(location.hash.slice(1)));
$("connect").addEventListener("click", async () => {
  if (!navigator.serial) {
    notice("USB接続にはデスクトップ版Chromeを使ってください。");
    return;
  }
  connecting = true;
  updateConnectionUI();
  notice("");
  let candidate;
  try {
    // No VID/PID filter: the user's modified hardware may use a different USB bridge.
    const port = await navigator.serial.requestPort();
    candidate = new Connection(
      (state) => {
        if (mode === "os" && !document.hidden) desktop?.receive(state);
        else if (
          state.config?.text === config.text &&
          Number.isFinite(state.currentPosition + state.subPositionUnit)
        ) {
          value = state.currentPosition + state.subPositionUnit;
          detentPosition = state.currentPosition;
          draw();
        }
      },
      (message) => {
        notice(message);
        if (connection === candidate) connection = null;
        updateConnectionUI();
      },
    );
    connection = candidate;
    await candidate.open(port);
    if (candidate.closed) throw new Error("デバイスへの接続に失敗しました。");
    cancelAnimationFrame(previewFrame);
    if (mode === "os") {
      isNeutral = false;
      idle();
      desktop?.setConnected(true);
      desktop?.setEnabled(true);
    } else selectPreset(selected, variant);
  } catch (error) {
    if (candidate) await candidate.close();
    connection = null;
    if (error.name !== "NotFoundError") notice(error.message);
  } finally {
    connecting = false;
    updateConnectionUI();
  }
});
$("disconnect").addEventListener("click", async () => {
  const old = connection;
  if (!old) return;
  $("disconnect").disabled = true;
  desktop?.setConnected(false);
  // Leave the motor free when the user explicitly disconnects.
  old.config(neutralConfig(++nonce));
  await old.drain(1200);
  await old.close();
  connection = null;
  $("disconnect").disabled = false;
  updateConnectionUI();
  notice("切断しました。");
});
function preview(next) {
  if (isConnected()) return;
  cancelAnimationFrame(previewFrame);
  const low = Number($("preview").min),
    high = Number($("preview").max);
  value = Math.max(low, Math.min(high, next));
  detentPosition = advancePosition(detentPosition, value, config);
  draw();
}
function releasePreview() {
  if (isConnected()) return;
  let target = value;
  if (selected.id === "spring") target = 0;
  else if (config.detentPositions.length) {
    const nearest = config.detentPositions.reduce((a, b) =>
      Math.abs(a - value) < Math.abs(b - value) ? a : b,
    );
    if (Math.abs(nearest - value) < 0.7) target = nearest;
  } else if (config.detentStrengthUnit > 0) target = detentPosition;
  const start = value,
    begin = performance.now();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function animate(now) {
    const t = reduced ? 1 : Math.min(1, (now - begin) / 300);
    value = start + (target - start) * (1 - (1 - t) ** 3);
    detentPosition = advancePosition(detentPosition, value, config);
    draw();
    if (t < 1) previewFrame = requestAnimationFrame(animate);
  }
  previewFrame = requestAnimationFrame(animate);
}
$("preview").addEventListener("input", () =>
  preview(Number($("preview").value)),
);
$("preview").addEventListener("change", releasePreview);
$("reset-preview").addEventListener("click", () => preview(config.position));
let drag = null;
$("dial").addEventListener("pointerdown", (event) => {
  if (isConnected()) return;
  drag = { x: event.clientX, value };
  $("dial").setPointerCapture(event.pointerId);
});
$("dial").addEventListener("pointermove", (event) => {
  if (!drag) return;
  const extent = Number($("preview").max) - Number($("preview").min);
  preview(drag.value + ((event.clientX - drag.x) / 300) * extent);
});
for (const type of ["pointerup", "pointercancel"])
  $("dial").addEventListener(type, () => {
    if (drag) {
      drag = null;
      releasePreview();
    }
  });
window.addEventListener("pagehide", () => {
  desktop?.setEnabled(false);
  void connection?.close();
});
window.addEventListener("keydown", (event) => {
  if (
    mode !== "haptics" ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.repeat ||
    event.target.closest(
      "textarea,select,[contenteditable=true],input:not([type=range])",
    )
  )
    return;
  const index = Number(event.key) - 1;
  if (event.key.length === 1 && index >= 0 && index < presets.length) {
    event.preventDefault();
    selectPreset(presets[index]);
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) idle();
  else if (mode === "haptics") selectPreset(selected, variant);
});
setMode(location.hash.slice(1));
updateConnectionUI();
