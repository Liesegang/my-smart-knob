import { Connection } from "./protocol.js";
import { presets, presetConfig, neutralConfig } from "./presets.js";
import { renderDial, renderWave, updateWaveCursor } from "./visuals.js";
import { advancePosition, shuttleSpeed } from "./haptics.js";
import { VideoPlayer, DEMO } from "./player.js";
import { VideoControl } from "./video.js";

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
const clock = (seconds) => {
  const n = Math.max(0, Math.floor(seconds));
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
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
const player = new VideoPlayer((message) => {
  notice(message);
  video.invalidate();
});
const video = new VideoControl(
  player,
  (next) => {
    isNeutral = false;
    sendConfig(next);
  },
  (state) => {
    $("sync").disabled = !state || !isConnected();
    $("video-position").disabled = !state;
    $("velocity").disabled = !state || !!isConnected();
    $("play").disabled = !state || video.control === "speed";
    $("play").textContent = !state || state.paused ? "再生" : "一時停止";
    $("mute").disabled = !state;
    $("mute").textContent = state?.muted ? "音声オン" : "消音";
    $("mute").setAttribute("aria-pressed", String(!!state?.muted));
    document.querySelector('[data-control="speed"]').disabled =
      !state || !state.canShuttle;
    if (!state) {
      $("time").textContent = "0:00";
      $("duration").textContent = "/ —";
      $("timeline").replaceChildren();
      $("timeline").dataset.signature = "";
      $("player-status").textContent =
        "ローカル動画を読み込んでいます…";
      if (mode === "video") idle();
      return;
    }
    const scene = [...DEMO.scenes]
      .reverse()
      .find((scene) => scene.time <= state.time);
    $("player-status").textContent = scene
      ? `${clock(scene.time)} · ${scene.label}`
      : "Big Buck Bunny";
    $("time").textContent = clock(state.time);
    $("duration").textContent = `/ ${clock(state.duration)}`;
    $("video-position").max = state.duration;
    if (document.activeElement !== $("video-position"))
      $("video-position").value = state.time;
    $("speed-output").textContent = state.speed
      ? `${state.speed > 0 ? "+" : ""}${state.speed.toFixed(1)}×`
      : "停止";
    $("markers").textContent =
      `吸着点 ${state.markers.length}か所 · ${state.markers.map(clock).join(" / ")}`;
    const signature = state.markers.join(",") + ":" + state.duration;
    if ($("timeline").dataset.signature !== signature) {
      $("timeline").dataset.signature = signature;
      $("timeline").replaceChildren();
      let lastLabel = -100;
      for (const time of state.markers) {
        const button = document.createElement("button");
        button.style.left = `${(time / state.duration) * 100}%`;
        const scene = DEMO.scenes.find((scene) => scene.time === time);
        button.title = scene ? `${clock(time)} · ${scene.label}` : clock(time);
        button.setAttribute("aria-label", `${clock(time)}へシーク`);
        const percent = (time / state.duration) * 100;
        if (percent - lastLabel > 12) {
          const label = document.createElement("span");
          label.textContent = clock(time);
          button.append(label);
          lastLabel = percent;
        }
        button.addEventListener("click", () => {
          video.setSpeed(0);
          video.queueSeek(time);
        });
        $("timeline").append(button);
      }
    }
    $("timeline").style.setProperty(
      "--progress",
      `${Math.min(100, (state.time / state.duration) * 100)}%`,
    );
  },
);

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
  $("sync").disabled = !connected || !video.state;
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
  // Keep existing bookmarks working after replacing the embedded player.
  if (next === "youtube") next = "video";
  if (!["haptics", "video"].includes(next)) next = "haptics";
  mode = next;
  notice("");
  $("haptics").hidden = mode !== "haptics";
  $("video").hidden = mode !== "video";
  document.querySelectorAll("nav [data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (mode === "video") {
    cancelAnimationFrame(previewFrame);
    drag = null;
    idle();
    video.enabled = true;
    if (video.state) video.sync();
    void player.mount();
    video.poll();
  } else {
    video.stop();
    selectPreset(selected, variant);
  }
}
document.querySelectorAll("[data-mode]").forEach((button) =>
  button.addEventListener("click", () => {
    if (location.hash === `#${button.dataset.mode}`)
      setMode(button.dataset.mode);
    else location.hash = button.dataset.mode;
  }),
);
window.addEventListener("hashchange", () => setMode(location.hash.slice(1)));
document.querySelectorAll("[data-control]").forEach((button) =>
  button.addEventListener("click", () => {
    video.setControl(button.dataset.control);
    document.querySelectorAll("[data-control]").forEach((other) => {
      const active = other.dataset.control === video.control;
      other.classList.toggle("active", active);
      other.setAttribute("aria-pressed", String(active));
    });
    $("position-controls").hidden = video.control !== "position";
    $("speed-controls").hidden = video.control !== "speed";
    $("velocity").value = 0;
    $("control-description").textContent =
      video.control === "position"
        ? "回転した分だけシーク。タイムスタンプで、ぴたっと吸着。"
        : "ひねり量で速度が変化。右で早送り、左で巻き戻し、中央で停止。";
  }),
);
$("video-position").addEventListener("input", () =>
  video.queueSeek(Number($("video-position").value)),
);
$("velocity").addEventListener("input", () => {
  video.setSpeed(shuttleSpeed(Number($("velocity").value) * 3));
  video.poll();
});
function stopSpeed() {
  video.setSpeed(0);
  $("velocity").value = 0;
  $("speed-output").textContent = "停止";
}
for (const event of ["pointerup", "pointercancel", "keyup", "blur"])
  $("velocity").addEventListener(event, stopSpeed);
$("stop-speed").addEventListener("click", () => {
  stopSpeed();
  video.sync();
});
$("play").addEventListener("click", () => {
  if (player.snapshot()?.paused) player.play();
  else player.pause();
});
$("mute").addEventListener("click", () => {
  player.toggleMute();
  video.poll();
});
$("sync").addEventListener("click", () => video.sync());
$("apply").addEventListener("click", () => {
  try {
    video.settings(
      Number($("width").value),
      Number($("strength").value),
      $("manual").value,
    );
    notice("シークの設定を適用しました。");
  } catch (error) {
    notice(error.message);
  }
});
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
        if (mode === "video" && !document.hidden) video.onKnob(state);
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
        video.setSpeed(0);
        video.config = null;
        if (connection === candidate) connection = null;
        updateConnectionUI();
      },
    );
    connection = candidate;
    await candidate.open(port);
    if (candidate.closed) throw new Error("デバイスへの接続に失敗しました。");
    cancelAnimationFrame(previewFrame);
    if (mode === "video") {
      video.enabled = true;
      isNeutral = false;
      idle();
      video.sync();
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
  video.stop();
  // Leave the motor free when the user explicitly disconnects.
  old.config(neutralConfig(++nonce));
  await old.drain(1200);
  await old.close();
  connection = null;
  if (mode === "video") video.enabled = true;
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
  video.stop();
  void connection?.close();
});
window.addEventListener("keydown", (event) => {
  if (
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
    if (mode !== "haptics") {
      history.replaceState(null, "", "#haptics");
      setMode("haptics");
    }
    selectPreset(presets[index]);
  }
});
setInterval(() => {
  if (mode === "video") video.poll();
}, 250);
setInterval(() => video.tick(), 100);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopSpeed();
});
setMode(location.hash.slice(1));
updateConnectionUI();
