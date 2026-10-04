// Both axes fit the selected pattern and stay fixed while the knob turns.
export const waveAxes = Object.freeze({
  samples: 1920,
});

// Approximation of the firmware's P term, normalized by its output limit (10).
// This excludes PID derivative filtering, motor inertia and friction; it is not a
// measured torque curve. Both directional branches use the firmware snap rules.
export function advancePosition(position, value, config) {
  const bounded = config.minPosition <= config.maxPosition;
  for (let i = 0; i < 10000; i++) {
    const delta = value - position;
    const forward =
      config.snapPoint +
      (position >= 0 ? config.snapPointBias : -config.snapPointBias);
    const reverse =
      config.snapPoint +
      (position <= 0 ? config.snapPointBias : -config.snapPointBias);
    if (delta > forward && (!bounded || position < config.maxPosition))
      position++;
    else if (delta < -reverse && (!bounded || position > config.minPosition))
      position--;
    else break;
  }
  return position;
}
export function forceAt(value, position, config) {
  const delta = value - position;
  const outside =
    config.minPosition <= config.maxPosition &&
    ((position === config.minPosition && delta < 0) ||
      (position === config.maxPosition && delta > 0));
  const dead = Math.min(0.2, Math.PI / 180 / config.positionWidthRadians);
  const input = delta - Math.max(-dead, Math.min(dead, delta));
  if (
    !outside &&
    config.detentPositions.length &&
    !config.detentPositions.includes(position)
  )
    return 0;
  const force = -input * config.positionWidthRadians * 4 *
    (outside ? config.endstopStrengthUnit : config.detentStrengthUnit) / 10;
  // The firmware output limit is independent of the chart's zoom level.
  return Math.max(-1, Math.min(1, force));
}
function waveCenter(config) {
  return config.minPosition <= config.maxPosition
    ? (config.minPosition + config.maxPosition) / 2
    : 0;
}
export function waveAngle(value, config) {
  return (value - waveCenter(config)) * config.positionWidthRadians * 180 / Math.PI;
}
function niceCeiling(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    .find((step) => step >= value / magnitude - 1e-10);
  return Number((step * magnitude).toPrecision(3));
}
export function waveAngleRange(config) {
  const width = config.positionWidthRadians * 180 / Math.PI;
  const bounded = config.minPosition <= config.maxPosition;
  // Show about eight clicks, or the whole bounded travel with half a step
  // beyond each stop. A centered spring gets one full step to either side.
  const extent = bounded
    ? Math.max(width, (config.maxPosition - config.minPosition + 1) * width / 2)
    : config.detentStrengthUnit > 0 ? width * 4 : 180;
  const maxAngle = !bounded && config.detentStrengthUnit === 0 ? 180 : niceCeiling(extent);
  return { minAngle: -maxAngle, maxAngle };
}
export function waveDomain(config) {
  const width = config.positionWidthRadians * 180 / Math.PI;
  const { minAngle, maxAngle } = waveAngleRange(config);
  return [minAngle, maxAngle].map(
    (angle) => waveCenter(config) + angle / width,
  );
}
export function wrappedValue(value, min, max) {
  return ((((value - min) % (max - min)) + (max - min)) % (max - min)) + min;
}
export function waveSamples(config) {
  const [min, max] = waveDomain(config);
  function branch(direction) {
    let position =
      direction > 0
        ? Math.floor(min - config.snapPoint - 1)
        : Math.ceil(max + config.snapPoint + 1);
    if (config.minPosition <= config.maxPosition)
      position = Math.max(
        config.minPosition,
        Math.min(config.maxPosition, position),
      );
    const points = [];
    for (let i = 0; i <= waveAxes.samples; i++) {
      const value =
        direction > 0
          ? min + ((max - min) * i) / waveAxes.samples
          : max - ((max - min) * i) / waveAxes.samples;
      position = advancePosition(position, value, config);
      points.push({ value, force: forceAt(value, position, config) });
    }
    return points;
  }
  const forward = branch(1), reverse = branch(-1);
  let peak = 0;
  for (const samples of [forward, reverse])
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample.force));
  // Fit both hysteresis branches with headroom, and keep zero in the middle.
  // Free rotation still needs a nonzero range. Recalculate on preset changes,
  // not cursor movement, so the axis stays still while the knob is turned.
  const padded = peak > 0 ? peak * 1.12 : 0.2;
  const maxForce = niceCeiling(padded);
  return { min, max, ...waveAngleRange(config), minForce: -maxForce, maxForce, forward, reverse };
}
export function shuttleSpeed(value) {
  const magnitude = Math.max(0, Math.abs(value) - 0.12);
  if (!magnitude) return 0;
  return Math.sign(value) * Math.min(32, 2 ** magnitude - 1);
}
