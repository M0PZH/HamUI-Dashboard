// Widget types. A definition:
//   {
//     type: 'clock',                 // unique id
//     title: 'UTC',
//     description: 'UTC time and date',
//     sizes: ['XS', 'S', 'M'],       // any of XS S M L XL
//     size: 'S',                     // default size (first of sizes otherwise)
//     multiple: false,               // may be added more than once
//     flush: false,                  // body without padding (e.g. canvases)
//     options: [ …fields ],          // settings shown behind the card's options button
//     mount(ctx) { … return cleanup | { update(options, prev), destroy() } },
//   }
// See options.js for the field format and dashboard.js for ctx.

export const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const registry = new Map();

export function defineWidget(def) {
  if (!def || typeof def.type !== 'string') throw new TypeError('defineWidget: `type` is required');
  if (typeof def.mount !== 'function') throw new TypeError(`defineWidget(${def.type}): \`mount\` is required`);
  const sizes = (def.sizes?.length ? def.sizes : ['M']).filter((s) => SIZES.includes(s));
  if (!sizes.length) throw new TypeError(`defineWidget(${def.type}): no valid sizes`);
  const out = Object.freeze({
    title: def.type,
    description: '',
    multiple: false,
    flush: false,
    ...def,
    sizes: SIZES.filter((s) => sizes.includes(s)),
    size: sizes.includes(def.size) ? def.size : sizes[0],
    options: Object.freeze([...(def.options || [])]),
  });
  registry.set(out.type, out);
  return out;
}

export const widgets = {
  get: (type) => registry.get(type),
  has: (type) => registry.has(type),
  list: () => [...registry.values()],
  remove: (type) => registry.delete(type),
};
