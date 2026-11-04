// hamui-dashboard — public API.
import { Dashboard } from './dashboard.js';
import { defineWidget, widgets, SIZES } from './registry.js';
import { createStore } from './store.js';
import { resolveOptions } from './options.js';
import { builtins, registerBuiltins } from './widgets/index.js';

export const version = '0.1.0';

export { Dashboard, defineWidget, widgets, SIZES, createStore, resolveOptions, builtins, registerBuiltins };

export default { version, Dashboard, defineWidget, widgets, SIZES, createStore, resolveOptions, builtins, registerBuiltins };
