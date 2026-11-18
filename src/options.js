// Widget options: a small field schema, resolved values, and the form that
// edits them.
//
// A field:
//   { key: 'seconds', label: 'Show seconds', type: 'toggle', default: true }
// Types and their extra properties:
//   toggle     boolean
//   select     choices
//   segmented  choices (a few short ones)
//   checks     choices, value is an array of the selected values
//   number     min, max, step, unit
//   range      min, max, step, unit (slider with a readout)
//   text       placeholder, maxLength
//   levels     keys: [lowKey, highKey], min, max, step, minGap, unit, default: [low, high],
//              gradient (a colormap spec, or { option: 'colormap' } to follow another option),
//              auto: true for an Auto button that asks the widget (handle.auto(keys) -> [low, high])
// Common properties:
//   label, help, default (a value, or (size) => value),
//   sizes: only offered at these card sizes
// `choices` is a list of values or {value, label}.
//
// Only the values a user changes are saved; everything else follows the
// defaults, so a default that depends on the size keeps doing so.
import { Segmented, RangeSlider } from 'hamui';

const norm = (choices = []) => choices.map((c) => (c && typeof c === 'object' ? { value: c.value, label: c.label ?? String(c.value) } : { value: c, label: String(c) }));

export function fieldsFor(def, size) {
  return def.options.filter((f) => (f.key || f.keys) && (!f.sizes || f.sizes.includes(size)));
}

export function hasOptions(def, size) { return fieldsFor(def, size).length > 0; }

function defaultOf(f, size) { return typeof f.default === 'function' ? f.default(size) : f.default; }

function coerce(f, v, size) {
  const d = defaultOf(f, size);
  switch (f.type) {
    case 'toggle': return typeof v === 'boolean' ? v : !!d;
    case 'number':
    case 'range': {
      let n = Number(v);
      if (v === '' || v == null || !Number.isFinite(n)) return d;
      if (f.min != null) n = Math.max(f.min, n);
      if (f.max != null) n = Math.min(f.max, n);
      return n;
    }
    case 'select':
    case 'segmented': {
      const ok = norm(f.choices).some((c) => c.value === v);
      return ok ? v : d;
    }
    case 'checks': {
      if (!Array.isArray(v)) return d;
      const order = norm(f.choices).map((c) => c.value);
      return order.filter((x) => v.includes(x));
    }
    case 'text': return v == null ? d : String(v).slice(0, f.maxLength ?? 200);
    default: return v === undefined ? d : v;
  }
}

/** Values for every option of `def` at `size`: saved overrides on top of defaults. */
export function resolveOptions(def, size, saved = {}) {
  const out = {};
  for (const f of def.options) {
    if (f.type === 'levels' && f.keys) {
      const d = defaultOf(f, size) || [f.min ?? 0, f.max ?? 100];
      f.keys.forEach((k, i) => { out[k] = k in saved ? coerce({ type: 'number', min: f.min, max: f.max, default: d[i] }, saved[k], size) : d[i]; });
      continue;
    }
    if (!f.key) continue;
    out[f.key] = f.key in saved ? coerce(f, saved[f.key], size) : defaultOf(f, size);
  }
  return out;
}

let uid = 0;

/**
 * Build the form for `def` at `size` into `container`.
 * onChange(key, value) fires as the user edits (sliders and toggles live,
 * number and text fields when committed); a levels field passes a patch
 * object as `key`. actions.auto(keys), when given, backs the levels Auto button.
 */
