"""Check Web ownership, position-preserving release, lease timeout and reconnect."""
import argparse
from pathlib import Path
import random
import struct
import sys
import time
import zlib

import serial

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "software/python/proto_gen"))
import smartknob_pb2 as PB


def encode(data):
    result = bytearray([0])
    start = 0
    count = 1
    for value in data:
        if value:
            result.append(value)
            count += 1
            if count < 255:
                continue
        result[start] = count
        start = len(result)
        result.append(0)
        count = 1
    result[start] = count
    return bytes(result) + b"\0"


def decode(data):
    result = bytearray()
    cursor = 0
    while cursor < len(data):
        count = data[cursor]
        if count == 0 or cursor + count > len(data):
            raise ValueError("Invalid COBS")
        result.extend(data[cursor + 1:cursor + count])
        cursor += count
        if count < 255 and cursor < len(data):
            result.append(0)
    return bytes(result)


class Device:
    def __init__(self, name):
        self.port = serial.Serial(port=None, baudrate=115200, timeout=0.05)
        self.port.dtr = self.port.rts = False
        self.port.port = name
        self.port.open()
        self.port.write(b"\0" * 8)
        self.buffer = bytearray()
        self.nonce = random.randrange(1, 0xFFFFFFFF)
        self.state = None
        self.acks = set()

    def read(self):
        self.buffer.extend(self.port.read(max(1, self.port.in_waiting)))
        while 0 in self.buffer:
            end = self.buffer.index(0)
            packet = bytes(self.buffer[:end])
            del self.buffer[:end + 1]
            try:
                raw = decode(packet)
                body, crc = raw[:-4], raw[-4:]
                if len(crc) != 4 or zlib.crc32(body) != struct.unpack("<I", crc)[0]:
                    continue
                message = PB.FromSmartKnob.FromString(body)
            except Exception:
                continue
            if message.HasField("ack"):
                self.acks.add(message.ack.nonce)
            elif message.HasField("smartknob_state"):
                self.state = message.smartknob_state
            elif message.HasField("log") and "control" in message.log.msg:
                print(message.log.msg, flush=True)

    def rpc(self, field, value):
        self.nonce = (self.nonce + 1) & 0xFFFFFFFF
        message = PB.ToSmartknob(protocol_version=1, nonce=self.nonce)
        getattr(message, field).CopyFrom(value)
        data = message.SerializeToString()
        packet = encode(data + struct.pack("<I", zlib.crc32(data)))
        for _ in range(6):
            self.port.write(packet)
            until = time.monotonic() + 0.3
            while time.monotonic() < until:
                self.read()
                if self.nonce in self.acks:
                    self.acks.discard(self.nonce)
                    return
        raise AssertionError(f"No ACK for {field}")

    def state_matching(self, text):
        self.rpc("request_state", PB.RequestState())
        until = time.monotonic() + 1.5
        while time.monotonic() < until:
            self.read()
            if self.state and self.state.config.text == text:
                return self.state
        raise AssertionError(f"Expected {text}, received {self.state}")

    def own(self, session, enabled=True):
        self.rpc("host_control", PB.HostControl(enabled=enabled, session_id=session))


def limit(variant, position, nonce):
    return PB.SmartKnobConfig(position=position, position_nonce=nonce, min_position=0,
                             max_position=10, position_width_radians=24 * 3.141592653589793 / 180,
                             endstop_strength_unit=1 if variant else 0.35,
                             snap_point=1.1, text=f"studio:limit:qa{nonce}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default="COM5")
    args = parser.parse_args()
    device = Device(args.port)
    try:
        device.own(11001)
        soft = limit(0, 5, 21)
        device.rpc("smartknob_config", soft)
        device.state_matching(soft.text)
        for _ in range(7):
            time.sleep(0.8)
            device.own(11001)
            device.state_matching(soft.text)
        before = device.state
        # The browser sends a neutral config before close for legacy devices.
        # Managed firmware must retain the preceding demo across that config.
        neutral = PB.SmartKnobConfig(position_nonce=24, min_position=0, max_position=-1,
                                    position_width_radians=3.141592653589793 / 18,
                                    endstop_strength_unit=1, snap_point=1.1, text="studio:idle:qa24")
        device.rpc("smartknob_config", neutral)
        device.state_matching(neutral.text)
        device.own(11001, False)
        released = device.state_matching("demo:limit:0")
        assert released.current_position == before.current_position
        assert abs(released.sub_position_unit - before.sub_position_unit) < 0.1
        print("PASS: heartbeats retain Web ownership; release preserves selection and position", flush=True)
        device.own(11002)
        hard = limit(1, 6, 22)
        device.rpc("smartknob_config", hard)
        device.state_matching(hard.text)
        time.sleep(5.3)
        expired = device.state_matching("demo:limit:1")
        assert expired.current_position == 6
        assert abs(expired.config.endstop_strength_unit - 1) < 0.001
        device.rpc("smartknob_config", soft)
        device.state_matching("demo:limit:1")
        print("PASS: timeout resumes the matching variant; late configs cannot steal control", flush=True)
        device.own(11003)
        free = PB.SmartKnobConfig(position_nonce=23, min_position=0, max_position=-1,
                                 position_width_radians=3.141592653589793 / 18,
                                 endstop_strength_unit=1, snap_point=1.1, text="studio:free:qa23")
        device.rpc("smartknob_config", free)
        device.state_matching(free.text)
        device.own(11003, False)
        device.state_matching("demo:free:0")
        print("PASS: reconnect acquires a fresh session and releases to standalone", flush=True)
    finally:
        device.port.close()


if __name__ == "__main__":
    main()
