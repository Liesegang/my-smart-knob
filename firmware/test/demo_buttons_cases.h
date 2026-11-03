#pragma once
#include "../src/demo/buttons.h"

// Executed on the ESP32 by the motor-free diagnostic image.
inline bool verifyDemoButtons() {
    bool input[4] = {};
    DemoButtons buttons;
    buttons.begin(input, 0);
    for (uint8_t i = 0; i < 4; ++i) {
        const uint32_t t = 100 + i * 1000;
        input[i] = true;
        if (buttons.update(input, t) != DemoButtonAction::NONE) return false;
        if (buttons.update(input, t + 31) != DemoButtonAction::NONE) return false;
        if (buttons.update(input, t + 500) != DemoButtonAction::NONE) return false;
        input[i] = false;
        if (buttons.update(input, t + 510) != DemoButtonAction::NONE) return false;
        if (buttons.update(input, t + 520) != DemoButtonAction::NONE) return false;
        if (buttons.update(input, t + 541) != static_cast<DemoButtonAction>(i + 1)) return false;
        if (buttons.update(input, t + 600) != DemoButtonAction::NONE) return false;
    }
    // Bounce shorter than the debounce interval must not produce a click.
    input[0] = true;
    buttons.update(input, 5000);
    input[0] = false;
    buttons.update(input, 5008);
    if (buttons.update(input, 5040) != DemoButtonAction::NONE) return false;
    // A switch held at boot is ignored until the next complete press.
    input[0] = true;
    buttons.begin(input, 6000);
    input[0] = false;
    buttons.update(input, 6010);
    if (buttons.update(input, 6041) != DemoButtonAction::NONE) return false;
    // Debouncing continues across the millis() counter wrapping.
    buttons.begin(input, 0xFFFFFFD0);
    input[0] = true;
    buttons.update(input, 0xFFFFFFF0);
    buttons.update(input, 0x10);
    input[0] = false;
    buttons.update(input, 0x20);
    return buttons.update(input, 0x40) == DemoButtonAction::PREVIOUS;
}
