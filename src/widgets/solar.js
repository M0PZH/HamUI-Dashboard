import { h, escape, needStore } from './util.js';

const cls = (v) => ({ good: 'is-good', fair: 'is-fair', poor: 'is-poor' })[String(v).toLowerCase()] || '';

// store: solar = { sfi, ssn, a, k, bands: [{ band: '80–40m', day: 'Good', night: 'Fair' }], source }
export default {
  type: 'solar',
  title: 'Propagation',
  description: 'Solar flux, K index and band conditions.',
  sizes: ['XS', 'S', 'M', 'L'],
  size: 'S',
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, setStatus } = ctx;
    const render = () => {
      const s = store.state.solar;
      setStatus(s?.source ?? '');
      if (!s) { el.innerHTML = '<div class="hd-error">No propagation data</div>'; return; }
      if (size === 'XS') {
        el.innerHTML = `<span class="hdw-xs-val">${escape(s.sfi)}</span><span class="hdw-xs-sub">SFI · K ${escape(s.k)}</span>`;
        return;
      }
      let html = `<div class="hdw-kvs"><div>SFI <b>${escape(s.sfi)}</b></div><div>SSN <b>${escape(s.ssn)}</b></div><div>A <b>${escape(s.a)}</b></div><div>K <b>${escape(s.k)}</b></div></div>`;
      if (size !== 'S' && s.bands?.length) {
        const rows = size === 'L' ? s.bands : s.bands.slice(0, 3);
        html += `<table class="hdw-cond"><tr><th>Band</th><th>Day</th><th>Night</th></tr>${rows.map((b) => `<tr><td class="ham-mono">${escape(b.band)}</td><td class="${cls(b.day)}">${escape(b.day)}</td><td class="${cls(b.night)}">${escape(b.night)}</td></tr>`).join('')}</table>`;
      }
      el.innerHTML = html;
    };
    render();
    return store.watch(['solar'], render);
  },
};
