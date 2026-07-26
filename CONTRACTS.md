# OVERSTRIKE — Module Contracts (FROZEN)

Every module below is owned by exactly one agent. **Do not edit files you do not own.**
The exported signatures here are frozen: implement behind them, never change them.
If you genuinely need a new cross-module API, add it *additively* and note it in your report.

Engine basics live in `src/core/` (Engine, Input, Settings, EventBus, MathUtils) and are
already written — read them, don't modify them.

## System interface

A system is a plain object/class instance with:

```js
{
  name: 'unique-name',
  priority: 100,               // lower runs earlier; see table below
  async init(ctx) {},          // awaited at boot
  fixedUpdate(h, ctx) {},      // h === 1/120, deterministic sim
  update(dt, ctx) {},
  lateUpdate(dt, ctx) {},
  resize(w, h, ctx) {},
  dispose() {},
}
```

### Priority table (do not deviate)

| priority | system            |
|---------:|-------------------|
|       10 | physics           |
|       20 | player            |
|       30 | weapons           |
|       40 | ai                |
|       50 | fx                |
|       60 | audio             |
|       70 | game (director)   |
|       80 | ui                |
|      900 | postfx (init only)|
|     1000 | renderer          |

## `ctx` — shared context

Always present: `engine, scene, camera, renderer, clock, input, bus, EV, settings,
container, canvas, caps, tmp`.

`clock = { dt, fixed, elapsed, alpha, frame, fps, smoothDt }`
`tmp` holds reusable `Vector3`/`Quaternion`/`Matrix4`/`Ray`/`Box3` scratch objects —
**use them, do not allocate in update loops.**

Systems attach their public surface to `ctx` during `init`:
`ctx.physics`, `ctx.player`, `ctx.level`, `ctx.materials`, `ctx.weapons`, `ctx.ai`,
`ctx.fx`, `ctx.audio`, `ctx.ui`, `ctx.postfx`, `ctx.sky`.

---

## 1. `src/world/Textures.js` — procedural PBR texture library

```js
export class TextureLibrary {
  constructor(renderer)                   // needs renderer for anisotropy + mip gen
  get(name, opts = {})                    // -> { map, normalMap, roughnessMap, aoMap, metalnessMap?, displacementMap? }
  dispose()
}
```

`name` must support at least:
`'concrete'`, `'concrete_wall'`, `'asphalt'`, `'metal_panel'`, `'rusted_metal'`,
`'brick'`, `'tile'`, `'wood_plank'`, `'gravel'`, `'sand'`, `'painted_metal'`,
`'crate_wood'`, `'chainlink'`, `'grating'`, `'plaster'`, `'rubber'`.

Requirements: generated on canvas / typed arrays at `Settings.textureSize`, seamless
(tileable), with **derived normal maps from a real height field** (Sobel), AO from
cavity, roughness varied by the same height field. Set `wrapS/T = RepeatWrapping`,
`anisotropy = Settings.anisotropy`, `colorSpace = SRGBColorSpace` on albedo only.
Results must be cached by `name+size`.

Also export:
```js
export function createEnvironmentMap(renderer, scene)  // -> PMREM-processed THREE.Texture
```

## 2. `src/world/Materials.js` — material library

```js
export class MaterialLibrary {
  constructor(textures, renderer)
  get(name, overrides = {})               // -> THREE.Material (cached, shared)
  surfaceOf(material|mesh)                // -> 'concrete'|'metal'|'wood'|'dirt'|'glass'|'flesh'|'water'
  update(dt)                              // animate any time-varying materials
  dispose()
}
```

Every mesh in the level **must** carry `mesh.userData.surface` = one of the surface
strings above, so FX/audio can pick the right impact response.

## 3. `src/world/Level.js` — level geometry, props, lighting

```js
export class LevelSystem {
  name = 'level'; priority = 5;
  async init(ctx)                          // builds ctx.level
}
// ctx.level = {
//   root: THREE.Group,
//   colliders: Array<{ type:'box'|'sphere'|'capsule'|'tri', ... }>,   // fed to physics
//   spawnPoints: THREE.Vector3[],          // player spawns
//   enemySpawns: THREE.Vector3[],
//   navMesh: { nodes, links } | null,      // consumed by ai
//   bounds: THREE.Box3,
//   lights: THREE.Light[],
//   sunDir: THREE.Vector3,
// }
```

## 4. `src/physics/Physics.js` — collision + queries

