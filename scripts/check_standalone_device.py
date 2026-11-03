"""Exercise all eight local demos using the existing plaintext Space command."""
import argparse
import json
from pathlib import Path
import re
import time

import serial


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default="COM5")
    args = parser.parse_args()
    port = serial.Serial(port=None, baudrate=115200, timeout=0.1)
    port.dtr = False
    port.rts = False
    port.port = args.port
    modes = set()
    crashes = []
    health = []
    log_path = Path("firmware/backups/standalone-smoke.jsonl")
    with log_path.open("w", encoding="utf-8") as log:
        def receive(seconds):
            until = time.monotonic() + seconds
            while time.monotonic() < until:
                line = port.readline().decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                log.write(json.dumps({"line": line}) + "\n")
                log.flush()
                match = re.search(r"Demo (\d)/8:", line)
                if match:
                    modes.add(int(match[1]))
                    print(line, flush=True)
                if any(value in line for value in ["Guru Meditation", "panic'ed", "Stack canary", "CORRUPTED"]):
                    crashes.append(line)
                if "Dial running:" in line:
                    health.append(line)
                    print(line, flush=True)

        try:
            port.open()
            receive(6)
            for _ in range(8):
                port.write(b" ")
                receive(1.5)
            receive(3)
        finally:
            port.close()
    print(json.dumps({"modes": sorted(modes), "crashes": crashes, "display_health": health, "log": str(log_path)}, ensure_ascii=False))
    if modes != set(range(1, 9)) or crashes:
        raise SystemExit("Device smoke check failed; inspect the saved log.")
    print("PASS: all eight local demos responded without a recorded crash.")


if __name__ == "__main__":
    main()
