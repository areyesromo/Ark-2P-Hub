// Draws the desktop app's icon and Steam library artwork, and writes the browser tab icon.
//   node tools/desktop-art.mjs          (needs Playwright: `npx playwright` or PW=/path/to/playwright)
// Writes:
//   public/shared/icon.svg              the tab icon for the hub's pages (no Playwright needed)
//   desktop/icons/icon.png              1024 px; electron-builder makes the .ico and AppImage icon
//   desktop/steam/*.png                 Steam's custom artwork for a non-Steam game
// The PNGs are committed; run this again after changing the drawing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// The hub's palette (public/shared/common.css).
const C = { bg: '#0b0d17', bg2: '#141829', panel: '#1b2036', line: '#2c3354', text: '#eef0ff', muted: '#9aa3c7', p1: '#22d3ee', p2: '#f472b6' };

// The "2P" monogram as strokes (no font), in a 1024 box: a cyan 2 and a pink P.
const GLYPHS = `
  <g fill="none" stroke-width="128" stroke-linecap="round" stroke-linejoin="round" transform="translate(512 512) scale(0.9) translate(-512 -512)">
    <path stroke="${C.p1}" transform="translate(-40 0)" d="M196 410 A134 134 0 0 1 464 410 C464 488 418 530 200 724 L476 724"/>
    <path stroke="${C.p2}" transform="translate(40 0)" d="M590 724 L590 300 L702 300 A125 125 0 0 1 702 550 L590 550"/>
  </g>`;

/** The app icon: the monogram on a rounded navy tile. */
function iconSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs><linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.panel}"/><stop offset="1" stop-color="${C.bg}"/></linearGradient></defs>
  <rect x="32" y="32" width="960" height="960" rx="224" fill="url(#tile)" stroke="${C.line}" stroke-width="12"/>${GLYPHS}
</svg>`;
}

/** Soft cyan and pink glows on navy: the backdrop of the bigger pieces. */
function backdrop(w, h) {
  return `<defs>
    <radialGradient id="g1" cx="0.18" cy="0.3" r="0.6"><stop offset="0" stop-color="${C.p1}" stop-opacity="0.32"/><stop offset="1" stop-color="${C.p1}" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="0.85" cy="0.8" r="0.6"><stop offset="0" stop-color="${C.p2}" stop-opacity="0.30"/><stop offset="1" stop-color="${C.p2}" stop-opacity="0"/></radialGradient>
    <pattern id="dots" width="48" height="48" patternUnits="userSpaceOnUse"><circle cx="24" cy="24" r="2.5" fill="${C.line}"/></pattern>
  </defs>
  <rect width="${w}" height="${h}" fill="${C.bg}"/>
  <rect width="${w}" height="${h}" fill="url(#dots)" opacity="0.6"/>
  <rect width="${w}" height="${h}" fill="url(#g1)"/>
  <rect width="${w}" height="${h}" fill="url(#g2)"/>`;
}

/** "ARK 2P HUB" as on the TV's top bar, centred on (x, y). */
function wordmark(x, y, size, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="Inter Display, Inter, sans-serif" font-weight="900" font-size="${size}" letter-spacing="${size * 0.02}">` +
    `<tspan fill="${C.p1}">ARK</tspan> <tspan fill="${C.p2}">2P</tspan> <tspan fill="${C.text}">HUB</tspan></text>`;
}
function tagline(x, y, size, anchor = 'middle') {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="Inter, sans-serif" font-weight="600" font-size="${size}" fill="${C.muted}">1v1 party games · phones are the controllers</text>`;
}
/** The icon tile placed at (x, y) with the given size. */
function tile(x, y, size) {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 1024 1024">${iconSvg(1024).replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>`;
}
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

const PIECES = [
  { file: 'desktop/icons/icon.png', w: 1024, h: 1024, svg: iconSvg(1024), transparent: true },
  { file: 'desktop/steam/icon-256.png', w: 256, h: 256, svg: iconSvg(256), transparent: true },
  // Library tile (portrait capsule).
  { file: 'desktop/steam/library-600x900.png', w: 600, h: 900,
    svg: svg(600, 900, backdrop(600, 900) + tile(130, 170, 340) + wordmark(300, 640, 66) + tagline(300, 712, 20)) },
  // Wide tile (the "recent games" shelf).
  { file: 'desktop/steam/wide-920x430.png', w: 920, h: 430,
    svg: svg(920, 430, backdrop(920, 430) + tile(70, 75, 280) + wordmark(400, 190, 76, 'start') + tagline(402, 262, 22, 'start')) },
  // Header behind the game's page; Steam puts the logo over it, so no text here.
  { file: 'desktop/steam/hero-3840x1240.png', w: 3840, h: 1240, svg: svg(3840, 1240, backdrop(3840, 1240)) },
  // Logo (transparent), shown over the header.
  { file: 'desktop/steam/logo-1280x720.png', w: 1280, h: 720, transparent: true,
    svg: svg(1280, 720, tile(40, 210, 300) + wordmark(380, 360, 132, 'start')) },
];

fs.writeFileSync(path.join(root, 'public/shared/icon.svg'), iconSvg(64).replace('width="64" height="64" ', '') + '\n');

const pw = await import(process.env.PW || 'playwright').then((m) => m.default || m);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const p of PIECES) {
  await page.setViewportSize({ width: p.w, height: p.h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${p.svg}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(path.join(root, p.file)), { recursive: true });
  await page.screenshot({ path: path.join(root, p.file), omitBackground: Boolean(p.transparent), clip: { x: 0, y: 0, width: p.w, height: p.h } });
  console.log('wrote', p.file);
}
await browser.close();
