// The built-in widgets. They read and write a shared store (createStore);
// see the README for the keys each one uses.
import { defineWidget } from '../registry.js';
import panadapter from './panadapter.js';
import vfo from './vfo.js';
import meters from './meters.js';
import clock from './clock.js';
import solar from './solar.js';
import ft8 from './ft8.js';
import dx from './dx.js';
import ptt from './ptt.js';
import knobs from './knobs.js';
import mode from './mode.js';

export const builtins = [panadapter, vfo, meters, ft8, clock, solar, dx, ptt, knobs, mode];

/** Register the built-in widgets (all, or the named types). */
export function registerBuiltins(types) {
  return builtins.filter((d) => !types || types.includes(d.type)).map((d) => defineWidget(d));
}
