// Shared physical angle and normalized P-output axes for every preset.
export const waveAxes = Object.freeze({
  minAngle: -240,
  maxAngle: 240,
  minForce: -1,
  maxForce: 1,
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
  return Math.max(waveAxes.minForce, Math.min(waveAxes.maxForce, force));
}
function waveCenter(config) {
  return config.minPosition <= config.maxPosition
    ? (config.minPosition + config.maxPosition) / 2
    : 0;
}
export function waveAngle(value, config) {
  return (value - waveCenter(config)) * config.positionWidthRadians * 180 / Math.PI;
}
export function waveDomain(config) {
  const width = config.positionWidthRadians * 180 / Math.PI;
  return [waveAxes.minAngle, waveAxes.maxAngle].map(
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
  return { min, max, forward: branch(1), reverse: branch(-1) };
}
export function shuttleSpeed(value) {
  const magnitude = Math.max(0, Math.abs(value) - 0.12);
  if (!magnitude) return 0;
  return Math.sign(value) * Math.min(32, 2 ** magnitude - 1);
}
