import React, { useState } from 'react';
import { Glyph, RangeControl, setValue } from './shared.jsx';

const PARAMETERS = [
  { key: 'exposure', label: '露出', icon: 'sun', min: -30, max: 30, standard: 0, ticks: ['−3.0', '0.0', '+3.0'], format: (n) => `${n > 0 ? '+' : ''}${(n / 10).toFixed(1)} EV` },
  { key: 'saturation', label: '彩度', icon: 'palette', min: 0, max: 200, standard: 100, ticks: ['0', '100', '200'], format: (n) => `${n}%` },
  { key: 'temperature', label: '色温度', icon: 'temperature', min: 20, max: 100, standard: 65, ticks: ['2000', '6500', '10000'], format: (n) => `${n * 100} K` },
];

export default function PhotoApp({ state, dispatch }) {
  const [grid, setGrid] = useState(true);
  const current = PARAMETERS.find((item) => item.key === state.parameter);
  const set = (key, value) => setValue(dispatch, 'photo', key, value);
  const temperatureOffset = state.temperature - 65;
  return <div className="app-photo">
    <div className="app-photo-toolbar">
      <span className="app-photo-filename">coast.png</span>
      <button className={`app-tool-button ${grid ? 'is-active' : ''}`} onClick={() => setGrid(!grid)} aria-label="グリッド表示" aria-pressed={grid}><Glyph name="grid" /></button>
      <button className="app-plain-button" onClick={() => PARAMETERS.forEach((parameter) => set(parameter.key, parameter.standard))}><Glyph name="reset" size={16} />元に戻す</button>
    </div>
    <div className="app-photo-parameter-tabs">{PARAMETERS.map((parameter) => <button key={parameter.key} className={state.parameter === parameter.key ? 'is-active' : ''} onClick={() => set('parameter', parameter.key)} aria-pressed={state.parameter === parameter.key}><Glyph name={parameter.icon} size={21} /><span>{parameter.label}</span></button>)}</div>
    <div className="app-photo-canvas">
      <img src="/coast.png" alt="夕暮れの海岸と崖" draggable="false" style={{ filter: `brightness(${2 ** (state.exposure / 10)}) saturate(${state.saturation / 100})` }} />
      <div className="app-photo-temperature" style={{ background: temperatureOffset < 0 ? '#ffc15c' : '#669bff', opacity: Math.abs(temperatureOffset) / 100 }} />
      {grid ? <div className="app-photo-grid" aria-hidden="true"><i /><i /><i /><i /></div> : null}
    </div>
    <aside className="app-photo-inspector">{PARAMETERS.map((parameter) => <RangeControl key={parameter.key} label={parameter.label} valueLabel={parameter.format(state[parameter.key])} value={state[parameter.key]} min={parameter.min} max={parameter.max} standard={parameter.standard} active={state.parameter === parameter.key} onSelect={() => set('parameter', parameter.key)} onChange={(value) => set(parameter.key, value)} ticks={parameter.ticks} />)}</aside>
    <div className="app-photo-footer"><span>ノブ：<strong>{current.label}</strong></span><span>{current.format(current.min)} ～ {current.format(current.max)}</span></div>
  </div>;
}
