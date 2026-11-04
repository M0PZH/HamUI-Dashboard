// The dashboard: a grid of widget cards that the user can rearrange, resize,
// remove, add from a gallery and configure through each card's options.
//
//   const dash = new Dashboard('#dash', {
//     store,                                  // shared data for the widgets
//     defaultLayout: [['vfo', 'M'], ['clock', 'S']],
//     storage: 'my-app-dashboard',            // localStorage key, {load, save} or null
//   });
//
// Layout JSON: { version: 1, items: [{ id, type, size, options }] } where
// `options` holds only the values the user changed.
import { haptics, Modal } from 'hamui';
import { widgets as registry } from './registry.js';
import { resolveOptions, hasOptions, renderOptionsForm } from './options.js';

const DEFAULTS = {
  widgets: null,            // allowed widget types (default: every registered type)
  layout: null,             // initial layout; overrides what is stored
  defaultLayout: [],        // used when nothing is stored, and by reset()
  storage: 'hamui-dashboard', // localStorage key, { load(), save(layout) }, or null
  store: null,              // handed to widgets as ctx.store
  title: 'Dashboard',
  subtitle: '',
  toolbar: true,            // render the title bar with Edit / Add / Reset
  editable: true,
  optionsButton: 'always',  // when cards show their options button: 'always' | 'edit' | 'never'
  holdToEdit: 500,          // ms touch hold on a card that enters edit mode (0 = off)
  holdToDrag: 280,          // ms touch hold before a card can be dragged in edit mode
  haptics: true,
};

