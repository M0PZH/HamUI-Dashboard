import { Knob } from 'hamui';
import { h, needStore } from './util.js';

const KNOBS = {
  af: { label: 'AF', min: 0, max: 100 },
  rf: { label: 'RF', min: 0, max: 100 },
  sql: { label: 'SQL', min: 0, max: 100 },
  power: { label: 'PWR', min: 5, max: 100, unit: 'W' },
};

// store: af, rf, sql, power. Turning a knob sets its key.
export default {
  type: 'knobs',
  title: 'Knobs',
  description: 'AF / RF gain, squelch and TX power. Drag, scroll or use the arrow keys.',
  sizes: ['S', 'M', 'L'],
  size: 'M',
  multiple: true,
  options: [
    { key: 'knobs', type: 'checks', label: 'Knobs', default: (size) => (size === 'S' ? ['af', 'power'] : ['af', 'rf', 'sql', 'power']),
      choices: Object.entries(KNOBS).map(([value, k]) => ({ value, label: k.label })) },
    { key: 'step', type: 'segmented', label: 'Step', default: 1, choices: [{ value: 1, label: '1' }, { value: 5, label: '5' }, { value: 10, label: '10' }],
      help: 'Coarser steps click on every step on devices with haptics.' },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, options: o } = ctx;
    const row = h('div', 'hdw-knobs');
    el.append(row);
    const keys = o.knobs.length ? o.knobs : ['af'];
    const knobs = keys.map((key) => {
      const d = h('div');
      row.append(d);
      const k = new Knob(d, { ...KNOBS[key], step: o.step, value: store.state[key] ?? KNOBS[key].min, size: size === 'L' ? 'lg' : size === 'S' ? 'sm' : 'md' });
      k.on('change', (e) => store.set({ [key]: e.detail.value }));
      return [key, k];
    });
    const off = store.watch(keys, (patch) => { for (const [key, k] of knobs) if (key in patch) k.set(patch[key], { silent: true }); });
    return () => { off(); knobs.forEach(([, k]) => k.destroy()); };
  },
};
