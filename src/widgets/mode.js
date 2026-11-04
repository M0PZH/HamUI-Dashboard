import { BandSelector, ModeSelector, HF_BANDS, modes, bandForFrequency } from 'hamui';
import { h, needStore } from './util.js';

const BANDS = [...HF_BANDS, '6m', '2m', '70cm'];

// store: dial, mode. Picking a band sets dial to the band's usual dial frequency.
export default {
  type: 'mode',
  title: 'Band & mode',
  description: 'Band and operating mode selection.',
  sizes: ['M', 'L'],
  size: 'M',
  options: [
    { key: 'bands', type: 'checks', label: 'Bands', default: ['80m', '40m', '30m', '20m', '17m', '15m', '10m'], choices: BANDS },
    { key: 'modes', type: 'checks', label: 'Modes', default: ['LSB', 'USB', 'CW', 'FM', 'DATA'], choices: modes },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, options: o } = ctx;
    const st = store.state;
    const b = h('div', 'hdw-scroll-x');
    const m = h('div', 'hdw-scroll-x');
    el.append(b, m);
    const out = [];
    if (o.bands.length) {
      const band = new BandSelector(h('div'), { value: bandForFrequency(st.dial)?.name, bands: o.bands });
      b.append(band.el);
      band.on('change', (e) => { if (e.detail.band) store.set({ dial: e.detail.band.dial }); });
      out.push(band);
    }
    let mode = null;
    if (o.modes.length) {
      mode = new ModeSelector(h('div'), { value: st.mode, modes: o.modes });
      m.append(mode.el);
      mode.on('change', (e) => store.set({ mode: e.detail.value }));
      out.push(mode);
    }
    const off = store.watch(['dial', 'mode'], () => { out[0]?.follow?.(st.dial); mode?.select(st.mode, { silent: true }); });
    return () => { off(); out.forEach((x) => x.destroy()); };
  },
};