const GRIP = '<svg class="hd-grip" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/></svg>';
const SLIDERS = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><path d="M2 4h7M13 4h1M2 12h1M7 12h7M2 8h3M9 8h5"/><circle cx="11" cy="4" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="7" cy="8" r="1.6"/></svg>';
// controls that keep their own touch gestures: a hold there is not "enter edit mode"
const INTERACTIVE = 'button, input, select, textarea, a[href], label, [role="slider"], [role="spinbutton"], [role="application"], [contenteditable], .hd-no-hold';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const newId = (type) => `${type}-${Math.random().toString(36).slice(2, 8)}`;

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export class Dashboard {
  constructor(target, options = {}) {
    const root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) throw new Error('Dashboard: element not found');
    this.el = root;
    this.options = { ...DEFAULTS, ...options };
    this.store = this.options.store;
    this.cards = new Map(); // node -> card
    this.editing = false;
    this._ac = new AbortController();
    this._saveTimer = 0;
    this._build();
    this._bind();
    this.setLayout(this.options.layout ?? this._load() ?? this.options.defaultLayout, { save: false });
  }

  /* ---------------- public API ---------------- */

  /** The widget types this dashboard offers. */
  get types() {
    const allow = this.options.widgets;
    return registry.list().filter((d) => !allow || allow.includes(d.type));
  }

  /** Current layout as plain JSON. */
  getLayout() {
    return {
      version: 1,
      items: this._nodes().map((n) => {
        const c = this.cards.get(n);
        const item = { id: c.id, type: c.type, size: c.size };
        if (Object.keys(c.saved).length) item.options = { ...c.saved };
        return item;
      }),
    };
  }

  /** Replace every card. Accepts a layout object, or an array of items / [type, size, options]. */
  setLayout(layout, { save = true } = {}) {
    for (const c of this.cards.values()) this._unmount(c);
    this.cards.clear();
    const items = this._normalize(layout);
    this.board.replaceChildren(...items.map((it) => this._createCard(it).node));
    for (const c of this.cards.values()) this._mount(c);
    this._updateEmpty();
    if (save) this._changed();
  }

  /** Add a widget; returns its id. */
  add(type, { size, options, index } = {}) {
    const def = this._def(type);
    if (!def) throw new Error(`Dashboard: unknown widget "${type}"`);
    const card = this._createCard({ type, size: def.sizes.includes(size) ? size : def.size, options: options || {} });
    card.node.classList.add('is-new');
    if (this.editing) card.node.tabIndex = 0;
    this._flip(() => {
      this.board.querySelector('.hd-empty')?.remove();
      const ref = index != null ? this._nodes()[index] : null;
      this.board.insertBefore(card.node, ref || null);
    });
    this._mount(card);
    this._changed();
    return card.id;
  }

  remove(id) {
    const c = this._card(id);
    if (!c) return;
    this._unmount(c);
    this.cards.delete(c.node);
    this._flip(() => c.node.remove());
    this._updateEmpty();
    this._changed();
  }

  resize(id, size) {
    const c = this._card(id);
    if (!c || !c.def.sizes.includes(size) || c.size === size) return;
    c.size = size;
    c.node.querySelectorAll('.hd-sizes button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.size === size)));
    this._flip(() => { c.node.dataset.size = size; });
    // widgets that can follow a size change in place say so by returning anything but false
    let kept = false;
    if (c.handle?.resize) {
      const options = resolveOptions(c.def, size, c.saved);
      try { kept = c.handle.resize(size, options) !== false; } catch (err) { console.error(err); }
      if (kept) {
        c.options = options;
        Object.assign(c.ctx, { size, options });
        c.optBtn.hidden = this.options.optionsButton === 'never' || !hasOptions(c.def, size);
      }
    }
    if (!kept) this._mount(c);
    this._haptic('select');
    this._changed();
  }

  /** Move a card to position `index` among the cards. */
  move(id, index) {
    const c = this._card(id);
    if (!c) return;
    const nodes = this._nodes().filter((n) => n !== c.node);
    this._flip(() => this.board.insertBefore(c.node, nodes[index] || null));
    this._changed();
  }

  /** Change some of a card's options (merged into what the user set). */
  setOptions(id, patch) {
    const c = this._card(id);
    if (!c) return;
    c.saved = { ...c.saved, ...patch };
    this._applyOptions(c);
    this._changed();
  }

  resetOptions(id) {
    const c = this._card(id);
    if (!c) return;
    c.saved = {};
    this._applyOptions(c);
    this._changed();
  }

  /** Resolved options of a card (defaults included). */
  getOptions(id) { const c = this._card(id); return c ? { ...c.options } : null; }

  reset() { this.setLayout(this.options.defaultLayout); }

  edit(on = !this.editing) {
    on = !!on && this.options.editable;
    if (on === this.editing) return;
    this.editing = on;
    this.el.classList.toggle('is-editing', on);
    for (const n of this._nodes()) n.tabIndex = on ? 0 : -1;
    if (this.toolbar) {
      this.editBtn.textContent = on ? 'Done' : 'Edit';
      this.editBtn.setAttribute('aria-pressed', String(on));
      this.addBtn.hidden = !on;
      this.resetBtn.hidden = !on;
      this.hint.hidden = !on;
    }
    if (!on) this._cancelPress();
    this._emit('editchange', { editing: on });
  }

  openGallery() {
    const present = new Set([...this.cards.values()].map((c) => c.type));
    this.gList.replaceChildren(...this.types.map((d) => {
      const taken = present.has(d.type) && !d.multiple;
      const row = el('div', 'hd-g-item', `<h4>${esc(d.title)}</h4><p>${esc(d.description || '')}</p>
        <div class="hd-g-act"><div class="hd-g-sizes">${d.sizes.map((s) => `<span class="ham-badge">${s}</span>`).join('')}</div>
        <button class="ham-btn ham-btn-sm${taken ? '' : ' ham-btn-primary'}" type="button" data-add="${esc(d.type)}"${taken ? ' disabled' : ''}>${taken ? 'Added' : 'Add'}</button></div>`);
      return row;
    }));
    this.gallery.open();
  }

  openOptions(id) {
    const c = this._card(id);
    if (!c || !hasOptions(c.def, c.size)) return;
    this._optCard = c;
    this.oTitle.textContent = `${c.title} options`;
    this._renderOptions();
    this.optionsDlg.open();
  }

  /** Listen to 'change' {layout} or 'editchange' {editing}. Returns an unsubscribe function. */
  on(name, fn) {
    const h = (e) => fn(e);
    this.el.addEventListener(`hd:${name}`, h);
    return () => this.el.removeEventListener(`hd:${name}`, h);
  }

  destroy() {
    clearTimeout(this._saveTimer);
    if (this._saveTimer) this._save();
    for (const c of this.cards.values()) this._unmount(c);
    this.cards.clear();
    this._ac.abort();
    this._optCleanup?.();
    this.gallery.destroy();
    this.optionsDlg.destroy();
    this.el.replaceChildren();
    this.el.classList.remove('hd', 'is-editing');
  }

  /* ---------------- building ---------------- */

  _build() {
    const o = this.options;
    this.el.classList.add('hd');
    this.el.dataset.optionsButton = o.optionsButton;
    this.el.replaceChildren();
    this.toolbar = null;
    if (o.toolbar) {
      const bar = el('header', 'hd-toolbar', `
        <div class="hd-title"><h2></h2><span></span></div>
        <div class="hd-toolbar-extra"></div>
        <span class="ham-spacer"></span>
        <button class="ham-btn" type="button" data-act="add" hidden>Add widget</button>
        <button class="ham-btn" type="button" data-act="reset" hidden>Reset layout</button>
        <button class="ham-btn ham-btn-primary" type="button" data-act="edit" aria-pressed="false">Edit</button>`);
      bar.querySelector('h2').textContent = o.title;
      const sub = bar.querySelector('.hd-title span');
      sub.textContent = o.subtitle;
      sub.hidden = !o.subtitle;
      this.toolbar = bar;
      /** Put your own controls (theme switch, connection status…) in here. */
      this.toolbarExtra = bar.querySelector('.hd-toolbar-extra');
      this.addBtn = bar.querySelector('[data-act=add]');
      this.resetBtn = bar.querySelector('[data-act=reset]');
      this.editBtn = bar.querySelector('[data-act=edit]');
      this.editBtn.hidden = !o.editable;
      this.hint = el('div', 'hd-hint', 'Drag cards to rearrange them. Change the size in a card’s bottom-right corner, remove it with − . On a touch screen, hold a card for a moment before dragging. Press <kbd>Esc</kbd> when done.');
      this.hint.hidden = true;
      this.el.append(bar, this.hint);
    }
    this.board = el('div', 'hd-board');
    this.board.setAttribute('role', 'list');
    this.board.setAttribute('aria-label', o.title);
    this.el.append(this.board);

    // gallery
    const g = el('dialog', 'ham-modal hd-gallery', `
      <div class="ham-modal-head"><h3 class="ham-modal-title">Add widget</h3>
        <button class="ham-btn ham-btn-ghost ham-btn-sm ham-btn-icon" type="button" data-ham-close aria-label="Close">×</button></div>
      <div class="ham-modal-body"><div class="hd-g-list"></div></div>`);
    this.gList = g.querySelector('.hd-g-list');
    // options
    const d = el('dialog', 'ham-modal hd-options', `
      <div class="ham-modal-head"><h3 class="ham-modal-title"></h3>
        <button class="ham-btn ham-btn-ghost ham-btn-sm ham-btn-icon" type="button" data-ham-close aria-label="Close">×</button></div>
      <div class="ham-modal-body"><form class="hd-opt-form" method="dialog"></form></div>
      <div class="ham-modal-foot">
        <button class="ham-btn ham-btn-ghost" type="button" data-act="opt-reset">Reset to defaults</button>
        <span class="ham-spacer"></span>
        <button class="ham-btn ham-btn-primary" type="button" data-ham-close>Done</button></div>`);
    this.oTitle = d.querySelector('.ham-modal-title');
    this.oForm = d.querySelector('.hd-opt-form');
    this.el.append(g, d);
    this.gallery = new Modal(g);
    this.optionsDlg = new Modal(d);
  }

  _normalize(layout) {
    const list = Array.isArray(layout) ? layout : Array.isArray(layout?.items) ? layout.items : [];
    const out = [];
    const seen = new Set();
    for (const raw of list) {
      const it = Array.isArray(raw) ? { type: raw[0], size: raw[1], options: raw[2] } : { ...raw };
      const def = this._def(it.type);
      if (!def) { console.warn(`Dashboard: skipping unknown widget "${it.type}"`); continue; }
      if (!def.sizes.includes(it.size)) it.size = def.size;
      if (!it.id || seen.has(it.id)) it.id = newId(it.type);
      seen.add(it.id);
      it.options = it.options && typeof it.options === 'object' ? it.options : {};
      out.push(it);
    }
    return out;
  }

  _def(type) {
    const d = registry.get(type);
    return d && (!this.options.widgets || this.options.widgets.includes(type)) ? d : null;
  }

  _createCard({ type, id = newId(type), size, options = {} }) {
    const def = this._def(type);
    const node = el('article', 'hd-card');
    Object.assign(node.dataset, { type, size, id });
    node.setAttribute('role', 'listitem');
    node.setAttribute('aria-label', def.title);
    node.tabIndex = this.editing ? 0 : -1;
    node.innerHTML = `<header class="hd-card-head">${GRIP}<span class="ham-label hd-card-title"></span><span class="hd-card-status"></span>
        <button class="hd-card-options ham-btn ham-btn-ghost ham-btn-sm ham-btn-icon" type="button" hidden>${SLIDERS}</button></header>
      <div class="hd-card-body"></div>
      <button class="hd-remove" type="button">−</button>
      <div class="hd-sizes ham-seg ham-seg-sm ham-seg-mono" role="group" aria-label="Size">${def.sizes.map((s) => `<button type="button" data-size="${s}" aria-pressed="${s === size}">${s}</button>`).join('')}</div>`;
    if (def.sizes.length < 2) node.querySelector('.hd-sizes').remove();
    const card = {
      id, type, def, size, node,
      saved: { ...options },
      options: {},
      title: def.title,
      body: node.querySelector('.hd-card-body'),
      titleEl: node.querySelector('.hd-card-title'),
      statusEl: node.querySelector('.hd-card-status'),
      optBtn: node.querySelector('.hd-card-options'),
      handle: null,
      ac: null,
    };
    this._setTitle(card, def.title);
    this.cards.set(node, card);
    return card;
  }

  _setTitle(c, t) {
    c.title = t || c.def.title;
    c.titleEl.textContent = c.title;
    c.node.setAttribute('aria-label', c.title);
    c.optBtn.setAttribute('aria-label', `${c.title} options`);
    c.optBtn.title = 'Options';
    c.node.querySelector('.hd-remove').setAttribute('aria-label', `Remove ${c.title}`);
  }

  /* ---------------- mounting ---------------- */

  _mount(c) {
    this._unmount(c);
    const def = c.def;
    c.body.replaceChildren();
    c.body.classList.toggle('is-flush', !!def.flush);
    c.statusEl.textContent = '';
    this._setTitle(c, def.title);
    c.options = resolveOptions(def, c.size, c.saved);
    c.optBtn.hidden = this.options.optionsButton === 'never' || !hasOptions(def, c.size);
    c.ac = new AbortController();
    const ctx = {
      id: c.id,
      el: c.body,
      size: c.size,
      options: c.options,
      store: this.store,
      dashboard: this,
      signal: c.ac.signal,
      setStatus: (text) => { c.statusEl.textContent = text ?? ''; },
      setTitle: (text) => this._setTitle(c, text),
      haptic: (kind) => this._haptic(kind),
    };
    c.ctx = ctx;
    try {
      const r = def.mount(ctx);
      c.handle = typeof r === 'function' ? { destroy: r } : r && typeof r === 'object' ? r : {};
    } catch (err) {
      console.error(`Dashboard: widget "${def.type}" failed to mount`, err);
      c.body.replaceChildren(el('div', 'hd-error', `${esc(def.title)} could not be shown.`));
      c.handle = {};
    }
  }

  _unmount(c) {
    if (!c.handle && !c.ac) return;
    c.ac?.abort();
    try { c.handle?.destroy?.(); } catch (err) { console.error(`Dashboard: widget "${c.type}" failed to clean up`, err); }
    c.handle = null;
    c.ac = null;
  }

  _applyOptions(c) {
    const prev = c.options;
    const next = resolveOptions(c.def, c.size, c.saved);
    c.options = next;
    // widgets that can update in place say so by returning anything but false
    if (c.handle?.update) {
      let ok = false;
      try { ok = c.handle.update(next, prev) !== false; } catch (err) { console.error(err); }
      if (ok) { c.ctx.options = next; return; }
    }
    this._mount(c);
  }

  _renderOptions() {
    const c = this._optCard;
    this._optCleanup?.();
    this._optCleanup = renderOptionsForm(this.oForm, c.def, c.size, c.options, (key, value) => this.setOptions(c.id, { [key]: value }));
  }

  /* ---------------- persistence ---------------- */

  _load() {
    const s = this.options.storage;
    try {
      if (typeof s === 'string') { const raw = localStorage.getItem(s); return raw ? JSON.parse(raw) : null; }
      if (s && typeof s.load === 'function') return s.load() ?? null;
    } catch { /* unavailable or corrupt: fall back to the default layout */ }
    return null;
  }

  _save() {
    this._saveTimer = 0;
    const s = this.options.storage;
    const layout = this.getLayout();
    try {
      if (typeof s === 'string') localStorage.setItem(s, JSON.stringify(layout));
      else if (s && typeof s.save === 'function') s.save(layout);
    } catch { /* storage full or blocked */ }
  }

  _changed() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 200);
    this._emit('change', { layout: this.getLayout() });
  }

  _emit(name, detail) { this.el.dispatchEvent(new CustomEvent(`hd:${name}`, { detail, bubbles: true })); }

  _haptic(kind) { if (this.options.haptics) haptics.fire(kind, { source: this }); }

  /* ---------------- helpers ---------------- */

  _nodes() { return [...this.board.children].filter((n) => this.cards.has(n)); }

  _card(id) {
    for (const c of this.cards.values()) if (c.id === id) return c;
    return null;
  }

  _updateEmpty() {
    const has = this.cards.size > 0;
    let e = this.board.querySelector('.hd-empty');
    if (!has && !e) {
      e = el('div', 'hd-empty', this.options.editable ? 'No widgets yet. Choose <b>Edit</b>, then <b>Add widget</b>.' : 'No widgets.');
      this.board.append(e);
    }
    if (has && e) e.remove();
  }

  /** FLIP: animate cards from their old positions after a DOM change. */
  _flip(change) {
    const before = new Map([...this.board.children].map((n) => [n, n.getBoundingClientRect()]));
    change();
    if (reduced()) return;
    for (const n of this.board.children) {
      const a = before.get(n);
      if (!a || n.classList.contains('is-dragging')) continue;
      const b = n.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top;
      if (dx || dy) n.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  }

  /* ---------------- interaction ---------------- */

  _bind() {
    const signal = this._ac.signal;
    const on = (t, type, fn, opts = {}) => t.addEventListener(type, fn, { ...opts, signal });

    if (this.toolbar) {
      on(this.editBtn, 'click', () => this.edit());
      on(this.addBtn, 'click', () => this.openGallery());
      on(this.resetBtn, 'click', () => this.reset());
    }
    on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this.editing && !this.gallery.el.open && !this.optionsDlg.el.open) this.edit(false);
    });

    on(this.board, 'click', (e) => {
      const node = e.target.closest('.hd-card');
      const c = node && this.cards.get(node);
      if (!c) return;
      if (e.target.closest('.hd-card-options')) { this.openOptions(c.id); return; }
      if (!this.editing) return;
      if (e.target.closest('.hd-remove')) { this.remove(c.id); return; }
      const sb = e.target.closest('.hd-sizes button');
      if (sb) this.resize(c.id, sb.dataset.size);
    });

    on(this.board, 'keydown', (e) => {
      if (!this.editing) return;
      const node = e.target.closest('.hd-card');
      const c = node && this.cards.get(node);
      if (!c || e.target !== node) return;
      const nodes = this._nodes();
      const i = nodes.indexOf(node);
      const sizes = c.def.sizes, si = sizes.indexOf(c.size);
      let handled = true;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { if (i > 0) this.move(c.id, i - 1); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { if (i < nodes.length - 1) this.move(c.id, i + 1); }
      else if (e.key === '+' || e.key === '=') { if (si < sizes.length - 1) this.resize(c.id, sizes[si + 1]); }
      else if (e.key === '-') { if (si > 0) this.resize(c.id, sizes[si - 1]); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        const next = nodes[i + 1] || nodes[i - 1];
        this.remove(c.id);
        next?.focus();
      } else handled = false;
      if (handled) { e.preventDefault(); if (node.isConnected) node.focus(); }
    });

    on(this.gList, 'click', (e) => {
      const b = e.target.closest('[data-add]');
      if (!b) return;
      const id = this.add(b.dataset.add);
      this.gallery.close();
      const node = this._card(id)?.node;
      requestAnimationFrame(() => node?.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }));
    });

    on(this.optionsDlg.el, 'click', (e) => {
      if (e.target.closest('[data-act=opt-reset]') && this._optCard) {
        this.resetOptions(this._optCard.id);
        this._renderOptions();
      }
    });
    on(this.optionsDlg.el, 'close', () => { this._optCleanup?.(); this._optCleanup = null; this._optCard = null; });

    // ---- press / drag ----
    this._press = null;
    this._drag = null;
    on(this.board, 'pointerdown', (e) => this._onDown(e));
    on(window, 'pointermove', (e) => this._onMove(e), { passive: false });
    on(window, 'pointerup', (e) => this._onUp(e));
    on(window, 'pointercancel', (e) => this._onUp(e));
    // keep touch scrolling from fighting a drag
    on(document, 'touchmove', (e) => { if (this._drag || this._press?.armed) e.preventDefault(); }, { passive: false });
    on(this.board, 'contextmenu', (e) => { if (this.editing || this._press) e.preventDefault(); });
  }

  _onDown(e) {
    const node = e.target.closest('.hd-card');
    if (!node || !this.cards.has(node) || !this.options.editable) return;
    if (e.target.closest('.hd-remove, .hd-sizes, .hd-card-options')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const touch = e.pointerType !== 'mouse';
    if (!this.editing) {
      // touch: hold a card (not one of its controls) to enter edit mode
      if (!touch || !this.options.holdToEdit || e.target.closest(INTERACTIVE)) return;
    }
    const hold = !touch ? 0 : this.editing ? this.options.holdToDrag : this.options.holdToEdit;
    this._press = { node, id: e.pointerId, x: e.clientX, y: e.clientY, armed: hold === 0, timer: 0 };
    if (hold) {
      this._press.timer = setTimeout(() => {
        const p = this._press;
        if (!p) return;
        if (!this.editing) this.edit(true);
        p.armed = true;
        node.classList.add('is-armed');
        this._haptic('press');
      }, hold);
    }
  }

  _onMove(e) {
    const d = this._drag;
    if (d && e.pointerId === d.id) { e.preventDefault(); this._moveDrag(e); return; }
    const p = this._press;
    if (!p || e.pointerId !== p.id) return;
    const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (!p.armed) { if (dist > 8) this._cancelPress(); return; } // moved before the hold: a scroll
    if (this.editing && dist > 4) this._startDrag(p.node, e);
  }

  _onUp(e) {
    if (this._press && e.pointerId === this._press.id) this._cancelPress();
    if (this._drag && e.pointerId === this._drag.id) this._endDrag();
  }

  _cancelPress() {
    if (!this._press) return;
    clearTimeout(this._press.timer);
    this._press.node.classList.remove('is-armed');
    this._press = null;
  }

  _startDrag(node, e) {
    const r = node.getBoundingClientRect();
    const slot = el('div', 'hd-slot');
    slot.dataset.size = node.dataset.size;
    node.after(slot);
    this._cancelPress();
    this._drag = { node, slot, id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, over: null, raf: 0 };
    Object.assign(node.style, { width: `${r.width}px`, height: `${r.height}px`, left: `${r.left}px`, top: `${r.top}px` });
    node.classList.add('is-dragging');
    document.documentElement.classList.add('hd-dragging');
    this._autoScroll();
  }

  _moveDrag(e) {
    const d = this._drag;
    d.x = e.clientX; d.y = e.clientY;
    d.node.style.left = `${e.clientX - d.dx}px`;
    d.node.style.top = `${e.clientY - d.dy}px`;
    this._placeSlot();
  }

  _placeSlot() {
    const d = this._drag;
    const { node, slot } = d;
    const over = document.elementsFromPoint(d.x, d.y).find((n) => n !== node && this.cards.has(n));
    if (!over) {
      d.over = null;
      // past the last card: move to the end
      const nodes = this._nodes().filter((n) => n !== node);
      const last = nodes[nodes.length - 1];
      const br = this.board.getBoundingClientRect();
      if (last && d.y > last.getBoundingClientRect().bottom && d.y < br.bottom + 80 && slot.nextElementSibling) {
        this._flip(() => this.board.append(slot));
        this._haptic('tick');
      }
      return;
    }
    if (over === d.over) return;
    d.over = over;
    const r = over.getBoundingClientRect();
    const after = (d.x - r.left) / r.width > 0.5 || (d.y - r.top) / r.height > 0.66;
    const ref = after ? over.nextSibling : over;
    if (ref === slot || (after && over.nextSibling === slot) || (!after && over.previousSibling === slot)) return;
    this._flip(() => this.board.insertBefore(slot, ref));
    this._haptic('tick');
  }

  _autoScroll() {
    const d = this._drag;
    if (!d) return;
    const edge = 56;
    const v = d.y < edge ? -(edge - d.y) : d.y > innerHeight - edge ? d.y - (innerHeight - edge) : 0;
    if (v) { scrollBy(0, Math.round(v / 3)); this._placeSlot(); }
    d.raf = requestAnimationFrame(() => this._autoScroll());
  }

  _endDrag() {
    const d = this._drag;
    this._drag = null;
    cancelAnimationFrame(d.raf);
    const { node, slot } = d;
    const to = slot.getBoundingClientRect();
    const from = node.getBoundingClientRect();
    slot.replaceWith(node);
    node.classList.remove('is-dragging');
    node.removeAttribute('style');
    document.documentElement.classList.remove('hd-dragging');
    if (!reduced()) node.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: 'none' }], { duration: 160, easing: 'ease-out' });
    this._haptic('snap');
    this._changed();
  }
}
