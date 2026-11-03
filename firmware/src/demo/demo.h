#pragma once

#ifndef SK_STANDALONE_DEMO
#define SK_STANDALONE_DEMO 0
#endif

#include <stdint.h>
#include "../proto_gen/smartknob.pb.h"

struct DemoPreset {
    const char* id;
    const char* label;
    uint8_t ticks;
    uint8_t variant_count;
    PB_SmartKnobConfig configs[2];
};

constexpr uint8_t DEMO_PRESET_COUNT = 8;
const DemoPreset& demoPreset(uint8_t index);
int demoIndex(const char* text);
uint8_t demoVariant(const PB_SmartKnobConfig& config);
PB_SmartKnobConfig demoConfig(uint8_t index, uint8_t variant, uint8_t nonce);
