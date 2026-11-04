// Demo: the built-in widgets driven by a simulated station.
import 'hamui/css';
import '../src/css/dashboard.css';
import './demo.css';
import * as H from 'hamui';
import { Dashboard, createStore, registerBuiltins } from '../src/index.js';

registerBuiltins();

/* ---------- simulated station ---------- */
const store = createStore({
  dial: 14074000, mode: 'USB', tx: false,
  power: 50, af: 42, rf: 100, sql: 0, maxPower: 100,
  smeter: -120, fwd: 0, swr: 1, alc: 0,
  spectrumHistory: [],
  decodes: [],
  spots: [],
  solar: {
    sfi: 142, ssn: 98, a: 8, k: 2, source: 'sample',
    bands: [
      { band: '80–40m', day: 'Fair', night: 'Good' },
      { band: '30–20m', day: 'Good', night: 'Good' },
      { band: '17–15m', day: 'Good', night: 'Fair' },
      { band: '12–10m', day: 'Fair', night: 'Poor' },
    ],
  },
});

const sim = new H.SignalSimulator({ startHz: 14069500, spanHz: 12000, bins: 2048 });
const HISTORY = 256;
const hist = store.state.spectrumHistory;
const t0 = Date.now();
for (let i = HISTORY; i > 0; i--) hist.push({ bins: sim.next(t0 - i * 50), ...sim.range });

store.watch(['dial'], ({ dial }) => {
  if (dial < sim.startHz + 500 || dial > sim.startHz + sim.spanHz - 500) { sim.setRange(dial - 4500); hist.length = 0; }
});

let level = -120, ramp = 0;
setInterval(() => {
  const frame = { bins: sim.next(), ...sim.range };
  hist.push(frame);
  if (hist.length > HISTORY) hist.shift();
  store.emit('spectrum', frame);
  const st = store.state;
  if (st.tx) {
    ramp = Math.min(1, ramp + 0.2);
    const wob = 0.88 + 0.12 * Math.random();
    store.set({ fwd: st.power * ramp * wob, swr: 1.3, alc: 30 * ramp * wob });
  } else {
    if (ramp) { ramp = 0; store.set({ fwd: 0, alc: 0 }); }
    const [lo, hi] = H.passbandFor(st.mode, st.filter);
    const dbm = sim.power(st.dial + lo, st.dial + hi);
    level += (dbm - level) * (dbm > level ? 0.6 : 0.1);
    store.set({ smeter: Math.round(level * 2) / 2 });
  }
}, 50);

// FT8 decodes every 15 s
const MSG = ['CQ JA1XYZ PM95', 'K1ABC DL2XYZ JO62', 'VK3DEF ZL1GHI RR73', 'CQ DX BG4AAA OM92', 'N0CALL HL2KKK PM37', 'CQ EA4ZZZ IN80', 'W5QRP R2ABC KO85 R-09', 'CQ POTA K4XYZ EM73', 'JH1ABC VE3XYZ 73', 'CQ BV2AA PL05', 'N0CALL JA1XYZ -15', 'CQ VK2XX QF56'];
let n = 0;
function decodeSlot(ago = 0) {
  const t = new Date(Date.now() - ago * 15000);
  const utc = t.toISOString().slice(11, 16).replace(':', '') + String(Math.floor(t.getUTCSeconds() / 15) * 15).padStart(2, '0');
  const fresh = Array.from({ length: 3 }, () => { n++; return { utc, db: -24 + ((n * 13) % 28), hz: 300 + ((n * 389) % 2600), msg: MSG[(n * 7) % MSG.length] }; });
  store.set({ decodes: [...fresh, ...store.state.decodes].slice(0, 500) });
}
for (let k = 5; k >= 0; k--) decodeSlot(k);
setInterval(decodeSlot, 15000);

// DX spots
const SPOTS = [['3D2AG', 14074000, 'JA1XYZ', 'FT8'], ['VP8LP', 14025000, 'DL1ABC', 'CW'], ['ZL7DX', 7074000, 'VK2XX', 'FT8'], ['FT8WW', 21074000, 'BG4AAA', 'FT8'], ['A35JT', 14195000, 'K1ABC', 'SSB'], ['T32AZ', 18100000, 'W6XYZ', 'FT8'], ['E51D', 10136000, 'JH1ABC', 'FT8'], ['VK9NK', 7012000, 'JA3AAA', 'CW'], ['KH8T', 28074000, 'W7XX', 'FT8'], ['5W1SA', 14260000, 'EA5XX', 'SSB']];
let si = 0;
const spot = (ago) => {
  const [dx, hz, spotter, mode] = SPOTS[si++ % SPOTS.length];
  const utc = new Date(Date.now() - ago * 60000).toISOString().slice(11, 16).replace(':', '') + 'Z';
  store.set({ spots: [{ dx, hz, spotter, mode, utc }, ...store.state.spots].slice(0, 50) });
};
for (let k = 9; k >= 0; k--) spot(k * 3);
setInterval(() => spot(0), 30000);

/* ---------- dashboard ---------- */
const dash = new Dashboard('#dash', {
  store,
  title: 'My station',
  subtitle: 'HamUI Dashboard · simulated data',
  storage: 'hamui-dashboard-demo-v1',
  defaultLayout: [
    ['panadapter', 'XL'], ['vfo', 'M'], ['meters', 'M'], ['ft8', 'L'],
    ['clock', 'XS'], ['solar', 'XS'], ['ptt', 'XS'], ['dx', 'XS'], ['knobs', 'M'], ['mode', 'M'],
  ],
});

const themeBox = document.createElement('div');
themeBox.className = 'ham-seg ham-seg-sm';
dash.toolbarExtra.append(themeBox);
const themeSeg = new H.Segmented(themeBox, { items: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }], value: H.theme.resolved(), label: 'Theme' });
themeSeg.on('change', (e) => H.theme.set(e.detail.value));
H.theme.onChange(() => themeSeg.select(H.theme.resolved(), { silent: true }));

window.dash = dash; // for poking at in the console
window.store = store;
