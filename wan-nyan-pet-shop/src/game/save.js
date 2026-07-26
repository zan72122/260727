import { serialize, deserialize } from './state.js';

export const SAVE_KEY = 'wannyan-petshop.save.v1';

/** Storage is injected so tests can run without a browser. */
export function saveGame(state, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(state)));
    return true;
  } catch (err) {
    console.warn('[save] could not write save', err);
    return false;
  }
}

export function loadGame(storage = globalThis.localStorage, opts = {}) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.pets)) return null;
    return deserialize(data, opts);
  } catch (err) {
    console.warn('[save] could not read save', err);
    return null;
  }
}

export function hasSave(storage = globalThis.localStorage) {
  try {
    return Boolean(storage && storage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function clearSave(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
