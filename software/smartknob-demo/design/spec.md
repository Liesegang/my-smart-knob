# SmartKnob Demo design

Built-in imagegen concept: concept.png. Brief: complete Japanese hands-on haptics studio; six themed presets, functional circular dial, resistance diagram, YouTube chapter-seek continuation. No raster UI assets shipped.

Tokens: background #f4f3ef, text #161715, accent #e75c32, border #d0d0c9, selected #f2e3d9. System sans-serif Japanese typography, 64px desktop headline, 28px brand, 18px controls, 14px captions. Flat editorial layout, ruled preset rail, open dial canvas, ruled parameter pair, no card grid. Header 80px; page horizontal gutter 42px; three columns 28%/40%/32%. Desktop-only; no mobile layout.

Copy: SmartKnob Demo; ハプティクス; YouTube; USBで接続; 感触を、デザインする。; 回して、比べて、手でわかる。; 粗い; 細かい; 粘っこい; リミット; 2値スイッチ; 磁石; 動画の時間に、触れる。; YouTubeデモへ.

Necessary functional additions: connection status/disconnect, exact preset explanations, accessible controls, error messages, YouTube tab selector and manual timestamps. YouTube detail view follows same tokens, with chapter timeline and settings. Diagrams are live SVG (not generated raster assets); waveform is explicitly illustrative, not measured force. Native protocol does not expose viscosity, so viscous approximation is disclosed.

## User-directed revisions

The user approved eight themes, then requested keyboard switching, live wrapped waveform cursors and two hysteresis branches. They replaced the Chrome extension with a standalone Web Serial app, chose the embedded Big Buck Bunny video, requested position and speed control, and explicitly required completely separate tabs. The app name is now SmartKnob Demo. These changes supersede the original concept copy and lower YouTube strip; there is no cross-promotion strip in the final haptics tab. The YouTube screenshot is the original layout reference; the video player and mode controls are required functional additions. Both concepts remain historical design references, not screenshots of the final app.


## ローカル動画への変更（2026-10-03）

ネットワークのロード待ちを避けるため、YouTube埋め込みを廃止。公式配布のBig Buck Bunnyをローカル同梱し、HTML動画要素と独自操作UIへ置換。タブ名は「動画デモ」、URLは `#video`（旧 `#youtube` も対応）。吸着付き位置操作、中央停止の速度操作、ハプティクスとの完全なタブ分離を維持。
