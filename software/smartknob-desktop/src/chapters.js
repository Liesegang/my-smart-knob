export const VIDEO_FPS = 30;

// The same demonstration landmarks as SmartKnob Demo, not official chapters.
export const VIDEO_CHAPTERS = [
  { time: 0, label: "オープニング" },
  { time: 30, label: "森のすみか" },
  { time: 83, label: "草原のバニー" },
  { time: 150, label: "木の上のいたずら" },
  { time: 296, label: "木陰の3匹" },
  { time: 360, label: "丸太の罠" },
  { time: 450, label: "杭の罠" },
  { time: 540, label: "エンドクレジット" },
].map((chapter) => ({ ...chapter, frame: chapter.time * VIDEO_FPS }));

// Stronger than the original video's 0.6, within the firmware's 0..1 range.
export const VIDEO_CHAPTER_SNAP_STRENGTH = 0.95;
