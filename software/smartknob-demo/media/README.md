# Big Buck Bunny — ローカルデモ素材

この動画は **Big Buck Bunny / Blender Foundation** の Sunflower 版フルムービーです。
YouTubeの埋め込みを使わず、同梱の `big-buck-bunny.mp4` をPC上の開発サーバーから再生します。

- 原作・著作権表記: © 2008 Blender Foundation / [www.bigbuckbunny.org](https://peach.blender.org/)
- ライセンス: [Creative Commons Attribution 3.0](https://creativecommons.org/licenses/by/3.0/)
- 公式ライセンス説明: [Big Buck Bunny — About](https://peach.blender.org/about/)
- 公式配布一覧: [Blender demo / movies / BBB](https://download.blender.org/demo/movies/BBB/)
- 取得原版: [bbb_sunflower_1080p_30fps_normal.mp4.zip](https://download.blender.org/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip)
- 取得日: 2026-10-03

取得速度を改善するため、同じ配布アーカイブの一部をBlender配布ミラーから取得しました。

- [Aliyun](https://mirrors.aliyun.com/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip)
- [Clarkson University](https://mirror.clarkson.edu/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip)
- [IU13](https://mirrors.iu13.net/blender/demo/movies/BBB/bbb_sunflower_1080p_30fps_normal.mp4.zip)

720p / 30fpsのH.264 + AACに再圧縮し、0.5秒ごとにキーフレームを配置しています。
MP4のメタデータを先頭に移動して、すぐに再生・シークできるようにしています。
物語、音声、尺は編集せず、原版の終幕クレジットをすべて保持しています。
Sunflower版の追加制作クレジットも動画内に保持しています。

同梱ファイルの検証値:

- 尺: 634.599秒（10分34.599秒）
- 解像度・フレームレート: 1280 × 720 / 30fps
- 動画: H.264 High、音声: AAC LC / 2ch
- サイズ: 77,813,682 bytes（約77.8 MB）
- キーフレーム: 1,270箇所、最大間隔0.5秒
- SHA-256: `3fe1f4bf8858009608a20c90e0c303e766066fef889c63704f2238feb568cc81`

元ZIPのCRC、変換後MP4の全編デコード、先頭のMP4メタデータ、キーフレーム間隔を検証済みです。

再変換コマンド（FFmpeg）:

```sh
ffmpeg -i bbb_sunflower_1080p_30fps_normal.mp4 \
  -map 0:v:0 -map 0:a:0 -vf scale=1280:720 \
  -c:v libx264 -preset fast -crf 27 -maxrate 900k -bufsize 1800k \
  -pix_fmt yuv420p -g 15 -keyint_min 15 -sc_threshold 0 \
  -c:a aac -b:a 96k -ac 2 -movflags +faststart \
  big-buck-bunny.mp4
```

動画素材のライセンスはアプリ本体のライセンスと独立しています。
本作品の作者がSmartKnob Demoを推奨していることを意味するものではありません。
