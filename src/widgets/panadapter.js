import { Panadapter, passbandFor, format } from 'hamui';
import { h, needStore } from './util.js';

// store: dial, mode, filter (Hz, optional); event 'spectrum' {bins, startHz, spanHz};
// optional state spectrumHistory: recent frames (oldest first) to pre-fill the waterfall.
export default {
  type: 'panadapter',
  title: 'Panadapter',
  description: 'Spectrum and waterfall. Click to tune; pinch or Ctrl-scroll to zoom.',
  sizes: ['L', 'XL'],
  size: 'XL',
  flush: true,
  options: [
    { key: 'colormap', type: 'select', label: 'Waterfall colours', default: 'theme', choices: [
      { value: 'theme', label: 'Theme' }, { value: 'viridis', label: 'Viridis' }, { value: 'inferno', label: 'Inferno' },
      { value: 'plasma', label: 'Plasma' }, { value: 'turbo', label: 'Turbo' }, { value: 'gray', label: 'Grey' }] },
    { key: 'split', type: 'range', label: 'Spectrum height', min: 25, max: 75, step: 5, unit: '%', default: 45 },
    { key: 'averaging', type: 'segmented', label: 'Averaging', default: 0.35, choices: [
      { value: 1, label: 'Off' }, { value: 0.5, label: 'Low' }, { value: 0.35, label: 'Mid' }, { value: 0.2, label: 'High' }] },
    { key: 'peakHold', type: 'toggle', label: 'Peak hold', default: true },
    { key: 'minDb', type: 'number', label: 'Spectrum floor', unit: 'dBm', min: -170, max: 0, step: 1, default: -128 },
    { key: 'maxDb', type: 'number', label: 'Spectrum top', unit: 'dBm', min: -170, max: 0, step: 1, default: -62 },
    { key: 'wfMinDb', type: 'number', label: 'Waterfall floor', unit: 'dBm', min: -170, max: 0, step: 1, default: -125 },
    { key: 'wfMaxDb', type: 'number', label: 'Waterfall top', unit: 'dBm', min: -170, max: 0, step: 1, default: -75 },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, options: o, setStatus } = ctx;
    const st = store.state;
    const host = h('div', 'hdw-pan');
    host.style.setProperty('--hdw-split', `${o.split}%`);
    el.append(host);
    const last = st.spectrumHistory?.[st.spectrumHistory.length - 1];
    const pan = new Panadapter(host, {
      startHz: last?.startHz ?? (st.dial ?? 14074000) - 6000,
      spanHz: last?.spanHz ?? 12000,
      minSpan: 300,
      minDb: o.minDb, maxDb: o.maxDb, wfMinDb: o.wfMinDb, wfMaxDb: o.wfMaxDb,
      spectrum: { averaging: o.averaging, peakHold: o.peakHold },
      waterfall: { colormap: o.colormap },
    });
    for (const f of st.spectrumHistory || []) pan.waterfall.push(f.bins, f);
    const sync = () => {
      if (st.dial != null) { pan.setDial(st.dial); pan.view.reveal(st.dial); }
      if (st.mode) pan.setPassband(passbandFor(st.mode, st.filter));
    };
    sync();
    const span = () => setStatus(format.formatSpan(pan.view.span));
    span();
    pan.on('viewchange', span);
    pan.on('tune', (e) => { e.preventDefault(); store.set({ dial: e.detail.hz }); });
    const offs = [
      store.on('spectrum', (f) => pan.push(f.bins, f)),
      store.watch(['dial', 'mode', 'filter'], sync),
    ];
    return {
      update(n) {
        host.style.setProperty('--hdw-split', `${n.split}%`);
        pan.waterfall.setColormap(n.colormap);
        pan.spectrum.setAveraging(n.averaging);
        pan.spectrum.setPeakHold(n.peakHold);
        pan.spectrum.setLevels(Math.min(n.minDb, n.maxDb - 10), n.maxDb);
        pan.waterfall.setLevels(Math.min(n.wfMinDb, n.wfMaxDb - 5), n.wfMaxDb);
      },
      resize: () => true,
      destroy() { offs.forEach((f) => f()); pan.destroy(); },
    };
  },
};
