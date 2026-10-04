import React, { useEffect, useRef, useState } from 'react';
import { Glyph, RangeControl, setValue } from './shared.jsx';
import { VideoPlayback } from './videoPlayback.js';
import { VIDEO_CHAPTERS } from '../chapters.js';

const videoClock = (seconds) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;

export function VideoApp({ state, dispatch }) {
  const videoRef = useRef(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const playbackRef = useRef(null);
  const chapterListRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const playback = new VideoPlayback(videoRef.current, {
      onError: () => setError('再生ボタンをクリックして、動画を開始してください。'),
      onStopped: () => setValue(dispatch, 'video', 'playing', false),
    });
    playbackRef.current = playback;
    playback.seek(stateRef.current.frame / stateRef.current.fps);
    playback.setPlaying(stateRef.current.playing);
    return () => { playback.destroy(); playbackRef.current = null; };
  }, [dispatch]);
  useEffect(() => { playbackRef.current?.setPlaying(state.playing); }, [state.playing]);
  useEffect(() => {
    if (state.playing) return;
    playbackRef.current?.seek(state.frame / state.fps);
  }, [state.frame, state.fps, state.playing]);
  function seekFrame(frame) {
    stateRef.current = { ...stateRef.current, playing: false, frame };
    playbackRef.current?.setPlaying(false);
    playbackRef.current?.seek(frame / state.fps);
    setValue(dispatch, 'video', 'playing', false);
    setValue(dispatch, 'video', 'frame', frame);
  }
  function togglePlayback() {
    setError('');
    if (state.playing) {
      const frame = playbackRef.current?.pauseAtCurrentFrame(state.fps) ?? state.frame;
      stateRef.current = { ...stateRef.current, playing: false, frame };
      // Capture before changing playing so the hardware reanchor uses the paused frame.
      dispatch({ type: 'set', app: 'video', key: 'frame', value: frame, source: 'media' });
      setValue(dispatch, 'video', 'playing', false);
    } else setValue(dispatch, 'video', 'playing', true);
  }
  function ended() {
    const frame = Math.floor((videoRef.current?.currentTime ?? 0) * state.fps);
    stateRef.current = { ...stateRef.current, playing: false, frame };
    dispatch({ type: 'set', app: 'video', key: 'frame', value: frame, source: 'media' });
    setValue(dispatch, 'video', 'playing', false);
  }
  const seekLatest = () => playbackRef.current?.flush();
  function reportFrame() {
    const video = videoRef.current;
    if (!video || video.paused || video.seeking || !stateRef.current.playing) return;
    const frame = Math.floor(video.currentTime * stateRef.current.fps);
    if (frame !== stateRef.current.frame) dispatch({ type: 'set', app: 'video', key: 'frame', value: frame, source: 'media' });
  }
  const position = state.frame / state.fps;
  const currentChapterIndex = VIDEO_CHAPTERS.reduce((selected, chapter, index) => chapter.frame <= state.frame ? index : selected, 0);
  const currentChapter = VIDEO_CHAPTERS[currentChapterIndex];
  const atChapter = !state.playing && state.frame === currentChapter.frame;
  useEffect(() => {
    const list = chapterListRef.current;
    const item = list?.children[currentChapterIndex];
    if (!list || !item) return;
    if (item.offsetTop < list.scrollTop) list.scrollTop = item.offsetTop;
    else if (item.offsetTop + item.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = item.offsetTop + item.offsetHeight - list.clientHeight;
  }, [currentChapterIndex]);
  return <div className="app-video">
    <div className="app-video-main">
      <div className="app-video-stage">
        <video ref={videoRef} src="/media/big-buck-bunny.mp4" preload="auto" playsInline muted={muted} onLoadedMetadata={seekLatest} onSeeked={seekLatest} onTimeUpdate={reportFrame} onEnded={ended} onError={() => setError('動画を読み込めませんでした。ローカルの動画ファイルを確認してください。')} aria-label="Big Buck Bunny" />
        <div className="app-video-title"><span>BIG BUCK BUNNY</span><small>Blender Foundation · 30 fps</small></div>
      </div>
      <nav className="app-video-chapters" aria-label="動画のチャプター">
        <header><strong>チャプター</strong><span>{VIDEO_CHAPTERS.length}</span></header>
        <div className="app-video-chapter-list" ref={chapterListRef}>{VIDEO_CHAPTERS.map((chapter, index) => <button key={chapter.frame} className={`${index === currentChapterIndex ? 'is-current' : ''} ${!state.playing && state.frame === chapter.frame ? 'is-snapped' : ''}`} onClick={() => seekFrame(chapter.frame)} aria-current={index === currentChapterIndex ? 'step' : undefined} aria-label={`${chapter.label}、${videoClock(chapter.time)}へ移動`}>
          <span className="app-video-chapter-number">{String(index + 1).padStart(2, '0')}</span><span className="app-video-chapter-name">{chapter.label}<time>{videoClock(chapter.time)}</time></span><i aria-hidden="true" />
        </button>)}</div>
        <footer>デモ用の目印</footer>
      </nav>
    </div>
    <div className="app-video-controls">
      <div className="app-video-timeline">
        <div className="app-video-seekbar">
          <div className="app-video-chapter-markers">{VIDEO_CHAPTERS.map((chapter, index) => <button key={chapter.frame} className={`${index === currentChapterIndex ? 'is-current' : ''} ${!state.playing && state.frame === chapter.frame ? 'is-snapped' : ''}`} style={{ left: `${chapter.frame / 19037 * 100}%` }} onClick={() => seekFrame(chapter.frame)} aria-label={`${videoClock(chapter.time)}のチャプターマーカー`} title={`${videoClock(chapter.time)} · ${chapter.label}`}><i /></button>)}</div>
          <input type="range" aria-label="動画のフレーム位置" min="0" max="19037" step="1" value={state.frame} style={{ '--progress': `${state.frame / 19037 * 100}%` }} onChange={(event) => seekFrame(Number(event.target.value))} />
        </div>
        <div className="app-video-clock-row"><span>{videoClock(position)}<small>:{String(state.frame % state.fps).padStart(2, '0')}</small></span><span>{videoClock(state.duration)}</span></div>
      </div>
      <div className={`app-video-chapter-current ${atChapter ? 'is-snapped' : ''}`}><span aria-live="polite"><i /><small>{String(currentChapterIndex + 1).padStart(2, '0')}</small><strong>{currentChapter.label}</strong>{atChapter ? <em>章の先頭</em> : null}</span><small>チャプターで強く吸着</small></div>
      <div className="app-video-transport">
        <div><button className="app-tool-button" onClick={() => seekFrame(0)} aria-label="動画の先頭へ"><Glyph name="previous" /></button><button className="app-play-button" onClick={togglePlayback} aria-label={state.playing ? '動画を一時停止' : '動画を再生'}><Glyph name={state.playing ? 'pause' : 'play'} size={22} /></button><button className="app-tool-button" onClick={() => dispatch({ type: 'turn', app: 'video', delta: 1 })} aria-label="動画を1目盛り進める"><Glyph name="next" /></button></div>
        <div className="app-video-frame"><strong>{state.frame.toLocaleString()}<small> f</small></strong><span>{position.toFixed(3)} 秒</span></div>
        <button className="app-tool-button" onClick={() => setMuted(!muted)} aria-label={muted ? '動画の音声を有効にする' : '動画をミュート'} aria-pressed={!muted}><Glyph name={muted ? 'mute' : 'volume'} /></button>
      </div>
      <div className="app-video-mode"><span>ノブの送り幅</span><div className="app-segments"><button className={state.mode === 'fine' ? 'is-selected' : ''} onClick={() => setValue(dispatch, 'video', 'mode', 'fine')} aria-pressed={state.mode === 'fine'}>1 フレーム</button><button className={state.mode === 'coarse' ? 'is-selected' : ''} onClick={() => setValue(dispatch, 'video', 'mode', 'coarse')} aria-pressed={state.mode === 'coarse'}>1 秒</button></div><small>押して切替</small></div>
      {error ? <p className="app-media-message" role="status">{error}</p> : null}
      <footer className="app-video-credit">端末内の動画 · © 2008 Blender Foundation · CC BY 3.0</footer>
    </div>
  </div>;
}

