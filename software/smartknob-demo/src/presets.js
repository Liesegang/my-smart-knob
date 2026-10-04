// Themes adapted from firmware/src/interface_task.cpp. Strengths stay within
// the [0, 1] range recommended by proto/smartknob.proto.
export const presets = [
  {
    id: "free",
    name: "フリー",
    sound: "さらさら",
    tag: "引っ掛かりなく、どこまでも。",
    description:
      "目盛りも終わりもない自由な回転。ほかの感触と比べるための、いちばん素直な基準です。",
    width: 10,
    strength: 0,
    min: 0,
    max: -1,
    ticks: 0,
    unit: "∞",
    caption: "回転の制限なし",
  },
  {
    id: "coarse",
    name: "粗い",
    sound: "コトコト",
    tag: "一段ずつ、確かなクリック。",
    description:
      "大きな山をひとつ越えるたび、次の位置へ。12個の項目を選ぶような感触です。「細かい」と同じ強さで、間隔の違いを比べられます。",
    width: 30,
    strength: 0.65,
    min: 0,
    max: -1,
    ticks: 12,
    unit: "12",
    caption: "クリック / 1回転",
  },
  {
    id: "fine",
    name: "細かい",
    sound: "チリチリ",
    tag: "指先で刻む、小さなステップ。",
    description:
      "小さなクリックが連続する精密な操作感。「粗い」と強さの設定を揃え、ステップの間隔を5分の1にしています。",
    width: 6,
    strength: 0.65,
    min: 0,
    max: -1,
    ticks: 60,
    unit: "60",
    caption: "クリック / 1回転",
  },
  {
    id: "limit",
    name: "リミット",
    sound: "むにっ",
    tag: "なめらかな道の、両端に壁。",
    description:
      "途中はなめらか、端だけに弾力。壁に触れることで回せる範囲がわかります。柔らかい壁と硬い壁を比べてください。",
    width: 24,
    strength: 0,
    min: 0,
    max: 10,
    initial: 5,
    ticks: 11,
    unit: "0–10",
    caption: "回せる範囲",
    variants: ["柔らかい壁", "硬い壁"],
  },
  {
    id: "switch",
    name: "2値スイッチ",
    sound: "パチン",
    tag: "パチッと、切り替わる。",
    description:
      "OFFとON、ふたつの安定点。中間を越えると次の位置へ吸い寄せられる、物理スイッチの感触です。",
    width: 60,
    strength: 0.8,
    snap: 0.55,
    min: 0,
    max: 1,
    ticks: 2,
    unit: "2",
    caption: "OFF / ON",
  },
  {
    id: "spring",
    name: "ばね",
    sound: "びよん",
    tag: "ひねって、離すと、真ん中へ。",
    description:
      "左右にひねると中央へ引き戻されます。段付きでは、途中の段にそっと留まり、軽く動かすと中央へ戻る感触を試せます。",
    width: 60,
    strength: 0.01,
    min: 0,
    max: 0,
    ticks: 1,
    unit: "0",
    caption: "中央のホーム位置",
    variants: ["なめらか", "段付き"],
  },
  {
    id: "viscous",
    name: "重いダイヤル",
    sound: "ねっとり",
    tag: "細かな抵抗を、ゆっくりほどく。",
    description:
      "微細で強めのディテントによる近似です。本当の粘性ではなく、実機では「ざらざら」に感じる場合もあります。感触を確かめる実験枠です。",
    width: 2,
    strength: 0.8,
    min: 0,
    max: -1,
    ticks: 90,
    unit: "2°",
    caption: "微細な抵抗の間隔",
  },
  {
    id: "magnet",
    name: "磁石",
    sound: "すっ、ぴた",
    tag: "なめらかな道に、吸着点。",
    description:
      "特定の場所だけに、ぴたっと吸着。等間隔と不規則な並びで、目印の配置が手応えをどう変えるか比べてください。",
    width: 10,
    strength: 1.0,
    snap: 0.7,
    min: 0,
    max: 36,
    ticks: 36,
    detents: [0, 9, 18, 27, 36],
    unit: "5",
    caption: "磁気ディテント",
    variants: ["等間隔", "不規則"],
  },
];

export function presetConfig(preset, nonce, variant = 0) {
  const config = {
    position: preset.initial || 0,
    subPositionUnit: 0,
    positionNonce: nonce % 256,
    minPosition: preset.min,
    maxPosition: preset.max,
    positionWidthRadians: (preset.width * Math.PI) / 180,
    detentStrengthUnit: preset.strength,
    endstopStrengthUnit: 0.7,
    snapPoint: preset.snap || 1.1,
    snapPointBias: 0,
    detentPositions: [...(preset.detents || [])],
    text: `studio:${preset.id}:${nonce}`,
    ledHue: 20,
  };
  if (preset.id === "limit") config.endstopStrengthUnit = variant ? 0.9 : 0.35;
  if (preset.id === "spring") {
    config.endstopStrengthUnit = 0.5;
    if (variant)
      Object.assign(config, {
        minPosition: -6,
        maxPosition: 6,
        positionWidthRadians: Math.PI / 6,
        detentStrengthUnit: 0.7,
        snapPoint: 0.55,
        snapPointBias: 0.4,
      });
  }
  if (preset.id === "magnet" && variant)
    config.detentPositions = [0, 5, 17, 19, 36];
  return config;
}

export function neutralConfig(nonce = 0) {
  return { ...presetConfig(presets[0], nonce), text: `studio:idle:${nonce}` };
}
