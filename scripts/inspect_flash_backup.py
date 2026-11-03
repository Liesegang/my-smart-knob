"""Describe a raw ESP32 flash backup and preserve a hash beside it."""
import argparse
import hashlib
import json
from pathlib import Path
import struct


def c_string(value):
    return value.split(b"\0", 1)[0].decode("utf-8", errors="replace")


def inspect(path):
    data = path.read_bytes()
    report = {"file": path.name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest(), "partitions": []}
    for address in range(0x8000, 0x9000, 32):
        magic, kind, subtype, offset, size, label, flags = struct.unpack_from("<HBBII16sI", data, address)
        if magic != 0x50AA:
            break
        partition = {"label": c_string(label), "type": kind, "subtype": subtype, "offset": hex(offset), "size": hex(size)}
        if kind == 0 and data[offset] == 0xE9:
            descriptor = offset + 32
            if struct.unpack_from("<I", data, descriptor)[0] == 0xABCD5432:
                partition["application"] = {
                    "version": c_string(data[descriptor + 16:descriptor + 48]),
                    "project": c_string(data[descriptor + 48:descriptor + 80]),
                    "time": c_string(data[descriptor + 80:descriptor + 96]),
                    "date": c_string(data[descriptor + 96:descriptor + 112]),
                    "idf": c_string(data[descriptor + 112:descriptor + 144]),
                }
        report["partitions"].append(partition)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("backup", type=Path)
    args = parser.parse_args()
    report = inspect(args.backup)
    output = json.dumps(report, indent=2, ensure_ascii=False)
    args.backup.with_suffix(".json").write_text(output + "\n", encoding="utf-8")
    print(output)