export function renderOptionsForm(container, def, size, values, onChange, actions = {}) {
  const cleanups = [];
  const fields = fieldsFor(def, size);
  container.replaceChildren();
  for (const f of fields) {
    const id = `hd-opt-${++uid}`;
    const wrap = document.createElement('div');
    wrap.className = 'ham-field hd-opt';
    if (f.key) wrap.dataset.key = f.key;
    wrap.dataset.type = f.type || 'text';
    const v = values[f.key];
    const label = (forId) => { const l = document.createElement(forId ? 'label' : 'span'); l.className = 'hd-opt-label'; if (forId) l.htmlFor = forId; l.textContent = f.label ?? f.key; return l; };

    switch (f.type) {
      case 'toggle': {
        const l = document.createElement('label');
        l.className = 'ham-switch';
        const i = document.createElement('input');
        i.type = 'checkbox'; i.checked = !!v; i.id = id;
        i.addEventListener('change', () => onChange(f.key, i.checked));
        l.append(i, document.createTextNode(` ${f.label ?? f.key}`));
        wrap.append(l);
        break;
      }
      case 'select': {
        const s = document.createElement('select');
        s.className = 'ham-select'; s.id = id;
        for (const c of norm(f.choices)) { const o = document.createElement('option'); o.value = String(c.value); o.textContent = c.label; o.selected = c.value === v; s.append(o); }
        s.addEventListener('change', () => { const c = norm(f.choices).find((x) => String(x.value) === s.value); onChange(f.key, c ? c.value : s.value); });
        wrap.append(label(id), s);
        break;
      }
      case 'segmented': {
        const box = document.createElement('div');
        box.className = 'ham-seg ham-seg-sm';
        const choices = norm(f.choices);
        const seg = new Segmented(box, { items: choices.map((c) => ({ value: String(c.value), label: c.label })), value: String(v), label: f.label });
        seg.on('change', (e) => { const c = choices.find((x) => String(x.value) === e.detail.value); onChange(f.key, c ? c.value : e.detail.value); });
        cleanups.push(() => seg.destroy());
        wrap.append(label(), box);
        break;
      }
      case 'checks': {
        const box = document.createElement('div');
        box.className = 'hd-opt-checks';
        box.setAttribute('role', 'group');
        const cur = new Set(v || []);
        const choices = norm(f.choices);
        for (const c of choices) {
          const l = document.createElement('label');
          l.className = 'ham-check';
          const i = document.createElement('input');
          i.type = 'checkbox'; i.checked = cur.has(c.value);
          i.addEventListener('change', () => {
            if (i.checked) cur.add(c.value); else cur.delete(c.value);
            onChange(f.key, choices.map((x) => x.value).filter((x) => cur.has(x)));
          });
          l.append(i, document.createTextNode(` ${c.label}`));
          box.append(l);
        }
        const lab = label(); box.setAttribute('aria-label', f.label ?? f.key);
        wrap.append(lab, box);
        break;
      }
      case 'levels': {
        const host = document.createElement('div');
        const gradientOf = (vals) => (f.gradient?.option ? vals[f.gradient.option] : f.gradient ?? null);
        const rs = new RangeSlider(host, {
          label: f.label, min: f.min ?? 0, max: f.max ?? 100, step: f.step ?? 1, minGap: f.minGap ?? 0,
          unit: f.unit ?? '', value: f.keys.map((k) => values[k]), gradient: gradientOf(values),
        });
        // an end left at its default is not saved (undefined removes the override)
        const d = defaultOf(f, size) || [];
        const patch = (v) => Object.fromEntries(f.keys.map((k, i) => [k, v[i] === d[i] ? undefined : v[i]]));
        const send = (e) => onChange(patch(e.detail.value));
        rs.on('input', send);
        rs.on('change', send);
        if (f.auto && actions.auto) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ham-btn ham-btn-sm ham-btn-ghost hd-opt-auto';
          b.textContent = 'Auto';
          b.title = 'Set from the current signal levels';
          b.addEventListener('click', () => { const v = actions.auto(f.keys); if (v) { rs.setValue(v, { silent: true }); onChange(patch(rs.value)); } });
          rs.extra.append(b);
        }
        wrap.dataset.keys = f.keys.join(' ');
        wrap._levels = { rs, gradientOf };
        cleanups.push(() => rs.destroy());
        wrap.append(host);
        break;
      }
      case 'range': {
        const row = document.createElement('div');
        row.className = 'hd-opt-range';
        const i = document.createElement('input');
        Object.assign(i, { type: 'range', className: 'ham-range', id, min: f.min ?? 0, max: f.max ?? 100, step: f.step ?? 1, value: v });
        const out = document.createElement('output');
        out.className = 'ham-mono';
        const show = () => { out.textContent = `${i.value}${f.unit ? ` ${f.unit}` : ''}`; };
        show();
        i.addEventListener('input', () => { show(); onChange(f.key, Number(i.value)); });
        row.append(i, out);
        wrap.append(label(id), row);
        break;
      }
      case 'number': {
        const g = document.createElement(f.unit ? 'div' : 'span');
        if (f.unit) g.className = 'ham-input-group';
        const i = document.createElement('input');
        Object.assign(i, { type: 'number', className: 'ham-input ham-mono', id, value: v, inputMode: 'decimal' });
        if (f.min != null) i.min = f.min;
        if (f.max != null) i.max = f.max;
        if (f.step != null) i.step = f.step;
        i.addEventListener('change', () => { const n = coerce(f, i.value, size); i.value = n; onChange(f.key, n); });
        g.append(i);
        if (f.unit) { const a = document.createElement('span'); a.className = 'ham-addon'; a.textContent = f.unit; g.append(a); }
        wrap.append(label(id), f.unit ? g : i);
        break;
      }
      default: {
        const i = document.createElement('input');
        Object.assign(i, { type: 'text', className: 'ham-input', id, value: v ?? '' });
        if (f.placeholder) i.placeholder = f.placeholder;
        if (f.maxLength) i.maxLength = f.maxLength;
        i.addEventListener('change', () => onChange(f.key, i.value));
        wrap.append(label(id), i);
      }
    }
    if (f.help) { const h = document.createElement('span'); h.className = 'ham-field-help'; h.textContent = f.help; wrap.append(h); }
    container.append(wrap);
  }
  const cleanup = () => cleanups.forEach((c) => c());
  cleanup.update = (next) => {
    for (const wrap of container.children) {
      if (wrap._levels) {
        const { rs, gradientOf } = wrap._levels;
        rs.setValue(wrap.dataset.keys.split(' ').map((k) => next[k]), { silent: true });
        const g = gradientOf(next);
        if (g !== rs.options.gradient) rs.setGradient(g);
        continue;
      }
      const value = next[wrap.dataset.key];
      const input = wrap.querySelector('input[type=number], input[type=text], input[type=range], select');
      if (input && input.value !== String(value ?? '')) input.value = value ?? '';
      const checkbox = wrap.querySelector('input[type=checkbox]');
      if (wrap.dataset.type === 'toggle' && checkbox) checkbox.checked = !!value;
    }
  };
  return cleanup;
}
