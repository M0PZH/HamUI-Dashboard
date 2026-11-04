import { defineConfig } from 'vite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// HamUI is a peer dependency. The demo and dev server use its ES-module
// source (from node_modules, or a checkout named by HAMUI_DIR); the library
// build leaves `hamui` external (window.HamUI for the UMD build).
const hamuiDir = process.env.HAMUI_DIR ? resolve(process.env.HAMUI_DIR) : resolve(__dirname, 'node_modules/hamui');
if (!existsSync(resolve(hamuiDir, 'src/js/index.js'))) {
  console.warn(`hamui source not found in ${hamuiDir}; run npm install or set HAMUI_DIR`);
}
const hamuiAlias = [
  { find: /^hamui$/, replacement: resolve(hamuiDir, 'src/js/index.js') },
  { find: /^hamui\/css$/, replacement: resolve(hamuiDir, 'src/css/hamui.css') },
];

export default defineConfig(({ mode, command }) => {
  if (mode === 'site') {
    return {
      base: './',
      resolve: { alias: hamuiAlias },
      build: { outDir: 'site-dist', emptyOutDir: true, rollupOptions: { input: { index: resolve(__dirname, 'index.html') } } },
    };
  }
  if (command === 'serve') return { resolve: { alias: hamuiAlias } };
  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/build-entry.js'),
        name: 'HamUIDashboard',
        fileName: 'hamui-dashboard',
        cssFileName: 'hamui-dashboard',
        formats: ['es', 'umd'],
      },
      sourcemap: true,
      rollupOptions: {
        external: ['hamui'],
        output: { exports: 'named', globals: { hamui: 'HamUI' } },
      },
    },
  };
});
