import { h, escape, needStore } from './util.js';

// store: decodes = [{ utc: '123015', db: -12, dt: 0.1, hz: 1234, msg: 'CQ K1ABC FN42' }], newest first
export default {
  type: 'ft8',
  title: 'FT8 decodes',
  description: 'Decoded FT8 messages, CQ calls highlighted.',
  sizes: ['M', 'L'],
  size: 'L',
  options: [
    { key: 'cqOnly', type: 'toggle', label: 'Only CQ calls', default: false },
    { key: 'highlight', type: 'toggle', label: 'Highlight CQ calls', default: true },
    { key: 'call', type: 'text', label: 'My call (highlighted when mentioned)', default: '', placeholder: 'N0CALL', maxLength: 12 },
    { key: 'rows', type: 'number', label: 'Keep at most', unit: 'rows', min: 10, max: 500, step: 10, default: 100 },
  ],
  mount(ctx) {
    if (needStore(ctx)) return;
    const { el, store, options: o, setStatus } = ctx;
    const wrap = h('div', 'ham-table-wrap hdw-table');
    wrap.innerHTML = '<table class="ham-table ham-table-hover"><thead><tr><th>UTC</th><th class="ham-num">dB</th><th class="ham-num">Hz</th><th>Message</th></tr></thead><tbody class="ham-mono"></tbody></table>';
    el.append(wrap);
    const tb = wrap.querySelector('tbody');
    const call = o.call.trim().toUpperCase();
    const render = () => {
      let list = store.state.decodes || [];
      if (o.cqOnly) list = list.filter((d) => /^CQ\b/.test(d.msg));
      list = list.slice(0, o.rows);
      tb.innerHTML = list.map((d) => {
        const mine = call && d.msg.toUpperCase().split(/\s+/).includes(call);
        const c = mine ? 'is-mine' : o.highlight && /^CQ\b/.test(d.msg) ? 'is-highlight' : '';
        return `<tr${c ? ` class="${c}"` : ''}><td>${escape(d.utc)}</td><td class="ham-num">${escape(d.db)}</td><td class="ham-num">${escape(d.hz)}</td><td>${escape(d.msg)}</td></tr>`;
      }).join('');
      setStatus(`${list.length} decodes`);
    };
    render();
    return store.watch(['decodes'], render);
  },
};