/** Contexts are created only in an explicit browser gesture; hardware cannot unlock audio. */
function useAudioContext(app, playing, dispatch) {
  const contextRef = useRef(null);
  const [context, setContext] = useState(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; contextRef.current?.close(); };
  }, []);
  useEffect(() => {
    if (!playing) return;
    if (!contextRef.current || contextRef.current.state !== 'running') {
      setMessage('最初に画面の再生ボタンをクリックして、音声を有効にしてください。');
      setValue(dispatch, app, 'playing', false);
    }
  }, [app, dispatch, playing]);
  const toggle = async () => {
    if (playing) { setValue(dispatch, app, 'playing', false); return; }
    try {
      if (!contextRef.current || contextRef.current.state === 'closed') {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        contextRef.current = new AudioContext();
      }
      const next = contextRef.current;
      await next.resume();
      if (!mounted.current) return;
      if (next.state !== 'running') throw new Error('Audio context is not running');
      setContext(next);
      setMessage('');
      setValue(dispatch, app, 'playing', true);
    } catch {
      if (mounted.current) setMessage('音声を開始できませんでした。再生ボタンをもう一度クリックしてください。');
      setValue(dispatch, app, 'playing', false);
    }
  };
  return { context, message, toggle };
}

function tone(context, output, frequency, at, duration, gain = .05, type = 'triangle') {
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(gain, at + .008);
  envelope.gain.exponentialRampToValueAtTime(.0001, at + duration);
  oscillator.connect(envelope).connect(output);
  oscillator.start(at);
  oscillator.stop(at + duration + .03);
  oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
}

