import React from 'react';
import PhotoApp from './PhotoApp.jsx';
import { BrowserApp, WindowsApp, ReviewApp, ReaderApp } from './ContentApps.jsx';
import { TimerApp, LightsApp, MapApp, InputApp } from './UtilityApps.jsx';
import { VideoApp, MusicApp, AudioApp } from './MediaApps.jsx';

const COMPONENTS = {
  browser: BrowserApp, windows: WindowsApp, timer: TimerApp, photo: PhotoApp,
  video: VideoApp, music: MusicApp, audio: AudioApp, lights: LightsApp,
  review: ReviewApp, reader: ReaderApp, map: MapApp, input: InputApp,
};

export default function AppContent({ id, apps, dispatch, onOpen, active }) {
  const Component = COMPONENTS[id];
  return Component ? <Component state={apps[id]} dispatch={dispatch} onOpen={onOpen} active={active} /> : null;
}
