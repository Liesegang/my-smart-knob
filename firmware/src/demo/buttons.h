#pragma once
#include <stdint.h>

enum class DemoButtonAction { NONE, PREVIOUS, PREVIOUS_VARIANT, NEXT_VARIANT, NEXT };

// One event per debounced release, with no repeat while held. Inputs are ordered
// physically: outer-left, inner-left, inner-right, outer-right. Ignore switches
// held during boot until they have been released.
class DemoButtons {
public:
    void begin(const bool (&input)[4], uint32_t now) {
        for (uint8_t i = 0; i < 4; ++i) {
            raw_[i] = stable_[i] = input[i];
            armed_[i] = !input[i];
            changed_[i] = now;
        }
        pending_ = 0;
    }

    DemoButtonAction update(const bool (&input)[4], uint32_t now) {
        for (uint8_t i = 0; i < 4; ++i) {
            if (input[i] != raw_[i]) { raw_[i] = input[i]; changed_[i] = now; }
            if (now - changed_[i] < 30 || stable_[i] == raw_[i]) continue;
            const bool released = stable_[i] && !raw_[i];
            stable_[i] = raw_[i];
            if (!stable_[i]) {
                if (released && armed_[i]) pending_ |= uint8_t(1 << i);
                armed_[i] = true;
            }
        }
        for (uint8_t i = 0; i < 4; ++i) {
            if (pending_ & (1 << i)) {
                pending_ &= uint8_t(~(1 << i));
                return static_cast<DemoButtonAction>(i + 1);
            }
        }
        return DemoButtonAction::NONE;
    }

private:
    bool raw_[4] = {};
    bool stable_[4] = {};
    bool armed_[4] = {};
    uint32_t changed_[4] = {};
    uint8_t pending_ = 0;
};
