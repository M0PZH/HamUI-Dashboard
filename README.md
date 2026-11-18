# hamui-dashboard

A user-customisable, drag-and-drop widget dashboard for ham radio software, built on
[HamUI](https://github.com/M0PZH/HamUI). Users choose which widgets to show, resize them
(XS / S / M / L / XL), rearrange them by dragging (mouse, trackpad or touch) and change
each widget's settings from the options button on its card (shown in edit mode).

This is an extension: it uses HamUI (a peer dependency) but is not part of it.

Demo: **https://m0pzh.github.io/HamUI-Dashboard/** (simulated station data).

## Use

```html
<link rel="stylesheet" href="hamui/dist/hamui.css">
<link rel="stylesheet" href="hamui-dashboard/dist/hamui-dashboard.css">
<script src="hamui/dist/hamui.umd.cjs"></script>
<script src="hamui-dashboard/dist/hamui-dashboard.umd.cjs"></script>

<div id="dash"></div>
<script>
  const { Dashboard, createStore, registerBuiltins } = HamUIDashboard;
  registerBuiltins();
  const store = createStore({ dial: 14074000, mode: 'USB' });
  const dash = new Dashboard('#dash', {
    store,
    title: 'My station',
    defaultLayout: [['panadapter', 'XL'], ['vfo', 'M'], ['meters', 'M'], ['clock', 'XS']],
  });
</script>
```

With a bundler: `import { Dashboard, createStore, registerBuiltins } from 'hamui-dashboard'`
plus `import 'hamui/css'` and `import 'hamui-dashboard/css'`.

## Sizes

The grid has 4 columns (2 on narrow screens). XS is half a cell high.

| Size | Columns × cells |
| --- | --- |
| XS | 1 × ½ |
| S | 1 × 1 |
| M | 2 × 1 |
| L | 2 × 2 |
| XL | all × 2 |

A card can also be taller or shorter than its size: in edit mode drag its bottom-right corner (or
`Shift`+arrow keys). The height snaps to half cells; the width snaps to the widths of the widget's sizes,
switching the size when it changes (an M dragged down to two cells becomes an L). Double-click the corner,
or pick a size, to go back to the preset. Heights go up to 12 cells.

A widget defined with `freeSize: true` (video, say) takes any whole number of columns and half cells, with no
upper limit; it still snaps to the grid. On a narrower screen a wide card is clipped to the columns there.

## Dashboard

```js
const dash = new Dashboard(element, {
  store,                    // handed to every widget as ctx.store
  defaultLayout: [],        // [[type, size, options?] | {type, size, options}]
  layout: null,             // start from this instead of what is stored
  storage: 'hamui-dashboard', // localStorage key, { load(), save(layout) }, or null
  widgets: null,            // limit the gallery to these types
  title: 'Dashboard', subtitle: '',
  toolbar: true,            // title bar with Edit / Add widget / Reset layout
  editable: true,
  optionsButton: 'edit',    // options button in edit mode only; 'always' | 'never'
  holdToEdit: 500,          // touch: hold a card this long to enter edit mode
  holdToDrag: 280,          // touch: hold before dragging in edit mode
  haptics: true,            // HamUI.haptics on pick-up, reorder, drop, resize
});

dash.edit(true);            dash.openGallery();       dash.reset();
dash.add('clock', { size: 'XS', options: { zone: 'local' } });
dash.remove(id); dash.resize(id, 'M'); dash.move(id, 0);
dash.setOptions(id, { seconds: false }); dash.resetOptions(id); dash.openOptions(id);
dash.getLayout(); dash.setLayout(layout);
dash.on('change', (e) => save(e.detail.layout));
dash.on('editchange', (e) => console.log(e.detail.editing));
dash.toolbarExtra.append(myThemeSwitch);   // your own controls in the title bar
```

Layout JSON: `{ "version": 1, "items": [{ "id", "type", "size", "h", "w", "options" }] }`. `options` holds only the
values the user changed; the rest follow the widget's defaults. `h` (rows of half a cell) and `w` (columns,
`freeSize` widgets only) are present when the card differs from its size; `dash.setSpan(id, { rows, cols })`
sets them from code. Layouts saved with the older `options._height` are moved to `h` when loaded.

In edit mode: drag cards to reorder (or focus a card and use the arrow keys), pick a size with XS–XL
(or `+` / `−`), drag the bottom-right corner to resize (or `Shift`+arrows), remove with the − button (or Delete), and add widgets from the gallery.
`Esc` or Done leaves edit mode.

## Writing a widget

