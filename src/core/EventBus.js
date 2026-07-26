/** Tiny synchronous pub/sub used to decouple gameplay systems from FX / audio / UI. */
export class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  once(type, fn) {
    const un = this.on(type, (...a) => { un(); fn(...a); });
    return un;
  }
  off(type, fn) { this.map.get(type)?.delete(fn); }
  emit(type, payload) {
    const s = this.map.get(type);
    if (!s) return;
    for (const fn of s) {
      try { fn(payload); } catch (e) { console.error(`[EventBus:${type}]`, e); }
    }
  }
  clear() { this.map.clear(); }
}

export const bus = new EventBus();

/**
 * Canonical event names. Systems must use these constants so cross-module
 * wiring stays greppable.
 */
export const EV = {
  // Combat
  WEAPON_FIRE:     'weapon:fire',
  WEAPON_DRY:      'weapon:dry',
  WEAPON_RELOAD:   'weapon:reload',
  WEAPON_RELOAD_END:'weapon:reloadEnd',
  WEAPON_SWITCH:   'weapon:switch',
  WEAPON_ADS:      'weapon:ads',
  SHELL_EJECT:     'weapon:shell',
  BULLET_IMPACT:   'combat:impact',      // {point, normal, surface, dir}
  ENEMY_HIT:       'combat:enemyHit',    // {enemy, point, normal, damage, headshot, dir}
  ENEMY_KILLED:    'combat:enemyKilled', // {enemy, point, headshot}
  PLAYER_HIT:      'combat:playerHit',   // {damage, from}
  PLAYER_DIED:     'combat:playerDied',
  EXPLOSION:       'combat:explosion',   // {point, radius, power}

  // Movement / feel
  PLAYER_FOOTSTEP: 'player:footstep',    // {surface, speed}
  PLAYER_LAND:     'player:land',        // {impact, surface}
  PLAYER_JUMP:     'player:jump',
  CAMERA_SHAKE:    'camera:shake',       // {amp, freq, duration}

  // Meta
  SCORE:           'game:score',
  WAVE_START:      'game:waveStart',
  WAVE_CLEAR:      'game:waveClear',
  GAME_OVER:       'game:over',
  STATE_CHANGE:    'game:state',
  NOTIFY:          'ui:notify',
};
