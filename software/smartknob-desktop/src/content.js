export const BROWSER_TABS = [
  {
    id: "journal",
    title: "川沿いの散歩",
    url: "fieldnotes.local/journal/river",
    type: "article",
    heading: "川沿いを、駅から橋まで。",
    paragraphs: [
      "駅の北口を出て、商店街を抜けると川に出る。橋を渡らずに右へ曲がると、車の通らない遊歩道が続いている。",
      "桜の季節が過ぎたあとの並木は、人が少なくて歩きやすい。途中のベンチで水を飲み、対岸のグラウンドをしばらく眺めた。",
      "二つ目の橋まで約20分。帰りは一本内側の道を通り、角のパン屋で昼食を買う。遠くへ行かなくても、道を一本変えるだけでよい散歩になる。",
    ],
    items: [
      { title: "距離", detail: "往復 2.8 km" },
      { title: "所要時間", detail: "寄り道を含めて約50分" },
      { title: "出発", detail: "北口の時計台" },
    ],
  },
  {
    id: "gallery",
    title: "週末の写真",
    url: "fieldnotes.local/photos",
    type: "gallery",
    heading: "週末の写真",
    paragraphs: ["散歩で見つけた色と形。あとで見返すための小さなアルバム。"],
    items: [
      { title: "朝の窓", detail: "07:42 · 自宅", color: "#d3b47e" },
      { title: "川の向こう", detail: "10:18 · 遊歩道", color: "#8caaa7" },
      { title: "古い橋", detail: "10:31 · 北橋", color: "#9c9991" },
      { title: "パン屋の前", detail: "11:04 · 商店街", color: "#bc8e73" },
    ],
  },
  {
    id: "schedule",
    title: "土曜日の予定",
    url: "fieldnotes.local/calendar/saturday",
    type: "schedule",
    heading: "土曜日の予定",
    paragraphs: ["午後は空けておく。移動の合間に、少し余裕を。"],
    items: [
      { time: "09:00", title: "買い物", detail: "市場で野菜と果物" },
      { time: "10:30", title: "川沿いを散歩", detail: "北口の時計台から" },
      { time: "12:00", title: "昼食", detail: "パンとスープ" },
      { time: "15:00", title: "本を返す", detail: "市立図書館 · 2冊" },
    ],
  },
  {
    id: "notes",
    title: "持ちものメモ",
    url: "fieldnotes.local/notes/weekend",
    type: "notes",
    heading: "出かける前に",
    paragraphs: ["荷物は小さな鞄に入る分だけ。帰りに買うものの場所も残しておく。"],
    items: [
      { title: "水筒", detail: "出発前に水を入れる" },
      { title: "折りたたみ傘", detail: "夕方は雨の予報" },
      { title: "返却する本", detail: "机の右端に2冊" },
      { title: "買い物袋", detail: "鞄の内ポケット" },
    ],
  },
];

export const REVIEW_FILES = [
  {
    path: "src/timer.js",
    language: "javascript",
    hunks: [
      {
        title: "残り時間を実際の経過時間から求める",
        oldStart: 12,
        newStart: 12,
        lines: [
          { type: "context", text: "function updateTimer(now) {" },
          { type: "remove", text: "  remaining -= 1;" },
          { type: "add", text: "  remaining = Math.max(0, (deadline - now) / 1000);" },
          { type: "context", text: "  renderTime(remaining);" },
          { type: "context", text: "}" },
        ],
      },
      {
        title: "再開時に終了時刻を更新する",
        oldStart: 29,
        newStart: 29,
        lines: [
          { type: "context", text: "function resume(now) {" },
          { type: "add", text: "  deadline = now + remaining * 1000;" },
          { type: "context", text: "  running = true;" },
          { type: "context", text: "}" },
        ],
      },
      {
        title: "終了時に表示が負にならないようにする",
        oldStart: 43,
        newStart: 44,
        lines: [
          { type: "context", text: "function formatTime(seconds) {" },
          { type: "remove", text: "  const value = Math.floor(seconds);" },
          { type: "add", text: "  const value = Math.ceil(Math.max(0, seconds));" },
          { type: "context", text: "  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;" },
          { type: "context", text: "}" },
        ],
      },
    ],
  },
  {
    path: "src/theme.css",
    language: "css",
    hunks: [
      {
        title: "キーボード操作中のフォーカスを見やすくする",
        oldStart: 18,
        newStart: 18,
        lines: [
          { type: "remove", text: "button:focus { outline: none; }" },
          { type: "add", text: "button:focus-visible {" },
          { type: "add", text: "  outline: 2px solid var(--accent);" },
          { type: "add", text: "  outline-offset: 3px;" },
          { type: "add", text: "}" },
        ],
      },
      {
        title: "時間表示の桁幅を揃える",
        oldStart: 61,
        newStart: 65,
        lines: [
          { type: "context", text: ".timer-value {" },
          { type: "context", text: "  font-size: 64px;" },
          { type: "add", text: "  font-variant-numeric: tabular-nums;" },
          { type: "context", text: "}" },
        ],
      },
    ],
  },
  {
    path: "README.md",
    language: "markdown",
    hunks: [
      {
        title: "一時停止と再開の操作を追記する",
        oldStart: 8,
        newStart: 8,
        lines: [
          { type: "context", text: "## 使い方" },
          { type: "context", text: "1. 時間を設定します。" },
          { type: "context", text: "2. 開始ボタンを押します。" },
          { type: "add", text: "3. もう一度押すと一時停止し、再度押すと続きから再開します。" },
        ],
      },
      {
        title: "別の画面でもタイマーが続くことを明記する",
        oldStart: 17,
        newStart: 18,
        lines: [
          { type: "context", text: "## 補足" },
          { type: "remove", text: "タイマー画面を開いたままにしてください。" },
          { type: "add", text: "アプリ内の別の画面へ移動しても、タイマーは進みます。" },
          { type: "add", text: "ページを再読み込みすると、設定は初期状態に戻ります。" },
        ],
      },
    ],
  },
];

