import { bandForFrequency } from 'hamui';
import { h, escape, needStore } from './util.js';

const MODES = ['CW', 'SSB', 'FT8', 'Other'];
const group = (m) => (MODES.includes(m) ? m : ['USB', 'LSB'].includes(m) ? 'SSB' : 'Other');

// store: spots = [{ dx, hz, mode, spotter, utc, comment }], newest first. Click a spot to tune.
export default {
  type: 'dx',
  title: 'DX Cluster',
  description: 'Latest DX spots. Click one to tune to it.',
  sizes: ['XS', 'M', 'L'],
  size: 'M',
  options: [
    { key: 'band', type: 'segmented', label: 'Bands', default: 'all', choices: [{ value: 'all', label: 'All' }, { value: 'current', label: 'Current band' }] },
    { key: 'modes', type: 'checks', label: 'Modes', default: MODES, choices: MODES },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, options: o, setStatus } = ctx;
    const st = store.state;
    const tune = (s) => {
      const patch = { dial: s.hz };
      if (s.mode === 'CW') patch.mode = 'CW';
      else if (group(s.mode) === 'SSB') patch.mode = s.hz < 10e6 ? 'LSB' : 'USB';
      store.set(patch);
    };
    const filtered = () => {
      const band = o.band === 'current' ? bandForFrequency(st.dial) : null;
      return (st.spots || []).filter((s) => o.modes.includes(group(s.mode)) && (!band || bandForFrequency(s.hz) === band));
    };
    let render;
    if (size === 'XS') {
      const b = h('button', 'hdw-xs-row hdw-xs-spot');
      b.type = 'button';
      el.append(b);
      render = () => {
        const s = filtered()[0];
        b.disabled = !s;
        b.title = s ? `Tune to ${s.dx}` : '';
        b.innerHTML = s ? `<span class="hdw-xs-val">${escape(s.dx)}</span><span class="hdw-xs-sub">${(s.hz / 1000).toFixed(1)} ${escape(s.mode)}</span>` : '<span class="hdw-xs-sub">No spots</span>';
        b.onclick = s ? () => tune(s) : null;
        setStatus(s ? 'latest' : '');
      };
    } else {
      const wide = size === 'L';
      const wrap = h('div', 'ham-table-wrap hdw-table');
      wrap.innerHTML = `<table class="ham-table ham-table-hover"><thead><tr><th>DX</th><th class="ham-num">kHz</th><th>Mode</th>${wide ? '<th>Spotter</th><th>UTC</th>' : ''}</tr></thead><tbody class="ham-mono"></tbody></table>`;
      el.append(wrap);
      const tb = wrap.querySelector('tbody');
      let list = [];
      tb.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) tune(list[+tr.dataset.i]); });
      render = () => {
        list = filtered();
        tb.innerHTML = list.map((s, i) => `<tr data-i="${i}" tabindex="0" title="Tune to ${escape(s.dx)}"><td>${escape(s.dx)}</td><td class="ham-num">${(s.hz / 1000).toFixed(1)}</td><td>${escape(s.mode)}</td>${wide ? `<td>${escape(s.spotter)}</td><td>${escape(s.utc)}</td>` : ''}</tr>`).join('');
        setStatus(`${list.length} spots`);
      };
      tb.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const tr = e.target.closest('tr[data-i]'); if (tr) tune(list[+tr.dataset.i]); } });
    }
    render();
    return store.watch(o.band === 'current' ? ['spots', 'dial'] : ['spots'], render);
  },
};
