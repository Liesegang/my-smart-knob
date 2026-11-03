#include "demo.h"
#include <string.h>
#include <math.h>
#include "presets_generated.h"

static_assert(sizeof(kDemoPresets) / sizeof(kDemoPresets[0]) == DEMO_PRESET_COUNT, "Expected 8 demos");

const DemoPreset& demoPreset(uint8_t index) {
    return kDemoPresets[index % DEMO_PRESET_COUNT];
}

int demoIndex(const char* text) {
    if (strncmp(text, "demo:", 5) == 0) text += 5;
    else if (strncmp(text, "studio:", 7) == 0) text += 7;
    else return -1;
    for (uint8_t i = 0; i < DEMO_PRESET_COUNT; ++i) {
        const size_t length = strlen(kDemoPresets[i].id);
        if (strncmp(text, kDemoPresets[i].id, length) == 0 && text[length] == ':') return i;
    }
    return -1;
}

PB_SmartKnobConfig demoConfig(uint8_t index, uint8_t variant, uint8_t nonce) {
    const DemoPreset& preset = demoPreset(index);
    PB_SmartKnobConfig config = preset.configs[variant % preset.variant_count];
    config.position_nonce = nonce;
    return config;
}

uint8_t demoVariant(const PB_SmartKnobConfig& config) {
    const int index = demoIndex(config.text);
    if (index < 0 || demoPreset(index).variant_count < 2) return 0;
    const auto& alternate = demoPreset(index).configs[1];
    return config.min_position == alternate.min_position
        && config.max_position == alternate.max_position
        && fabsf(config.position_width_radians - alternate.position_width_radians) < 0.00001f
        && fabsf(config.endstop_strength_unit - alternate.endstop_strength_unit) < 0.00001f
        && config.detent_positions_count == alternate.detent_positions_count
        && memcmp(config.detent_positions, alternate.detent_positions,
                  config.detent_positions_count * sizeof(config.detent_positions[0])) == 0;
}
