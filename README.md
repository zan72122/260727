# OVERSTRIKE

A first-person shooter built entirely in Three.js, with **zero external art assets** —
every texture, material, weapon, character, sound and visual effect is generated
procedurally at load time.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
```

## Controls

| Input | Action |
|---|---|
| `W A S D` | Move |
| `Mouse` | Look |
| `LMB` / `RMB` | Fire / Aim down sights |
| `Shift` | Sprint |
| `Ctrl` | Crouch (sprint + crouch = slide) |
| `Space` | Jump (hold to vault ledges) |
| `R` | Reload |
| `1`–`4`, wheel, `Q` | Switch weapon |
| `F` | Inspect weapon |
| `Esc` | Pause |

## Architecture

A fixed-timestep engine (120 Hz simulation, variable-rate render) with a flat system
registry. Systems never reference each other directly — they publish a surface onto a
shared `ctx` object at boot and communicate over an event bus.

```
src/
  core/      Engine, Input, Settings, EventBus, MathUtils (springs, noise, PRNG)
  render/    Renderer, Sky (atmospheric scattering + IBL), PostFX (composer chain)
  world/     Textures (procedural PBR), Materials, Level, Props
  physics/   BVH collision, capsule character sweep, rigid bodies, ragdolls
  player/    Character controller, camera rig (bob, sway, recoil, shake)
  weapons/   Weapon defs, procedural models, viewmodel animation, ballistics
  ai/        Enemy behaviour, navigation, procedural characters + animation
  fx/        GPU particles, decals, tracers, surface-aware impacts
  audio/     Web Audio synthesis, convolution reverb, adaptive music
  ui/        HUD, menus, compass
  game/      Wave director, scoring
  qa/        Debug hooks for the headless capture harness
```

The module boundaries and public APIs are specified in [`CONTRACTS.md`](./CONTRACTS.md).

## Quality tooling

The project is developed against a headless visual-QA loop. `tools/capture.mjs` boots the
game in Chromium (SwiftShader), poses the camera at fixed viewpoints, and writes PNGs plus
a report of console errors and render statistics:

```bash
node tools/capture.mjs --out shots/latest
```

`tools/blind-compare.mjs` builds randomised A/B pairs against reference screenshots for
blind visual grading.

## Design constraints

* Metres, Y-up, −Z forward. Gravity −24 m/s² (tuned for feel, not realism).
* No external asset downloads, at build time or runtime.
* Target 60 fps at 1080p on integrated graphics at the `medium` quality preset.
