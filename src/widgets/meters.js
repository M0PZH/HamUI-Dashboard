import { Meter, format } from 'hamui';
import { h, needStore } from './util.js';

const ALL = [{ value: 's', label: 'S' }, { value: 'power', label: 'Power' }, { value: 'swr', label: 'SWR' }, { value: 'alc', label: 'ALC' }];

// store: smeter (dBm, receive level), tx, fwd (W), swr, alc (%), maxPower (W, optional)
export default {
  type: 'meters',
  title: 'Meters',
  description: 'S-meter and transmit meters (power, SWR, ALC).',
  sizes: ['XS', 'M', 'L'],
  size: 'M',
  multiple: true,
  options: [
    { key: 'show', type: 'checks', label: 'Meters', choices: ALL, default: (size) => (size === 'L' ? ['s', 'power', 'swr', 'alc'] : ['s', 'power']), sizes: ['M', 'L'] },
    { key: 'dbm', type: 'toggle', label: 'Show dBm next to the S reading', default: true, sizes: ['M', 'L'] },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, options: o, setStatus } = ctx;
    const st = store.state;
    if (size === 'XS') {
      const v = h('span', 'hdw-xs-val');
      const bar = h('div', 'hdw-xs-bar', '<i></i>');
      el.append(v, bar);
      const fill = bar.firstChild;
      const render = () => {
        const tx = !!st.tx;
        v.classList.toggle('is-tx', tx);
        bar.classList.toggle('is-tx', tx);
        if (tx) {
          const w = st.fwd ?? 0, max = st.maxPower ?? 100;
          v.textContent = `${w < 10 ? w.toFixed(1) : Math.round(w)} W`;
          fill.style.width = `${Math.min(100, (w / max) * 100)}%`;
          setStatus('PWR');
        } else {
          const dbm = st.smeter ?? -127;
          v.textContent = format.dbmToS(dbm).label;
          fill.style.width = `${Math.max(0, Math.min(100, dbm + 127))}%`; // S0 … S9+40
          setStatus(`${Math.round(dbm)} dBm`);
        }
      };
      render();
      return store.watch(['smeter', 'tx', 'fwd'], render);
    }
    const show = o.show.length ? o.show : ['s'];
    const wrap = h('div', 'ham-meters hdw-meters');
    el.append(wrap);
    const m = {};
    for (const t of show) {
      const d = h('div');
      wrap.append(d);
      m[t] = new Meter(d, { type: t, off: t !== 's', showDbm: o.dbm, ...(t === 'power' ? { max: st.maxPower ?? 100 } : {}) });
    }
    let wasTx = null;
    const render = () => {
      const tx = !!st.tx;
      if (tx !== wasTx) {
        wasTx = tx;
        m.s?.setOff(tx, tx ? m.s.valueEl.textContent : undefined);
        for (const t of ['power', 'swr', 'alc']) m[t]?.setOff(!tx);
      }
      if (tx) { m.power?.set(st.fwd ?? 0); m.swr?.set(st.swr ?? 1); m.alc?.set(st.alc ?? 0); }
      else m.s?.set(st.smeter ?? -127);
    };
    render();
    const off = store.watch(['smeter', 'tx', 'fwd', 'swr', 'alc'], render);
    return () => { off(); Object.values(m).forEach((x) => x.destroy()); };
  },
};
