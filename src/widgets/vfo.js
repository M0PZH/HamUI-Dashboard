import { FrequencyDisplay, BandSelector, bandForFrequency } from 'hamui';
import { h } from './util.js';
import { needStore } from './util.js';

// store: dial (Hz), mode, tx. Tuning sets dial.
export default {
  type: 'vfo',
  title: 'VFO',
  description: 'Frequency display. Scroll or drag a digit to tune.',
  sizes: ['XS', 'M', 'L'],
  size: 'M',
  multiple: true,
  options: [
    { key: 'label', type: 'text', label: 'Name', default: 'VFO A', maxLength: 24 },
    { key: 'minPlace', type: 'segmented', label: 'Finest tuning step', default: 0, choices: [
      { value: 0, label: '1 Hz' }, { value: 1, label: '10 Hz' }, { value: 2, label: '100 Hz' }, { value: 3, label: '1 kHz' }] },
    { key: 'bands', type: 'toggle', label: 'Show band buttons', default: true, sizes: ['L'] },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, options: o, setStatus, setTitle } = ctx;
    const st = store.state;
    setTitle(o.label || 'VFO');
    const a = h('div');
    el.append(a);
    const big = size === 'L';
    const fd = new FrequencyDisplay(a, { value: st.dial ?? 14074000, size: big ? 'xl' : size === 'XS' ? 'md' : 'lg', unit: big ? 'MHz' : null, label: o.label || 'VFO', minPlace: o.minPlace });
    fd.on('change', (e) => store.set({ dial: e.detail.hz }));
    let badge = null, bandB = null, bandSel = null;
    if (size !== 'XS') {
      const row = h('div', 'ham-cluster');
      badge = h('span', 'ham-badge ham-badge-accent');
      bandB = h('span', 'ham-badge ham-badge-mono');
      row.append(badge, bandB);
      el.append(row);
      if (big && o.bands) {
        const b = h('div');
        el.append(b);
        bandSel = new BandSelector(b, { value: bandForFrequency(st.dial)?.name });
        bandSel.on('change', (e) => { if (e.detail.band) store.set({ dial: e.detail.band.dial }); });
      }
    }
    const sync = () => {
      fd.set(st.dial, { silent: true });
      fd.setTx(!!st.tx);
      const band = bandForFrequency(st.dial);
      if (badge) { badge.textContent = st.mode ?? '—'; bandB.textContent = band ? band.name : '—'; setStatus(''); } else setStatus(st.mode ?? '');
      bandSel?.follow(st.dial);
    };
    sync();
    const off = store.watch(['dial', 'mode', 'tx'], sync);
    return () => { off(); fd.destroy(); bandSel?.destroy(); };
  },
};
