// Reference: software/js/packages/example-webserial-timeline/src/App.tsx.
// Scroll uses strength 10 at 8° with sparse detents (firmware disables D).
// Frames uses strength 1 and snap 1.1. Keep these distinct: applying the
// magnetic gain to every step would also amplify the continuous D term.
// Half of the reference gain: 10 caused oscillation on this device.
export const MAGNETIC_STRENGTH = 5;
export const MAGNETIC_WIDTH = 8;
export const MAGNETIC_SNAP = 0.7;
export const CLICK_STRENGTH = 1;
export const CLICK_SNAP = 1.1;
// firmware/src/interface_task.cpp: "Coarse values / Strong detents".
export const EMPHASIZED_CLICK_STRENGTH = 2;
