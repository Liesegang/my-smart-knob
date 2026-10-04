import { waveSamples, waveAngle, wrappedValue, forceAt } from "./haptics.js";
const point = (radius, degrees) => {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return [220 + radius * Math.cos(angle), 220 + radius * Math.sin(angle)];
};
const line = (radius1, radius2, angle, color = "#161715", width = 2) => {
  const a = point(radius1, angle),
    b = point(radius2, angle);
  return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
};
export function renderDial(element, preset, config, value) {
  const width = (config.positionWidthRadians * 180) / Math.PI;
  const bounded = config.minPosition <= config.maxPosition;
  const center = bounded ? (config.minPosition + config.maxPosition) / 2 : 0;
  const angle = (value - center) * width;
  let ticks = "";
  if (preset.id === "spring" && config.minPosition === config.maxPosition) {
    ticks =
      line(185, 201, 0, "#e75c32", 3) +
      line(185, 197, -60) +
      line(185, 197, 60);
  } else if (bounded) {
    for (let n = config.minPosition; n <= config.maxPosition; n++) {
      const active = config.detentPositions.includes(n);
      ticks += line(
        185,
        active ? 203 : 196,
        (n - center) * width,
        active ? "#e75c32" : "#77796e",
        active ? 4 : 2,
      );
    }
  } else {
    for (let n = 0; n < preset.ticks; n++)
      ticks += line(185, 198, (n * 360) / preset.ticks);
  }
  let display = String(Math.round(value)).padStart(2, "0");
  if (preset.id === "switch") display = Math.round(value) <= 0 ? "OFF" : "ON";
  if (preset.id === "free") display = `${Math.round(value * width)}°`;
  if (preset.id === "spring") display = `${Math.round(angle)}°`;
  const on = preset.id === "switch" && Math.round(value) > 0;
  const dot = point(198, angle);
  const needle = line(125, 151, angle, "#e75c32", 10);
  const spring =
    preset.id === "spring"
      ? `<path d="M 175 290 ${Array.from({ length: 12 }, (_, i) => `L ${182 + i * 7} ${290 + (i % 2 ? 1 : -1) * Math.min(16, 4 + Math.abs(angle) / 8)}`).join(" ")} L 266 290" stroke="#e75c32" stroke-width="2" fill="none"/>`
      : "";
  element.innerHTML = `${ticks}<circle cx="220" cy="220" r="155" fill="${on ? "#f2e3d9" : "none"}" stroke="#161715" stroke-width="2"/><circle cx="220" cy="220" r="150" fill="none" stroke="#b0b1a8" stroke-width="1"/>${needle}<circle cx="${dot[0]}" cy="${dot[1]}" r="${preset.id === "free" ? 5 : 0}" fill="#e75c32"/><text x="220" y="243" text-anchor="middle" fill="#161715" font-size="${display.length > 5 ? 44 : 66}" font-weight="400">${display}</text>${spring}`;
  element.setAttribute("aria-label", `${preset.name}: ${display}`);
}
const wavePlot = { left: 44, top: 20, width: 300, height: 200 };
const waveScales = new WeakMap();
const waveX = (angle, scale) => wavePlot.left +
  (angle - scale.minAngle) / (scale.maxAngle - scale.minAngle) * wavePlot.width;
const waveY = (force, scale) => wavePlot.top +
  (scale.maxForce - force) / (scale.maxForce - scale.minForce) * wavePlot.height;
const forceLabel = (force) => `${force > 0 ? "+" : ""}${Number(force.toPrecision(3))}`;

export function renderWave(element, preset, config) {
  const { forward, reverse, minForce, maxForce, minAngle, maxAngle } = waveSamples(config);
  const scale = { minForce, maxForce, minAngle, maxAngle };
  waveScales.set(element, scale);
  const x = (angle) => waveX(angle, scale);
  const y = (force) => waveY(force, scale);
  const points = (samples) =>
    samples.map((p) => `${x(waveAngle(p.value, config))},${y(p.force)}`).join(" ");
  const angleTicks = [minAngle, minAngle / 2, 0, maxAngle / 2, maxAngle];
  const forceTicks = [minForce, minForce / 2, 0, maxForce / 2, maxForce];
  element.innerHTML = `
    <defs><clipPath id="wave-plot-clip"><rect x="${wavePlot.left}" y="${wavePlot.top}" width="${wavePlot.width}" height="${wavePlot.height}"/></clipPath></defs>
    <g class="wave-axes" fill="#62655b" font-size="10">
      <text x="${wavePlot.left}" y="10">トルク（相対値・自動）</text>
      ${forceTicks.map((force) => `<line x1="${wavePlot.left}" y1="${y(force)}" x2="${wavePlot.left + wavePlot.width}" y2="${y(force)}" stroke="#c9cbc0" ${force === 0 ? "" : 'stroke-dasharray="3 4"'}/><text x="36" y="${y(force) + 3}" text-anchor="end">${forceLabel(force)}</text>`).join("")}
      ${angleTicks.map((angle) => `<line x1="${x(angle)}" y1="${wavePlot.top}" x2="${x(angle)}" y2="${wavePlot.top + wavePlot.height}" stroke="#c9cbc0" stroke-dasharray="3 4"/><text x="${x(angle)}" y="${wavePlot.top + wavePlot.height + 16}" text-anchor="middle">${angle > 0 ? "+" : ""}${angle}°</text>`).join("")}
      <text x="${wavePlot.left + wavePlot.width / 2}" y="${wavePlot.top + wavePlot.height + 34}" text-anchor="middle">角度（中心 = 0°・自動）</text>
    </g>
    <g clip-path="url(#wave-plot-clip)">
      <polyline points="${points(reverse)}" fill="none" stroke="#487781" stroke-width="1.5" stroke-dasharray="5 3"/>
      <polyline points="${points(forward)}" fill="none" stroke="#e75c32" stroke-width="1.5"/>
      <g class="wave-cursors">${[-wavePlot.width, 0, wavePlot.width].map((offset) => `<g data-wave-cursor data-offset="${offset}"><line y1="${wavePlot.top}" y2="${wavePlot.top + wavePlot.height}" stroke="#161715" stroke-width="1"/><circle r="4" fill="#161715" stroke="#f4f3ef" stroke-width="1.5"/></g>`).join("")}</g>
    </g>`;
}
export function updateWaveCursor(element, config, value, position) {
  const angle = waveAngle(value, config);
  const scale = waveScales.get(element) ?? waveSamples(config);
  const x = waveX(wrappedValue(angle, scale.minAngle, scale.maxAngle), scale);
  const y = waveY(forceAt(value, position, config), scale);
  for (const cursor of element.querySelectorAll("[data-wave-cursor]")) {
    cursor.setAttribute(
      "transform",
      `translate(${x + Number(cursor.dataset.offset)},0)`,
    );
    cursor.querySelector("circle").setAttribute("cy", String(y));
  }
  element.setAttribute(
    "aria-label",
    `トルクの概念図。横軸 ${scale.minAngle}°〜+${scale.maxAngle}°、縦軸は自動調節 ${forceLabel(scale.minForce)}〜${forceLabel(scale.maxForce)}。往路は橙の実線、復路は青の破線。現在の角度 ${angle.toFixed(1)}°`,
  );
}