const MELODY = [261.63, 329.63, 392, 440, 392, 329.63, 293.66, 196, 261.63, 329.63, 392, 523.25, 440, 392, 329.63, 293.66];
export function MusicApp({ state, dispatch }) {
  const { context, message, toggle } = useAudioContext('music', state.playing, dispatch);
  const stateRef = useRef(state);
  stateRef.current = state;
  const masterRef = useRef(null);
  const [volume, setVolume] = useState(65);
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!context || !state.playing || context.state !== 'running') return;
    const master = context.createGain();
    master.gain.value = volume / 100;
    master.connect(context.destination);
    masterRef.current = master;
    let at = context.currentTime + .04;
    let step = 0;
    const schedule = () => {
      while (at < context.currentTime + .12) {
        const current = stateRef.current;
        const rate = current.rate / 100;
        const interval = 30 / (current.bpm * rate);
        tone(context, master, MELODY[step % MELODY.length] * rate, at, interval * .85, .085);
        if (step % 2 === 0) {
          tone(context, master, 130.81 * rate, at, interval * 1.5, .055, 'sine');
          tone(context, master, step % 8 === 0 ? 1200 : 800, at, .035, .035, 'sine');
        }
        setBeat(Math.floor(step / 2) % 4);
        step += 1;
        at += interval;
      }
    };
    schedule();
    const interval = window.setInterval(schedule, 30);
    return () => {
      window.clearInterval(interval);
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0, context.currentTime, .01);
      window.setTimeout(() => master.disconnect(), 180);
      masterRef.current = null;
    };
  }, [context, state.playing]);
  useEffect(() => { if (masterRef.current && context) masterRef.current.gain.setTargetAtTime(volume / 100, context.currentTime, .02); }, [volume, context]);
  const set = (key, value) => setValue(dispatch, 'music', key, value);
  return <div className="app-music"><div className="app-music-cover" aria-hidden="true"><div className={`app-record ${state.playing ? 'is-spinning' : ''}`}><span /><i /></div><div className="app-music-cover-type"><small>SMARTKNOB SESSIONS</small><strong>Practice<br />Loop 01</strong><span>C MAJOR / 4·4</span></div></div><div className="app-music-main"><div className="app-track-info"><div><h2>Practice Loop 01</h2><p>シンセサイザー · 端末内で生成</p></div><div className="app-beats" aria-label={`拍子 ${state.playing ? beat + 1 : '停止中'}`}>{[0, 1, 2, 3].map((index) => <i key={index} className={state.playing && beat === index ? 'is-active' : ''} />)}</div></div><div className="app-music-transport"><button className="app-tool-button" aria-label="調整中の項目を標準値に戻す" onClick={() => dispatch({ type: 'longPress', app: 'music' })}><Glyph name="reset" /></button><button className="app-play-button" aria-label={state.playing ? '音楽を停止' : '音楽を再生'} onClick={toggle}><Glyph name={state.playing ? 'pause' : 'play'} size={25} /></button><span className="app-music-effective">{(state.bpm * state.rate / 100).toFixed(1)} <small>BPM</small></span></div><div className="app-music-adjustments"><RangeControl label="再生速度" valueLabel={`${(state.rate / 100).toFixed(2)}×`} value={state.rate} min={50} max={150} standard={100} active={state.parameter === 'rate'} onSelect={() => set('parameter', 'rate')} onChange={(value) => set('rate', value)} ticks={['0.50×', '1.00×', '1.50×']} /><RangeControl label="テンポ" valueLabel={`${state.bpm} BPM`} value={state.bpm} min={40} max={200} standard={96} active={state.parameter === 'bpm'} onSelect={() => set('parameter', 'bpm')} onChange={(value) => set('bpm', value)} ticks={['40', '200']} /></div><label className="app-volume"><Glyph name="volume" size={16} /><input type="range" aria-label="音楽の音量" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><span>{volume}%</span></label>{message ? <p className="app-media-message" role="status">{message}</p> : <p className="app-media-footnote">再生速度は音程と速さ、テンポは速さだけを変えます。</p>}</div></div>;
}

