// A tiny shared state store for widgets: values with change notifications,
// plus fire-and-forget events for streams (e.g. spectrum frames).
//
//   const store = createStore({ dial: 14074000 });
//   const off = store.watch(['dial'], (patch, state) => …);
//   store.set({ dial: 7074000 });
//   store.on('spectrum', (frame) => …); store.emit('spectrum', frame);

export function createStore(initial = {}) {
  const state = { ...initial };
  const watchers = new Set();
  const events = new Map();

  return {
    state,
    get: (key) => state[key],

    /** Merge `patch`; watchers are told about the keys that changed. */
    set(patch) {
      const changed = {};
      let any = false;
      for (const k in patch) {
        if (!Object.is(state[k], patch[k])) { state[k] = patch[k]; changed[k] = patch[k]; any = true; }
      }
      if (any) for (const w of [...watchers]) if (!w.keys || w.keys.some((k) => k in changed)) w.fn(changed, state);
      return any;
    },

    /** watch(fn) or watch(keys, fn). Returns an unsubscribe function. */
    watch(keys, fn) {
      if (typeof keys === 'function') { fn = keys; keys = null; }
      const w = { keys: keys ? [].concat(keys) : null, fn };
      watchers.add(w);
      return () => watchers.delete(w);
    },

    on(name, fn) {
      if (!events.has(name)) events.set(name, new Set());
      events.get(name).add(fn);
      return () => events.get(name)?.delete(fn);
    },

    emit(name, data) { for (const fn of [...(events.get(name) || [])]) fn(data); },
  };
}
