import { Clock } from 'hamui';
import { h } from './util.js';

const fmtDate = (d, utc) => (utc ? d.toISOString() : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()).slice(0, 10);

export default {
  type: 'clock',
  title: 'UTC',
  description: 'UTC or local time; size M shows the other one too.',
  sizes: ['XS', 'S', 'M'],
  size: 'S',
  multiple: true,
  options: [
    { key: 'zone', type: 'segmented', label: 'Time zone', default: 'utc', choices: [{ value: 'utc', label: 'UTC' }, { value: 'local', label: 'Local' }] },
    { key: 'seconds', type: 'toggle', label: 'Show seconds', default: true },
    { key: 'date', type: 'toggle', label: 'Show the date', default: true },
    { key: 'other', type: 'toggle', label: 'Also show the other time zone', default: true, sizes: ['M'] },
  ],
  mount(ctx) {
    const { el, size, options: o, setStatus, setTitle } = ctx;
    const utc = o.zone === 'utc';
    setTitle(utc ? 'UTC' : 'Local time');
    const t = h('time', size === 'XS' ? 'hdw-xs-val' : 'hdw-time');
    el.append(t);
    const clocks = [new Clock(t, { utc, seconds: o.seconds })];
    let d = null;
    if (size !== 'XS' && o.date) { d = h('div', 'hdw-sub'); el.append(d); }
    if (size === 'M' && o.other) {
      const row = h('div', 'hdw-sub');
      const lab = h('span', null, utc ? 'Local ' : 'UTC ');
      const t2 = h('time');
      row.append(lab, t2);
      el.append(row);
      clocks.push(new Clock(t2, { utc: !utc, seconds: o.seconds }));
    }
    const tick = () => {
      const now = new Date();
      if (d) d.textContent = fmtDate(now, utc);
      if (size === 'XS') setStatus(o.date ? fmtDate(now, utc).slice(5) : '');
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { clearInterval(id); clocks.forEach((c) => c.destroy()); };
  },
};
