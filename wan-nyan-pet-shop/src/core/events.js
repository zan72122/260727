/** Minimal synchronous event bus. Listeners never throw into the emitter. */
export class EventBus {
  constructor() {
    this.map = new Map();
  }

  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const set = this.map.get(type);
    if (set) set.delete(fn);
  }

  emit(type, payload) {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] listener for "${type}" failed`, err);
      }
    }
  }

  clear() {
    this.map.clear();
  }
}
