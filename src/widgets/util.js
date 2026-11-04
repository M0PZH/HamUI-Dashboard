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