export function AudioApp({ state, dispatch }) {
  const { context, message, toggle } = useAudioContext('audio', state.playing, dispatch);
  const pannerRef = useRef(null);
  const masterRef = useRef(null);
  const [volume, setVolume] = useState(45);
  useEffect(() => {
    if (!context || !state.playing || context.state !== 'running') return;
    const panner = context.createStereoPanner();
    const gain = context.createGain();
    panner.pan.value = state.pan / 10;
    gain.gain.value = volume / 100;
    gain.connect(panner).connect(context.destination);
    pannerRef.current = panner;
    masterRef.current = gain;
    let at = context.currentTime + .03;
    let note = 0;
    const schedule = () => {
      while (at < context.currentTime + .12) {
        tone(context, gain, [220, 277.18, 329.63, 277.18][note % 4], at, .38, .12, 'sine');
        tone(context, gain, [440, 554.37, 659.26, 554.37][note % 4], at, .18, .035, 'triangle');
        at += .5;
        note += 1;
      }
    };
    schedule();
    const interval = window.setInterval(schedule, 30);
    return () => { window.clearInterval(interval); gain.gain.setTargetAtTime(0, context.currentTime, .01); window.setTimeout(() => { gain.disconnect(); panner.disconnect(); }, 180); pannerRef.current = null; masterRef.current = null; };
  }, [context, state.playing]);
  useEffect(() => { if (pannerRef.current && context) pannerRef.current.pan.setTargetAtTime(state.pan / 10, context.currentTime, .035); }, [state.pan, context]);
  useEffect(() => { if (masterRef.current && context) masterRef.current.gain.setTargetAtTime(volume / 100, context.currentTime, .02); }, [volume, context]);
  const leftLevel = Math.cos((state.pan / 10 + 1) * Math.PI / 4);
  const rightLevel = Math.sin((state.pan / 10 + 1) * Math.PI / 4);
  return <div className="app-audio"><header><Glyph name="headphones" size={28} /><h2>左右のバランス</h2><p>ヘッドフォンで試聴すると、定位の変化がわかります。</p></header><div className="app-audio-space"><div className="app-audio-speaker"><Glyph name="speaker" size={47} /><strong>L</strong><div className="app-audio-meter"><i style={{ height: `${state.playing ? leftLevel * 100 : 0}%` }} /></div></div><div className="app-audio-pan-stage"><div className="app-audio-pan-line" /><span className="app-audio-center-line" /><div className={`app-audio-orb ${state.playing ? 'is-playing' : ''}`} style={{ left: `${(state.pan + 10) / 20 * 100}%` }} /><span className="app-audio-center-label">CENTER</span></div><div className="app-audio-speaker"><Glyph name="speaker" size={47} /><strong>R</strong><div className="app-audio-meter"><i style={{ height: `${state.playing ? rightLevel * 100 : 0}%` }} /></div></div></div><div className="app-audio-adjustment"><RangeControl label="定位" valueLabel={state.pan === 0 ? '中央' : `${state.pan < 0 ? 'L' : 'R'} ${Math.abs(state.pan) * 10}%`} value={state.pan} min={-10} max={10} standard={0} active onChange={(value) => setValue(dispatch, 'audio', 'pan', value)} onSelect={() => {}} ticks={['左 100%', '中央', '右 100%']} /></div><div className="app-audio-actions"><button className="app-plain-button" onClick={() => dispatch({ type: 'longPress', app: 'audio' })}><Glyph name="reset" size={15} />中央に戻す</button><button className="app-primary-button" onClick={toggle}><Glyph name={state.playing ? 'pause' : 'play'} size={16} />{state.playing ? '試聴を停止' : '試聴する'}</button></div><label className="app-volume"><Glyph name="volume" size={16} /><input type="range" aria-label="試聴の音量" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><span>{volume}%</span></label>{message ? <p className="app-media-message" role="status">{message}</p> : <p className="app-media-footnote">中央に吸着 · 左右の端にストッパー</p>}</div>;
}
