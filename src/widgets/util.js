// Helpers shared by the built-in widgets.
export function h(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Run every cleanup in `list` (functions or objects with destroy()). */
export function cleanup(list) {
  for (const c of list.splice(0)) {
    try { typeof c === 'function' ? c() : c?.destroy?.(); } catch (err) { console.error(err); }
  }
}

/** The built-in widgets need a store; show a note instead of throwing. */
export function needStore(ctx) {
  if (ctx.store && typeof ctx.store.watch === 'function') return false;
  ctx.el.append(h('div', 'hd-error', 'No data store: pass <code>store</code> to the Dashboard.'));
  return true;
}

/**
 * Re-render a scrolling list without moving what the user is reading.
 * At the top it stays at the top (lists here are newest first); elsewhere
 * the first visible row (an element with data-key) keeps its place, so rows
 * added above or dropped below do not shift the view. Returns render()'s value.
 */
export function keepScroll(scroller, render) {
  const top = scroller.scrollTop;
  const atEnd = top > 1 && top + scroller.clientHeight >= scroller.scrollHeight - 2;
  let key = null, offset = 0;
  if (top > 1) {
    const sr = scroller.getBoundingClientRect();
    const head = scroller.querySelector('thead')?.offsetHeight || 0;
    for (const row of scroller.querySelectorAll('[data-key]')) {
      const r = row.getBoundingClientRect();
      if (r.bottom > sr.top + head + 1) { key = row.dataset.key; offset = r.top - sr.top; break; }
    }
  }
  const out = render();
  if (top > 1) {
    const row = key != null && [...scroller.querySelectorAll('[data-key]')].find((n) => n.dataset.key === key);
    if (row) scroller.scrollTop += row.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
    else scroller.scrollTop = atEnd ? scroller.scrollHeight : top;
  }
  return out;
}
