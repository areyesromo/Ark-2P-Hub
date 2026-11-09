# Kart Race 3D interface

Kart Race 3D has its own garage, race HUD and podium while retaining the shared race rules, input mapping, sounds, tyres, characters and readiness behavior. The original 2D Kart Race keeps its presentation.

- Garage: circuit/arena preview, race settings, both player selections and explicit ready states. TV settings are a display controlled through the phone or gamepad; they do not pretend to be clickable TV controls.
- Race: each viewport has a labeled player/position/lap panel, separate alerts, speed/coins/lap timing, item queue and drift-charge meter. The map uses the actual track geometry and current player positions, with the start line hidden in battle. Geometry is cached between updates.
- Phone: named items, an explicit empty slot, drift charge and release guidance, stable gold-turbo styling, and compact landscape controls. Existing steering methods, saved preferences, motion fallback and touch cancellation remain in use.
- Results: winner/time cards, series standings, next circuit and both players' ready states. Race HUD is hidden when the camera returns to the overview.
- Loading: visible status, retry by TV button or controller X, and guidance to return through the hub menu. Late scenes are disposed after leaving; world initialization failures also dispose the scene before offering retry.

## Implementation boundaries

`public/games/kart-race-3d/ui.js` provides a presentation object to the shared TV factory. The original factory defaults remain unchanged. The shared phone renderer now exposes a factory, with the 3D wrapper opting into its own class and labels. Styles are scoped to the 3D host or phone. No server rules, race timing, geometry, camera behavior or model assets were changed.

## Lightweight preview

Run `node tools/kart-race-3d-preview.mjs`, then open `http://127.0.0.1:4317`.

The preview uses captured server views and the actual UI renderers against a visibly labeled static stage. It binds only to localhost and blocks the 3D scene scripts. It does not connect to a real room, run a game loop, load Three.js or submit ComfyUI work. Controls at the top switch TV/phone and race/battle phases. The warning toggle verifies that penalties do not replace lap progress. Controller Down exercises setup focus and scrolling.

## Validation

- `node --test test/kart*.test.js`: 123 passed, including 3D HUD/menus, map width/positions, persistent lap progress, loading/retry, late disposal, initialization failure, cancelled phone holds, empty items and return to the original 2D phone.
- Static browser checks: setup, countdown, race, finish, standings, final results and battle variants; TV at 1280×720, portrait phone at 390×844, landscape at 844×390. Setup fits the 720p preview; all landscape driving buttons remain visible and exceed 44px height. No page errors or canvas elements in the static preview.
- The full local Windows run had 1,184 passed, 8 skipped and two failures in the existing Raspberry Pi updater tests: Bash could not open Windows temporary-file paths. That run preceded the final five focused loading/phone tests; all kart tests were rerun afterward. Linux GitHub CI runs the complete final suite before merge.
- Review followed the repository's two-player synchronization checklist: views remain server-owned, inputs keep their existing mappings, phase/readiness/results are unchanged, no new server timers or private data were added, and renderer state and late scene work are cleaned up on unmount.

Live WebGL driving, camera readability over moving scenery, and frame rate were deliberately not exercised while the user was gaming. Those remain a follow-up play check; this preview is not a claim of a live race or performance benchmark.
