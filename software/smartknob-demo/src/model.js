export function timestamp(text) {
  const value = text.trim();
  if (!/^(?:\d+:)?\d{1,2}:\d{2}$/.test(value)) return null;
  const parts = value.split(":").map(Number);
  if (parts.at(-1) >= 60 || (parts.length === 3 && parts[1] >= 60)) return null;
  return parts.reduce((total, n) => total * 60 + n, 0);
}
export function markers(values, duration) {
  return [
    ...new Set(
      values
        .filter((n) => Number.isFinite(n) && n >= 0 && n < duration)
        .map(Math.round),
    ),
  ].sort((a, b) => a - b);
}
export function nearest(values, position) {
  return [...values]
    .sort((a, b) => Math.abs(a - position) - Math.abs(b - position) || a - b)
    .slice(0, 5)
    .sort((a, b) => a - b);
}
export function seekTime(position, fraction, detents, duration) {
  // Match the physical magnetic well with an exact timestamp, while allowing
  // continuous scrubbing between wells. One protocol position is one second.
  const value =
    detents.includes(position) && Math.abs(fraction) < 0.18
      ? position
      : position + fraction;
  return Math.max(0, Math.min(duration, value));
}
