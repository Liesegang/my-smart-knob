#pragma once
#if SK_DISPLAY
#include <TFT_eSPI.h>
#include "demo.h"
bool drawDemoDial(TFT_eSprite& sprite, const PB_SmartKnobState& state);
#endif
