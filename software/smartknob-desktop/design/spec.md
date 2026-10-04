# SmartKnob Desktop — visual and interaction specification

Desktop-only browser virtual OS, embedded in SmartKnob Demo under the OS Demo tab and also available standalone. No native OS control. Reference: desktop-concept.png (1536×1024).

## Composition
- Edge-to-edge photographic blue coastal cliff wallpaper with peach horizon, no tint overlay.
- Translucent 32px menu bar: knob ring, SmartKnob Desktop, active app, アプリ, 操作ガイド; right USBで接続 and local date/time.
- Left 2×6 desktop icon grid: 64px colorful squircle icons, 13px white labels, double-click/Enter opens. Native-style icons are code SVG.
- Floating white app windows: 14px radius, thin white/gray border, broad soft shadow, 38px title bar with three traffic lights, draggable title bar, minimize/close/maximize. App body controls stay separate from dragging.
- Initial photo window x248/y98/w880/h588; timer x1156/y65/w334/h328 at 1536×1024. At smaller desktop sizes, preserve usable windows and allow natural overlap; bring clicked window to front and resize/clamp to viewport.
- Persistent knob panel at bottom-right, 300px wide, above dock; active app/value, silver dial with ticks, − / 押す / +, haptic hint and keyboard hints. Can collapse to allow window work.
- Dock centered at bottom, frosted glass, 12 48–56px app icons with open dots, click opens/restores.

## Tokens
Background white app surfaces #fff, titlebar #f0f2f5, chrome #f5f6fa, text #192130, secondary #727b8a, divider #e4e7ec, blue #2384ff, selected #e5efff, orange #ff8428. Surface translucency only on chrome/dock/controller; photo unfiltered at default.
System font: -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif. Menu/title/control 12–13px, body 14px, numbers 28px, timer 48px. Radii 6/9/14/22. Spacing 8/12/16/24. Button heights 28–34px. Respect reduced motion.

## App families
Photo: large image left, 240px adjustment inspector right, three selectors, sliders with standard markers, reset and grid controls. Timer: thin orange circular arc, large time, start/pause/reset. Media: playback canvas/timeline and dense transport controls. Browser/reader/review: tabs or outline plus reading surface. Utility apps: restrained native controls and an immediate visual result, no dashboard cards.

All 12 app requirements follow the user's table. Active window determines knob target. Onscreen turning, wheel and arrows share reducer with Web Serial; press/Space and long press are supported. Standard protocol cannot measure held duration, so hardware double-press invokes the same long-press action. Timer visually counts down and updates the logical knob scale, not an unsupported physical absolute return motor command. Favorite strength uses a host-updated approximation, retaining ordinary clicks.

## Intentional concept adjustments
- Omit decorative Wi-Fi/Bluetooth/volume status and Trash because these have no virtual-OS function.
- Omit photo browser-style back/forward controls; use real reset/grid controls.
- Use the actual current date/time, not the concept's frozen 14:30.
- App contents beyond the photo/timer state extend the same chrome and tokens to implement the 12 explicitly requested workflows.
- Persistent knob control may collapse; this necessary interaction keeps usable space on a 1024px desktop.
- No mobile layout, per user requirement.
- In the combined demo, retain the shared Haptics / OS Demo navigation and one USB connection. Size the desktop to the remaining container; use a compact dock and controller placement on short desktop screens.
- The video window includes a chapter sidebar and timeline marks. Exact paused chapter boundaries use strength 0.95 while normal frame/second clicks remain.

## Final fidelity review — 2026-10-03

Compared `desktop-concept.png` and the live `desktop-render.png` together using image inspection at 1536×1024. Also inspected the default 1280×720 desktop.

| Aspect | Result / deliberate adjustment |
| --- | --- |
| Overall composition | Two-column launcher left, photo center, timer upper-right, controller lower-right, centered dock preserved. Small desktops use compact controls and natural window overlap. |
| Wallpaper and photo | Generated coastal photograph preserves blue water, cliff foreground and warm horizon. Shared asset and matching crop family keep wallpaper and editor coherent. |
| Window chrome | White surfaces, soft shadows, rounded corners, gray title bars and red/yellow/green controls match the reference. All traffic-light actions work. |
| Typography and hierarchy | System Japanese UI font, restrained labels and large time/control values preserved. Extra functional hints use smaller type. |
| Icons and dock | Twelve colorful SVG squircle icons follow the concept's app palette. Trash and decorative status icons omitted; every visible icon has a function. |
| Photo inspector | Three controls, standard markers, grid and blue selection follow the reference. Real reset/grid controls replace the concept's decorative navigation controls. |
| Timer and knob | Orange timer ring and brushed silver knob retained. Added timer presets, explicit long-press action and real connection status. Shortened compact panel and moved full panel down to prevent overlap with timer controls. |

No unintentional visual mismatch remains in the reviewed initial desktop states. Later app windows follow the same tokens and can be moved/resized where they overlap.

## Interaction verification

Browser checks covered all twelve apps: desktop double-click, dock open/restore, focused input routing, window drag/resize/maximize/close, keyboard arrows/Shift/Space, direct knob drag, screen press and long-press alternative. Values persist through close/open within a page session.

Confirmed tab preview versus press-to-commit, favorite app switching, live timer countdown/pause/remaining-time adjustment, photo parameter switching, lighting brightness/temperature, map zoom/100% reset, bounded quantity and confirmed form values, diff expansion/next file, and chapter/page navigation. Music and audio playback entered their running states with speed/tempo/pan updates and no browser errors; sound quality and physical knob feel were not assessed.

Local video reached readyState 4 at 1280px media width, played, paused at its current native position, stepped one frame and thirty frames, and paused on minimize. Rapid seek/play and stale play rejection have regression tests. Browser error/warning log was empty after the checks. New desktop hardware behavior remains unverified on a physical device.
