"""Record switch-probe events without resetting the USB device on open."""
import argparse
import datetime
import json
from pathlib import Path
import re
import time

import serial


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default="COM5")
    parser.add_argument("--seconds", type=float, default=45)
    parser.add_argument("--command", choices=["s", "u", "d", "f"], default="s")
    parser.add_argument("--log", type=Path)
    args = parser.parse_args()
    log_path = args.log or Path("firmware/diagnostics") / (
        "buttons-" + datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + ".jsonl"
    )
    log_path.parent.mkdir(parents=True, exist_ok=True)
    port = serial.Serial(port=None, baudrate=115200, timeout=0.2)
    port.dtr = False
    port.rts = False
    port.port = args.port
    events = []
    try:
        port.open()
        port.write(args.command.encode("ascii"))
        print(f"Recording {args.port} for {args.seconds:g}s -> {log_path}", flush=True)
        deadline = time.monotonic() + args.seconds
        with log_path.open("w", encoding="utf-8") as log:
            last_snapshot = 0
            while time.monotonic() < deadline:
                try:
                    line = port.readline().decode("utf-8", errors="replace").strip()
                except serial.SerialException as error:
                    log.write(json.dumps({"event": "USB_DISCONNECTED", "error": str(error)}) + "\n")
                    print("USB disconnected; recording stopped.", flush=True)
                    break
                if not line:
                    continue
                record = {"time": datetime.datetime.now().astimezone().isoformat(), "line": line}
                log.write(json.dumps(record, ensure_ascii=False) + "\n")
                log.flush()
                if line.startswith("CHANGE"):
                    events.append(line)
                    print(line, flush=True)
                elif time.monotonic() - last_snapshot >= 10 or "ready" in line:
                    print(line, flush=True)
                    last_snapshot = time.monotonic()
        print(f"Finished: {len(events)} debounced transitions.", flush=True)
        for pin in sorted(set(re.findall(r"GPIO(\d+)=", " ".join(events))), key=int):
            print(f"GPIO{pin}: " + ", ".join(re.findall(rf"GPIO{pin}=([01])", " ".join(events))))
    finally:
        port.close()


if __name__ == "__main__":
    main()