```js
export class PhysicsSystem {
  name = 'physics'; priority = 10;
  // ctx.physics surface:
  raycast(origin, dir, maxDist, mask?)     // -> {hit, point, normal, distance, object, surface} | null
  sphereCast(origin, dir, radius, maxDist) // -> same shape | null
  moveCapsule(pos, vel, radius, height, dt)// -> {position, velocity, grounded, groundNormal, hits[]}
  overlapSphere(center, radius, mask?)     // -> object[]
  addBody(body) / removeBody(body)         // dynamic rigid bodies (shells, gibs, props)
  addCollider(collider) / rebuild()
}
```

Static world collision uses a BVH over level triangles. Dynamic bodies are simple
rigid spheres/boxes with restitution + friction, integrated in `fixedUpdate`.

## 5. `src/player/Player.js` — character controller + camera

```js
export class PlayerSystem {
  name = 'player'; priority = 20;
}
// ctx.player = {
//   position: Vector3, velocity: Vector3, yaw, pitch,
//   grounded, crouching, sprinting, sliding, health, maxHealth, alive,
//   eyeHeight, radius,
//   damage(amount, fromDir), heal(n), respawn(),
//   addRecoil(pitch, yaw),                 // called by weapons
//   addCameraShake(amp, freq, duration),
//   getViewDirection(out) -> Vector3,
// }
```

## 6. `src/weapons/*` — weapons, viewmodel, ballistics

```js
export class WeaponSystem { name = 'weapons'; priority = 30; }
// ctx.weapons = {
//   current, inventory[], ads (0..1), switchTo(idx), reload(), fire(), getMuzzleWorld(out),
// }
```
Emits `EV.WEAPON_FIRE {weapon, muzzle, dir, ads}`, `EV.BULLET_IMPACT`,
`EV.ENEMY_HIT`, `EV.SHELL_EJECT {position, velocity}`, `EV.WEAPON_RELOAD`.

## 7. `src/ai/*` — enemies

```js
export class AISystem { name = 'ai'; priority = 40; }
// ctx.ai = { enemies[], spawn(type, position), damageEnemy(enemy, dmg, point, normal, headshot), alive() }
```
Enemy objects expose `{ root, position, health, alive, headBox, bodyBox, takeDamage() }`.

## 8. `src/fx/*` — particles, decals, tracers, impacts

```js
export class FXSystem { name = 'fx'; priority = 50; }
// ctx.fx = {
//   impact(point, normal, surface), muzzleFlash(pos, dir, scale),
//   tracer(from, to, speed), blood(point, normal, dir),
//   explosion(point, radius), shell(pos, vel, type), smoke(pos, opts), spark(pos, dir, n),
// }
```
Everything pooled. Zero allocation after warm-up.

## 9. `src/audio/AudioEngine.js`

```js
export class AudioSystem { name = 'audio'; priority = 60; }
// ctx.audio = { play(name, opts), play3D(name, position, opts), setListener(cam), music(name) }
```
All sounds **synthesized** with WebAudio (no external assets). Positional via PannerNode.

## 10. `src/ui/*` — HUD, menus

```js
export class UISystem { name = 'ui'; priority = 80; }
// ctx.ui = { setState(s), notify(text, kind), showHitmarker(headshot), setCrosshairSpread(px) }
```
DOM overlay + canvas. Must be crisp at any DPR and must not intercept pointer events
while locked.

## 11. `src/render/PostFX.js` + `src/render/Sky.js`

```js
export class PostFXSystem { name = 'postfx'; priority = 900; }
// ctx.postfx = { render(dt, ctx), setBloom(v), setVignette(v), hitFlash(intensity), dispose() }

export class SkySystem { name = 'sky'; priority = 6; }
// ctx.sky = { sunDir: Vector3, setTimeOfDay(t), envMap }
```
PostFX owns the composer chain and **must** implement `render()`. Order:
depth/normal prepass → GTAO → main → SSR (optional) → motion blur → DOF → bloom →
tone map + grading (LUT-ish) → sharpen → SMAA/TAA → vignette/grain/CA.

---

## Conventions

* Units: metres. Player eye height 1.68 m, crouch 1.02 m. Gravity −24 m/s² (game-feel).
* Y-up, −Z forward. Camera rotation order `YXZ`.
* No external asset downloads — everything procedural or synthesized.
* No `console.log` left in shipped code paths (`console.warn`/`error` OK).
* Target: 60 fps at 1080p on integrated graphics for `medium` preset.
* All disposables registered so `dispose()` leaves zero GPU leaks.