export const READER_CHAPTERS = [
  { page: 0, title: "道具を揃える" },
  { page: 3, title: "一杯を淹れる" },
  { page: 6, title: "片づけと記録" },
];

export const READER_PAGES = [
  {
    number: 1, chapter: 0, title: "家で淹れるコーヒー",
    paragraphs: [
      "一杯分のコーヒーを、落ち着いて淹れる。そのための短い手順をまとめました。いつもの豆と、手元にある道具で始められます。",
      "ここではコーヒー豆15g、お湯250gを目安にします。味は豆の種類や焙煎によって変わるので、飲んだあとに少しずつ調整してください。",
    ],
  },
  {
    number: 2, chapter: 0, title: "必要なもの",
    paragraphs: [
      "ドリッパー、ペーパーフィルター、カップ、湯を注ぐポットを用意します。重さを量れるスケールと、時間を見る時計があると、同じ手順を繰り返しやすくなります。",
      "豆を挽く場合は、中細挽きから試します。挽き目を変えたら、ほかの条件はなるべく同じにして、味の違いを比べます。",
    ],
  },
  {
    number: 3, chapter: 0, title: "淹れる前の準備",
    paragraphs: [
      "フィルターをドリッパーに沿わせ、湯を通します。紙を湿らせると同時に、ドリッパーとカップを温めるためです。通した湯は捨てます。",
      "粉を入れ、軽く揺すって表面を平らにします。カップごとスケールに載せ、表示をゼロに戻します。時計も手元に置いておきましょう。",
    ],
  },
  {
    number: 4, chapter: 1, title: "最初の30秒",
    paragraphs: [
      "時計をスタートし、粉全体が湿るように約30gの湯を注ぎます。勢いよく注がず、乾いている部分が残らないようにします。",
      "そのまま30秒ほど待ちます。豆によっては表面が膨らみますが、膨らみの大きさだけで味の良し悪しは決まりません。",
    ],
  },
  {
    number: 5, chapter: 1, title: "少しずつ湯を注ぐ",
    paragraphs: [
      "中心から小さな円を描くように湯を注ぎ、合計150gまで増やします。フィルターの外周へ直接湯をかけるのは避けます。",
      "水面が少し下がったら、合計250gになるまで注ぎます。注ぐ勢いを揃えると、毎回の違いを見つけやすくなります。",
    ],
  },
  {
    number: 6, chapter: 1, title: "味を確かめる",
    paragraphs: [
      "湯が落ちたらドリッパーを外し、カップを軽く揺すって濃さを均一にします。熱いときと、少し冷めたときの両方を飲んでみます。",
      "濃すぎると感じたら、次は少量だけ湯を増やします。薄い場合は豆を増やすなど、一度に変える条件を一つに絞ります。",
    ],
  },
  {
    number: 7, chapter: 2, title: "道具を片づける",
    paragraphs: [
      "使用したフィルターを捨て、ドリッパーとカップを洗います。コーヒーの油分が残ることがあるので、水で流すだけで済ませず、道具に合う方法で洗って乾かします。",
      "豆の袋は空気を抜いて閉じ、直射日光の当たらない場所へ。器具をしまう前に水気を拭いておけば、次もすぐに使えます。",
    ],
  },
  {
    number: 8, chapter: 2, title: "次の一杯のために",
    paragraphs: [
      "豆の名前、豆と湯の重さ、かかった時間を書き残します。感想は「少し濃い」「冷めると甘い」など、自分に分かる短い言葉で十分です。",
      "次に変えることを一つだけ決めておきます。好みの一杯が見つかったら、その記録を基準にしましょう。",
    ],
  },
];

export const ZOOM_LEVELS = [25, 50, 75, 100, 125, 150, 200, 300, 400];
export const INPUT_FIELDS = ["rating", "priority", "quantity"];
export const PRIORITY_LABELS = ["なし", "低", "中", "高"];
