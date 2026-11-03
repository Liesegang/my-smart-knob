# スタンドアローン・デモ

USB電源だけで起動します。PC・Webアプリとの接続は不要です。
`platformio.ini` の既定環境は `standalone_custom_esp32s3` です。

## 操作

実測した3つのボタンを使います。押して離すと1回だけ動作し、押し続けても連続切替しません。

| GPIO | 操作 |
| --- | --- |
| 18 | 前のデモ。1番から戻ると8番へ |
| 16 | バリエーション切替 |
| 7 | 次のデモ。8番の次は1番へ |

バリエーションはリミットの柔らかい壁／硬い壁、ばねのなめらか／段付き、磁石の等間隔／不規則です。
他のデモでは中央ボタンを押しても位置をリセットしません。
起動時に押されているボタンは、いったん離すまで無視します。

## デモと表示

Web版 `software/smartknob-demo/src/presets.js` と `feel.js` を元に、8種類すべてを実装しています。

1. フリー
2. 粗いクリック（30°）
3. 細かいクリック（6°）
4. リミット（0〜10）
5. 2値スイッチ（OFF / ON）
6. ばね
7. 重いダイヤル（2°の微細なディテントによる近似）
8. 磁石（5か所の吸着点）

ダイヤルは `visuals.js` の描画をTFT向けに移植し、明るい背景、二重の円、橙色の針、目盛り、数値、ばねの線を実際の位置に合わせて描きます。
画面上部にデモ番号と英語名、下部にバリエーション名を表示します。
16ビットのフレームバッファを確保できない場合は8ビットへ切り替えます。
時計回りに回すと表示の針と数値が正方向へ進む設定です。

設定をWeb版から更新する場合:

```powershell
node scripts/generate_demo_presets.mjs
node scripts/generate_demo_presets.mjs --check
```

## 実機の設定

ESP32-S3、フラッシュ16MB。元のフラッシュの初期化コードと起動ログから以下を復元しています。

| 用途 | 設定 |
| --- | --- |
| モーター6PWM | UH=1, UL=41, VH=2, VL=39, WH=42, WL=40 |
| 角度センサー | AS5600、TCA9548のチャネル0、SDA=12、SCL=11 |
| ディスプレイ | ILI9341、320×240、rotation=1 |
| TFT SPI | MOSI=48, MISO=10, SCLK=47, CS=13, DC=21, RST=14 |

元のモーター校正値は保存領域から読み込みます。デモ切替では校正処理やフラッシュ書き込みを行いません。
WebアプリとUSB接続中はWeb側が制御権を持ち、3つのボタンはWeb側の前のデモ／バリエーション／次のデモを操作します。
デバイスはWebが返した設定を使うため、画面と感触を別々に切り替えません。
「切断」すると直前のデモ・バリエーション・位置を引き継いで単体操作に戻ります。
タブの終了や通信断では、Webからの更新が5秒間途絶えると同じように戻ります。
ボタン通知はセッションID・連番・確認応答で管理し、再送による二重操作や再接続前の古い通知を防ぎます。

## ビルド・書き込み

リポジトリのルートで実行します。今回用意した仮想環境とビルドツールは作業フォルダー内にあります。

```powershell
$env:PLATFORMIO_CORE_DIR = Join-Path (Get-Location) '.pio-core'
./.venv-firmware/Scripts/python.exe -m platformio run -e standalone_custom_esp32s3
```

実機の既存パーティションではアプリの開始位置が `0x10000` です。ブートローダー、パーティション表、校正値を保持してアプリだけを書き込むコマンド:

```powershell
./.venv-firmware/Scripts/python.exe -m esptool --port COM5 --baud 460800 write-flash 0x10000 .pio/build/standalone_custom_esp32s3/firmware.bin
```

## 元のファームウェアのバックアップ

変更前の16MB全体は `firmware/backups/esp32s3-806599b8b7a4-before-standalone-20261103.bin` に保存しています。
SHA-256は `17892d9b2c9da3bc8f88c0492415c4c794e354669ed79d41868d859f33988549` です。
同名のJSONにパーティションとハッシュの記録があります。バックアップはGit管理対象外です。

復元が必要な場合は、対象実機とCOM番号を確認して次を実行します。

```powershell
./.venv-firmware/Scripts/python.exe -m esptool --port COM5 --baud 460800 write-flash 0 firmware/backups/esp32s3-806599b8b7a4-before-standalone-20261103.bin
```

## 診断

`button_probe_esp32s3` はモーター制御を含まない診断環境です。
調査で使った入力ログは `firmware/diagnostics/` に保存されています。
この診断ファームウェアでは4つの入力のデバウンス・長押し時の単発動作・起動時の押しっぱなし・タイマー周回の自己テストも実行し、`SELFTEST buttons PASS` を出力します。
ボタン探索は終了し、製品用デモは上記3入力に固定しています。

## 検証結果（2026-11-03）

- `standalone_custom_esp32s3` のビルド成功、COM5へ書き込み・ハッシュ検証済み。
- 既存のSpaceコマンドで8種類すべてを一周し、クラッシュなし。画面のスタックの最小空き値は4232。
- Web版から生成する8種類と全バリエーションの設定一致を確認。
- 診断用ファームウェアのボタン自己テストは `SELFTEST buttons PASS`。
- 操作者が明るい背景、回転方向、戻るボタンの長押し時の安定性、3ボタン操作を実機で確認済み。
- 実機ログでばねの両バリエーションの切替と位置更新も確認。
- 保存済みモーター校正値（7極対・offset=7.55・CW）を引き継いで起動。

8種類を実機で再確認するコマンド（全種類を切り替え、最後に元のデモへ戻ります）:

```powershell
./.venv-firmware/Scripts/python.exe scripts/check_standalone_device.py --port COM5
```

自動確認のログは `firmware/backups/standalone-smoke.jsonl`、操作者による確認中のログは `firmware/backups/standalone-manual-check.jsonl` に保存されています。

Web接続の制御権・切断時の位置引継ぎ・通信断・再接続を実機で再確認するコマンド（Webアプリの接続を閉じてから実行）:

```powershell
./.venv-firmware/Scripts/python.exe scripts/check_web_control_device.py --port COM5
```
