#if SK_BUTTON_PROBE
#include <Arduino.h>
#include "../../test/demo_buttons_cases.h"

// No motor, display, filesystem, I2C or SPI initialization in this image.
// Start without pull resistors because these candidate pins are not verified.
// Exclude flash/PSRAM and native USB. Motor pins are only sampled passively,
// without pull resistors; the display and I2C peripherals are never initialized.
// This probe build does not initialize PSRAM; GPIO33..37 can also be sampled.
// The connected chip uses quad flash (GPIO26..32), which remains untouched.
static const uint8_t pins[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48};
static constexpr size_t count = sizeof(pins) / sizeof(pins[0]);
static uint8_t raw[count];
static uint8_t stable[count];
static uint32_t changed[count];
static uint32_t last_snapshot;
static bool pullups = false;
static bool pulldowns = false;

static void snapshot() {
    Serial.printf("SNAPSHOT t=%lu pullups=%u pulldowns=%u", millis(), pullups, pulldowns);
    for (size_t i = 0; i < count; ++i) {
        Serial.printf(" GPIO%u=%u", pins[i], stable[i]);
    }
    Serial.println();
}

static void configureInputs(uint8_t pull_mode) {
    pullups = pull_mode == 1;
    pulldowns = pull_mode == 2;
    for (size_t i = 0; i < count; ++i) {
        const bool motor = pins[i] == 1 || pins[i] == 2 || (pins[i] >= 39 && pins[i] <= 42);
        pinMode(pins[i], motor ? INPUT : pullups ? INPUT_PULLUP : pulldowns ? INPUT_PULLDOWN : INPUT);
        stable[i] = raw[i] = digitalRead(pins[i]);
        changed[i] = millis();
    }
    Serial.println("BUTTON_PROBE ready; free GPIO scan; debounce=30ms");
    Serial.println("Commands: s=snapshot, u=pullup, d=pulldown, f=no pull resistors");
    snapshot();
}

void setup() {
    Serial.begin(115200);
    // USB is optional. Never wait indefinitely for a host.
    delay(1000);
    const bool buttons_ok = verifyDemoButtons();
    Serial.println(buttons_ok ? "SELFTEST buttons PASS" : "SELFTEST buttons FAIL");
    if (!buttons_ok) while (true) delay(1000);
    configureInputs(0);
}

void loop() {
    const uint32_t now = millis();
    for (size_t i = 0; i < count; ++i) {
        const uint8_t level = digitalRead(pins[i]);
        if (level != raw[i]) {
            raw[i] = level;
            changed[i] = now;
        }
        if (raw[i] != stable[i] && now - changed[i] >= 30) {
            stable[i] = raw[i];
            Serial.printf("CHANGE t=%lu GPIO%u=%u\n", now, pins[i], stable[i]);
        }
    }
    while (Serial.available()) {
        switch (Serial.read()) {
            case 's': snapshot(); break;
            case 'u': configureInputs(1); break;
            case 'd': configureInputs(2); break;
            case 'f': configureInputs(0); break;
        }
    }
    if (now - last_snapshot >= 2000) {
        snapshot();
        last_snapshot = now;
    }
    delay(1);
}
#endif
