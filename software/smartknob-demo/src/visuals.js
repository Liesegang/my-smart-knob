import { waveSamples, waveDomain, wrappedValue, forceAt } from "./haptics.js";
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
export function renderWave(element, preset, config) {
  const { min, max, forward, reverse } = waveSamples(config);
  const x = (value) => ((value - min) / (max - min)) * 360;
  const y = (force) => 50 - Math.tanh(force) * 42;
  const points = (samples) =>
    samples.map((p) => `${x(p.value)},${y(p.force)}`).join(" ");
  element.innerHTML = `${[0, 60, 120, 180, 240, 300, 360].map((x) => `<line x1="${x}" y1="2" x2="${x}" y2="98" stroke="#c9cbc0" stroke-dasharray="4 4"/>`).join("")}<line x1="0" y1="50" x2="360" y2="50" stroke="#c9cbc0"/><polyline points="${points(reverse)}" fill="none" stroke="#487781" stroke-width="2" stroke-dasharray="5 3"/><polyline points="${points(forward)}" fill="none" stroke="#e75c32" stroke-width="2"/><g class="wave-cursors">${[-360, 0, 360].map((offset) => `<g data-wave-cursor data-offset="${offset}"><line y1="0" y2="100" stroke="#161715" stroke-width="1"/><circle r="4" fill="#161715" stroke="#f4f3ef" stroke-width="1.5"/></g>`).join("")}</g>`;
}
export function updateWaveCursor(element, config, value, position) {
  const [min, max] = waveDomain(config);
  const wrapped = wrappedValue(value, min, max);
  const x = ((wrapped - min) / (max - min)) * 360;
  const y = 50 - Math.tanh(forceAt(value, position, config)) * 42;
  for (const cursor of element.querySelectorAll("[data-wave-cursor]")) {
    cursor.setAttribute(
      "transform",
      `translate(${x + Number(cursor.dataset.offset)},0)`,
    );
    cursor.querySelector("circle").setAttribute("cy", String(y));
  }
  element.setAttribute(
    "aria-label",
    `抵抗の概念図。往路は橙の実線、復路は青の破線。現在位置 ${value.toFixed(2)}`,
  );
}
