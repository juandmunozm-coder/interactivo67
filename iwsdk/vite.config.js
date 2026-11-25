/* Free Frequency · versión IWSDK (Immersive Web SDK de Meta) para Meta Quest: VR y realidad aumentada (passthrough).
   Igual que la plantilla oficial de IWSDK (npm create @iwsdk), con dos cosas propias:
   · los archivos de la página original (../js y ../assets) se sirven tal cual en /js y /assets, sin copiarlos;
   · al compilar (npm run build) se copian a dist/ los que usa esta versión. */
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');   // carpeta del proyecto Free Frequency
const SHARED = ['js', 'assets'];
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.glb': 'model/gltf-binary', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg' };

/* archivos que usa la versión IWSDK (los mismos de la versión A-Frame en ../vr) */
const BUILD_FILES = [
  'js/data.js', 'js/toon-shader.js', 'js/characters-3d.js', 'js/scenery.js', 'js/audio.js', 'js/tuner.js',
  'assets/favicon.svg',
  'assets/models/objetos/Radio.glb', 'assets/models/objetos/Linterna.glb',
  'assets/models/rural/chicorural/chico_rural.glb', 'assets/models/rural/escenario rural/cauca_montanas1.glb',
  'assets/models/urbano/chicacaleña/chica_calena.glb',   // solo para la portada (personaje de la derecha)
  'assets/scenes/cauca-tarjeta.webp', 'assets/scenes/cauca-paisaje.webp',
  'assets/audio/radio-cancion.mp3'
];

function sharedFiles() {
  return {
    name: 'free-frequency-shared-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = decodeURIComponent((req.url || '').split('?')[0]);
        const top = url.split('/')[1];
        if (!SHARED.includes(top)) return next();
        const file = path.join(ROOT, path.normalize(url));
        if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        const size = fs.statSync(file).size, type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
        if (m) {   // pedidos por partes: el audio de la radio
          const a = m[1] === '' ? size - +m[2] : +m[1], b = m[1] === '' || m[2] === '' ? size - 1 : Math.min(+m[2], size - 1);
          res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${a}-${b}/${size}`, 'Content-Length': b - a + 1, 'Accept-Ranges': 'bytes' });
          return fs.createReadStream(file, { start: a, end: b }).pipe(res);
        }
        res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store' });
        fs.createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      const out = path.resolve(__dirname, 'dist');
      if (!fs.existsSync(out)) return;
      BUILD_FILES.forEach((f) => { const to = path.join(out, f); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), to); });
    },
  };
}

export default defineConfig({
  /* emulador de Meta Quest 3 en el computador (solo en localhost), con un cuarto de ejemplo para probar el passthrough de AR.
     HTTPS con certificado propio (el Quest muestra un aviso la primera vez). Con «--mode http» se sirve sin HTTPS, solo para pruebas locales. */
  plugins: [iwsdkDev({ emulator: { device: 'metaQuest3', environment: 'sunlit_living_room' }, https: !process.argv.includes('http') }), sharedFiles()],
  /* host 0.0.0.0: el Quest puede abrirlo desde la misma red wifi (el plugin de IWSDK sirve con HTTPS, que WebXR necesita) */
  server: { host: '0.0.0.0', port: 8081, open: false },
  build: { outDir: 'dist', target: 'esnext', rollupOptions: { input: './index.html' } },
  esbuild: { target: 'esnext' },
  resolve: { dedupe: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon', '@pmndrs/uikit-lucide'] },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: ['three', '@pmndrs/uikit', '@pmndrs/uikit-horizon', '@pmndrs/uikit-lucide', '@drawcall/uikitml'],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
