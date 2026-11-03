#if SK_DISPLAY
#include "dial.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

namespace {
constexpr float PI_F = 3.14159265358979323846f;
struct Dial {
    TFT_eSprite& sprite;
    float cx, cy, scale;
    int x(float radius, float degrees) const { return lroundf(cx + radius * scale * sinf(degrees * PI_F / 180)); }
    int y(float radius, float degrees) const { return lroundf(cy - radius * scale * cosf(degrees * PI_F / 180)); }
    void line(float r1, float r2, float angle, uint16_t color, float width = 2) {
        const int x1 = x(r1, angle), y1 = y(r1, angle), x2 = x(r2, angle), y2 = y(r2, angle);
        const int radius = lroundf(width * scale / 2);
        const int steps = max(abs(x2 - x1), abs(y2 - y1));
        for (int i = 0; i <= steps; ++i) {
            const float t = steps ? float(i) / steps : 0;
            sprite.fillCircle(lroundf(x1 + (x2 - x1) * t), lroundf(y1 + (y2 - y1) * t), radius, color);
        }
    }
};
}

bool drawDemoDial(TFT_eSprite& sprite, const PB_SmartKnobState& state) {
    const int index = demoIndex(state.config.text);
    if (index < 0) return false;
    const auto& preset = demoPreset(index);
    const auto& config = state.config;
    const uint16_t bg = sprite.color565(244, 243, 239);
    const uint16_t ink = sprite.color565(22, 23, 21);
    const uint16_t accent = sprite.color565(231, 92, 50);
    const uint16_t gray = sprite.color565(119, 121, 110);
    const float scale = min(int(sprite.width()), int(sprite.height()) - 24) / 440.0f;
    Dial dial{sprite, sprite.width() / 2.0f, sprite.height() / 2.0f, scale};
    const float value = state.current_position + state.sub_position_unit;
    const float width = config.position_width_radians * 180 / PI_F;
    const bool bounded = config.min_position <= config.max_position;
    const float center = bounded ? (config.min_position + config.max_position) / 2.0f : 0;
    const float angle = (value - center) * width;
    const bool spring = strcmp(preset.id, "spring") == 0;
    const bool binary = strcmp(preset.id, "switch") == 0;
    const bool free = strcmp(preset.id, "free") == 0;
    const long rounded = long(floorf(value + 0.5f)); // Match JavaScript Math.round.
    sprite.fillSprite(bg);
    if (spring && config.min_position == config.max_position) {
        dial.line(185, 201, 0, accent, 3);
        dial.line(185, 197, -60, ink);
        dial.line(185, 197, 60, ink);
    } else if (bounded) {
        for (int32_t n = config.min_position; n <= config.max_position; ++n) {
            bool magnetic = false;
            for (uint8_t j = 0; j < config.detent_positions_count; ++j) {
                if (config.detent_positions[j] == n) magnetic = true;
            }
            dial.line(185, magnetic ? 203 : 196, (n - center) * width,
                      magnetic ? accent : gray, magnetic ? 4 : 2);
        }
    } else {
        for (uint8_t n = 0; n < preset.ticks; ++n) dial.line(185, 198, n * 360.0f / preset.ticks, ink);
    }
    const int cx = lroundf(dial.cx), cy = lroundf(dial.cy);
    if (binary && rounded > 0) sprite.fillCircle(cx, cy, lroundf(155 * scale), sprite.color565(242, 227, 217));
    sprite.drawCircle(cx, cy, lroundf(155 * scale), ink);
    sprite.drawCircle(cx, cy, lroundf(150 * scale), sprite.color565(176, 177, 168));
    dial.line(125, 151, angle, accent, 10);
    if (free) sprite.fillCircle(dial.x(198, angle), dial.y(198, angle), max(1, int(lroundf(5 * scale))), accent);

    char display[24];
    const bool degrees = free || spring;
    if (binary) snprintf(display, sizeof(display), "%s", rounded <= 0 ? "OFF" : "ON");
    else if (degrees) snprintf(display, sizeof(display), "%ld", long(floorf((free ? value * width : angle) + 0.5f)));
    else snprintf(display, sizeof(display), "%02ld", rounded);
    sprite.setFreeFont(nullptr);
    sprite.setTextDatum(MC_DATUM);
    sprite.setTextSize(1);
    // Font 4 is included by the standalone build. Fallback to font 1 for older builds.
    #ifdef LOAD_FONT4
    uint8_t font = 4;
    #else
    uint8_t font = 1;
    #endif
    const int available = lroundf(235 * scale);
    if (sprite.textWidth(display, font) > available) font = 1;
    if (font == 1) sprite.setTextSize(max(1, int(66 * scale / 8)));
    else if (scale > 0.48f && sprite.textWidth(display, font) * 2 < available) sprite.setTextSize(2);
    sprite.setTextColor(ink, binary && rounded > 0 ? sprite.color565(242, 227, 217) : bg);
    sprite.drawString(display, cx, cy + lroundf(3 * scale), font);
    if (degrees) {
        const int text_width = sprite.textWidth(display, font);
        sprite.drawCircle(cx + text_width / 2 + 3, cy - sprite.fontHeight(font) / 3, max(1, int(4 * scale)), ink);
    }
    if (spring) {
        int px = lroundf(dial.cx - 45 * scale), py = lroundf(dial.cy + 70 * scale);
        const float amplitude = min(16.0f, 4 + fabsf(angle) / 8);
        for (int i = 0; i < 12; ++i) {
            const int x = lroundf(dial.cx + (-38 + i * 7) * scale);
            const int y = lroundf(dial.cy + (70 + (i % 2 ? 1 : -1) * amplitude) * scale);
            sprite.drawLine(px, py, x, y, accent);
            px = x; py = y;
        }
        sprite.drawLine(px, py, lroundf(dial.cx + 46 * scale), lroundf(dial.cy + 70 * scale), accent);
    }
    sprite.setTextSize(1);
    sprite.setTextColor(ink, bg);
    char label[32];
    snprintf(label, sizeof(label), "%d/8  %s", index + 1, preset.label);
    sprite.drawString(label, cx, 7, 1);
    const char* variant = "";
    if (index == 3) variant = config.endstop_strength_unit < 1 ? "Soft wall" : "Hard wall";
    if (index == 5) variant = config.min_position == config.max_position ? "Smooth" : "Stepped";
    if (index == 7) variant = config.detent_positions[1] == 9 ? "Even" : "Uneven";
    sprite.drawString(variant, cx, sprite.height() - 7, 1);
    return true;
}
#endif
