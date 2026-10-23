// Checks a built app (dist/linux-unpacked/resources by default) has every file the hub serves at runtime:
// electron-builder leaves some out by default (e.g. node_modules/*/examples, where three.js keeps
// the add-ons the 3D party board loads). Run after `npm run dist:linux`.
import path from 'node:path';
import fs from 'node:fs';
import asarPkg from '@electron/asar'; // read the archive directly (spawning npx fails on Windows)

const resources = path.resolve(process.argv[2] || 'dist/linux-unpacked/resources');
const asar = path.join(resources, 'app.asar');
if (!fs.existsSync(asar)) {
  console.error(`No built app at ${asar}: run npm run dist:linux first.`);
  process.exit(2);
}
const list = new Set(asarPkg.listPackage(asar, { isPack: false }).map((l) => l.trim().replace(/\\/g, '/')));
const needed = [
  '/desktop/main.js',
  '/desktop/preload.cjs',
  '/desktop/updates.js',
  '/desktop/applog.js',
  '/desktop/steam.js',
  '/desktop/icons/icon.png',
  '/node_modules/electron-updater/package.json',
  '/server/app.js',
  '/public/host/index.html',
  '/node_modules/three/build/three.module.js',
  '/node_modules/word-list/package.json',
  '/node_modules/qrcode/package.json',
  '/node_modules/socket.io/package.json',
];
// Beside the app (extraResources, and where self-update looks for releases), not in it.
const beside = ['app-update.yml', 'three-addons/loaders/GLTFLoader.js', 'three-addons/modifiers/SimplifyModifier.js', 'three-addons/utils/BufferGeometryUtils.js'];
const missing = needed.filter((f) => !list.has(f)).concat(beside.filter((f) => !fs.existsSync(path.join(resources, f))));
if (missing.length) {
  console.error('Missing from the app:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log(`App package OK (${needed.length + beside.length} key files present).`);
