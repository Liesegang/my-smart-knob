export const DEMO = {
  id: "big-buck-bunny",
  src: "media/big-buck-bunny.mp4",
  title: "Big Buck Bunny · Blender Foundation",
  // Demonstration landmarks, not metadata claimed to be official chapters.
  scenes: [
    { time: 0, label: "オープニング" },
    { time: 30, label: "森のすみか" },
    { time: 83, label: "草原のバニー" },
    { time: 150, label: "木の上のいたずら" },
    { time: 296, label: "木陰の3匹" },
    { time: 360, label: "丸太の罠" },
    { time: 450, label: "杭の罠" },
    { time: 540, label: "エンドクレジット" },
  ],
};
DEMO.timestamps = DEMO.scenes.map((scene) => scene.time);
export class VideoPlayer {
  constructor(onError) {
    this.onError = onError;
    this.ready = false;
    this.pendingSeek = null;
  }
  mount(element = document.getElementById("player")) {
    if (this.player) return;
    this.player = element;
    element.addEventListener("loadedmetadata", () => {
      this.ready = Number.isFinite(element.duration) && element.duration > 0;
    });
    element.addEventListener("error", () => {
      this.ready = false;
      this.pendingSeek = null;
      this.onError("動画を読み込めません。media/big-buck-bunny.mp4 を確認して、ページを再読み込みしてください。");
    });
    element.addEventListener("seeked", () => {
      // Let the decoder finish each seek, retaining only the latest request.
      const target = this.pendingSeek;
      this.pendingSeek = null;
      if (target !== null) this.seek(target);
    });
    element.src = DEMO.src;
    element.load();
  }
  snapshot() {
    const duration = this.player?.duration;
    if (!this.ready || !Number.isFinite(duration) || duration <= 0) return null;
    return {
      id: DEMO.id,
      time: this.player.currentTime,
      duration,
      paused: this.player.paused,
      muted: this.player.muted,
      canShuttle: true,
      title: DEMO.title,
    };
  }
  seek(time) {
    const state = this.snapshot();
    if (!state || !Number.isFinite(time)) return;
    const target = Math.max(0, Math.min(state.duration, time));
    if (this.player.seeking) {
      this.pendingSeek = target;
    } else if (Math.abs(this.player.currentTime - target) > 0.001) {
      this.player.currentTime = target;
    }
  }
  cancelSeek() {
    this.pendingSeek = null;
  }
  pause() {
    this.player?.pause();
  }
  async play() {
    if (!this.ready) return;
    try {
      await this.player.play();
    } catch (error) {
      // A mode/tab change can cancel a pending play request normally.
      if (error.name !== "AbortError")
        this.onError("再生を開始できませんでした。再生ボタンをもう一度押してください。");
    }
  }
  toggleMute() {
    if (this.player) this.player.muted = !this.player.muted;
  }
}