```js
import { defineWidget } from 'hamui-dashboard';

defineWidget({
  type: 'swr-alarm',
  title: 'SWR alarm',
  description: 'Warns when SWR goes over a limit.',
  sizes: ['XS', 'S'],
  size: 'XS',
  multiple: false,       // may be added more than once?
  flush: false,          // body without padding (canvases)
  freeSize: false,       // any width and height on the grid, without a maximum
  options: [
    { key: 'limit', type: 'number', label: 'Limit', min: 1.1, max: 5, step: 0.1, default: 2 },
    { key: 'sound', type: 'toggle', label: 'Beep', default: false },
  ],
  mount(ctx) {
    // ctx: el, size, options, store, id, dashboard, signal (aborted on unmount),
    //      setStatus(text), setTitle(text), haptic(kind)
    const off = ctx.store.watch(['swr'], ({ swr }) => {
      ctx.el.textContent = swr > ctx.options.limit ? 'High SWR' : 'OK';
    });
    return off;   // or { destroy(), update(options, prev), resize(size, options) }
  },
});
```

`mount` returns a cleanup function, or an object. When it has `update`, an options change calls it instead of
remounting (return `false` to remount anyway); `resize` does the same for size changes. Mounting is wrapped:
a widget that throws shows an error in its card and does not break the dashboard.

### Option fields

Every field has `key`, `type`, `label`, `default` (a value, or `(size) => value`), and optionally `help` and
`sizes` (only offered at those card sizes). Widgets without fields have no options button.

| `type` | Value | Extra |
| --- | --- | --- |
| `toggle` | boolean | |
| `select` | one of `choices` | `choices: [value \| {value, label}]` |
| `segmented` | one of `choices` | for a few short choices |
| `checks` | array of `choices` | |
| `number` | number | `min`, `max`, `step`, `unit` |
| `range` | number | slider with readout; `min`, `max`, `step`, `unit` |
| `text` | string | `placeholder`, `maxLength` |
| `levels` | two numbers | a two-handle `HamUI.RangeSlider`; `keys: [low, high]` instead of `key`, `default: [low, high]`, `min`, `max`, `step`, `minGap`, `unit`, `gradient` (a colormap, or `{ option: 'colormap' }` to follow another field), `auto: true` for an Auto button that calls the widget's `auto(keys)` → `[low, high]` |

## Store

`createStore(initial)` is a tiny shared state for widgets:
`get(key)`, `set(patch)`, `watch([keys], fn)` → unsubscribe, `on(event, fn)` / `emit(event, data)` for streams,
and `state` for direct reads. Connect it to your radio: watch the keys widgets write, and set the ones they read.

Keys used by the built-in widgets:

| Widget | Reads | Writes |
| --- | --- | --- |
| `panadapter` | `dial`, `mode`, `filter`; event `spectrum` `{bins, startHz, spanHz}`; `spectrumHistory` (optional, frames to pre-fill the waterfall) | `dial` |
| `vfo` | `dial`, `mode`, `tx` | `dial` |
| `meters` | `smeter` (dBm), `tx`, `fwd` (W), `swr`, `alc` (%), `maxPower` | |
| `clock` | | |
| `solar` | `solar` `{sfi, ssn, a, k, bands: [{band, day, night}], source}` | |
| `ft8` | `decodes` `[{utc, db, hz, msg}]`, newest first | |
| `dx` | `spots` `[{dx, hz, mode, spotter, utc}]`, newest first; `dial` | `dial`, `mode` |
| `ptt` | `tx` | `tx` |
| `knobs` | `af`, `rf`, `sql`, `power` | the same |
| `mode` | `dial`, `mode` | `dial`, `mode` |

## Develop

```sh
npm install
npm run dev          # demo at http://localhost:5173
npm run build        # dist/hamui-dashboard.{js,umd.cjs,css}
npm run build:site   # site-dist/, published by .github/workflows/pages.yml
```

HamUI comes from GitHub as a dev dependency; set `HAMUI_DIR=../HamUI` to develop against a local checkout.
`design/` holds the original design mockup.

`dashboard.refreshOptions(types?)` re-evaluates dynamic field defaults without
saving them as overrides; optional `types` limits refresh to widget types.
Widget `update(next, previous, {source})` receives `source: 'defaults'` for
refreshes and `'user'` for ordinary edits. `setOptions(id, patch, meta?)`
accepts an optional source and removes overrides whose patch value is
`undefined`, restoring their current default. Mounted widgets can use this
to normalise linked fields without treating a derived change as a user edit.

A widget that re-renders a scrolling list can wrap the render in
`keepScroll(scroller, render)`: rows carry `data-key`, and the row at the top of
the view stays put while rows are added above it. A remount (new options,
`refreshOptions`) keeps the scroll position of the card's scrolled elements, and
a scroller left at its end stays at the end when its content changes height
(a live reading that wraps onto a second line and back).
