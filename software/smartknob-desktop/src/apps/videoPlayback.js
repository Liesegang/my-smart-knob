/** Serialize native seeks and playback without losing the latest dial position. */
export class VideoPlayback {
  constructor(video, { onError = () => {}, onStopped = () => {} } = {}) {
    this.video = video;
    this.onError = onError;
    this.onStopped = onStopped;
    this.pendingSeek = null;
    this.playing = false;
    this.generation = 0;
    this.playRequest = null;
    this.destroyed = false;
  }

  seek(seconds) {
    if (this.destroyed || !Number.isFinite(seconds)) return;
    this.pendingSeek = Math.max(0, seconds);
    this.flush();
  }

  setPlaying(playing) {
    if (this.destroyed) return;
    if (this.playing !== playing) {
      this.generation += 1;
      this.playRequest = null;
    }
    this.playing = playing;
    if (!playing) this.video.pause();
    else this.flush();
  }

  /** Native currentTime is already the requested position during an in-flight seek. */
  position() {
    return this.pendingSeek ?? this.video.currentTime;
  }

  pauseAtCurrentFrame(fps) {
    const frame = Math.max(0, Math.floor((this.position() + 1e-7) * fps));
    this.setPlaying(false);
    this.seek(frame / fps);
    return frame;
  }

  /** Called after metadata or seeked; another native seek must finish before play. */
  flush() {
    const video = this.video;
    if (this.destroyed || video.readyState === 0 || video.seeking) return;
    if (this.pendingSeek !== null) {
      const requested = this.pendingSeek;
      const target = Number.isFinite(video.duration) ? Math.min(requested, Math.max(0, video.duration - .001)) : requested;
      this.pendingSeek = null;
      if (Math.abs(video.currentTime - target) > .01) {
        video.currentTime = target;
        // Even if a test double/browser clears seeking synchronously, wait for seeked.
        return;
      }
    }
    if (!this.playing || this.playRequest || !video.paused) return;
    const request = { generation: this.generation };
    this.playRequest = request;
    const failed = (error) => {
      if (this.destroyed || !this.playing || request.generation !== this.generation) return;
      this.playing = false;
      this.generation += 1;
      this.playRequest = null;
      if (error?.name !== 'AbortError') this.onError(error);
      this.onStopped();
    };
    try {
      Promise.resolve(video.play()).then(() => {
        if (this.playRequest === request) this.playRequest = null;
      }, failed);
    } catch (error) {
      failed(error);
    }
  }

  destroy() {
    this.destroyed = true;
    this.playing = false;
    this.generation += 1;
    this.pendingSeek = null;
    this.playRequest = null;
    this.video.pause();
  }
}
