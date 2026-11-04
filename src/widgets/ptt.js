import { TxIndicator, Ptt } from 'hamui';
import { h, needStore } from './util.js';

// store: tx (boolean). Pressing PTT sets tx.
export default {
  type: 'ptt',
  title: 'Transmit',
  description: 'TX/RX status and a PTT button.',
  sizes: ['XS', 'S', 'M'],
  size: 'S',
  options: [
    { key: 'mode', type: 'segmented', label: 'PTT button', default: 'momentary', choices: [{ value: 'momentary', label: 'Hold to talk' }, { value: 'toggle', label: 'Toggle' }] },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, size, options: o } = ctx;
    const box = h('div', size === 'XS' ? 'hdw-xs-row' : 'hdw-ptt');
    el.append(box);
    const t = h('span');
    const b = h('button');
    box.append(t, b);
    const trx = new TxIndicator(t);
    const ptt = new Ptt(b, { mode: o.mode });
    ptt.on('ptt', (e) => store.set({ tx: e.detail.on }));
    const sync = () => { trx.set(store.state.tx ? 'tx' : 'rx'); ptt.set(!!store.state.tx, { silent: true }); };
    sync();
    const off = store.watch(['tx'], sync);
    return () => {
      off();
      const wasOn = ptt.isOn;
      ptt.destroy();
      trx.destroy();
      if (wasOn) store.set({ tx: false }); // never leave the radio transmitting
    };
  },
};
