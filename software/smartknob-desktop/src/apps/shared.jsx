import React from 'react';

export function setValue(dispatch, app, key, value) {
  dispatch({ type: 'set', app, key, value });
}

export function timeText(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function Glyph({ name, size = 18, ...props }) {
  const paths = {
    play: <path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M8 5v14M16 5v14" strokeWidth="4" /></>,
    reset: <><path d="M4 9a8 8 0 1 1 0 6M4 4v5h5" /></>,
    grid: <><rect x="4" y="4" width="16" height="16" rx="1" /><path d="M9.3 4v16M14.6 4v16M4 9.3h16M4 14.6h16" /></>,
    sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></>,
    palette: <><path d="M20 13c-1 4-5 1-5 4s-4 5-8 2S2 10 6 6s12-2 14 3Z" /><circle cx="8" cy="9" r=".7" /><circle cx="13" cy="7" r=".7" /><circle cx="17" cy="10" r=".7" /></>,
    temperature: <><path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z" /><path d="M12 9v9" /></>,
    previous: <><path d="M6 5v14m13-14-10 7 10 7Z" /></>,
    next: <><path d="M18 5v14M5 5l10 7-10 7Z" /></>,
    volume: <><path d="m3 9 4 0 5-4v14l-5-4H3ZM16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    mute: <><path d="m3 9 4 0 5-4v14l-5-4H3ZM16 9l6 6m0-6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />,
    speaker: <><rect x="6" y="3" width="12" height="18" rx="2" /><circle cx="12" cy="8" r="1" /><circle cx="12" cy="15" r="3" /></>,
    headphones: <><path d="M4 14v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="12" width="4" height="8" rx="2" /><rect x="17" y="12" width="4" height="8" rx="2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || <circle cx="12" cy="12" r="8" />}</svg>;
}

export function RangeControl({ label, valueLabel, value, min, max, standard, active, onSelect, onChange, ticks, className = '' }) {
  const progress = (value - min) / (max - min) * 100;
  return <div className={`app-range-control ${active ? 'is-active' : ''} ${className}`} onPointerDown={onSelect}>
    <button className="app-range-heading" onClick={onSelect} aria-pressed={active}><span>{label}</span><strong>{valueLabel}</strong></button>
    <div className="app-slider-wrap">
      {standard != null ? <i className="app-standard-mark" style={{ left: `${(standard - min) / (max - min) * 100}%` }} title="標準値" /> : null}
      <input type="range" min={min} max={max} step="1" value={value} aria-label={label} style={{ '--progress': `${progress}%` }} onFocus={onSelect} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
    {ticks ? <div className="app-range-ticks">{ticks.map((text) => <span key={text}>{text}</span>)}</div> : null}
  </div>;
}
