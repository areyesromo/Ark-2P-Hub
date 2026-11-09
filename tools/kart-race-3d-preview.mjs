// A local UI review surface. No WebGL, ComfyUI, game loop or connection to a real room.
// Run: node tools/kart-race-3d-preview.mjs. Open http://127.0.0.1:4317.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kartViews } from '../test/fixtures/kart-race-3d-views.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const views = JSON.stringify(kartViews()).replaceAll('<', '\\u003c');
const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kart Race 3D · UI review</title><link rel="stylesheet" href="/shared/common.css"><link rel="stylesheet" href="/play/play.css"><style>
body{display:flex;flex-direction:column;height:100vh;overflow:hidden}nav{display:flex;gap:8px;align-items:center;padding:10px 16px;background:var(--bg);font-size:13px;flex-wrap:wrap}nav b{margin-right:auto}select{font:inherit;padding:5px;background:var(--panel);color:var(--text)}#screen{display:flex;flex:1;min-height:0;padding:12px}#screen.phone{max-width:480px;width:100%;margin:auto;--me:var(--p1);overflow:auto}#screen.wide-phone{max-width:850px}.static-stage{position:absolute;inset:0;background:linear-gradient(135deg,var(--bg-2),var(--btn));display:grid;grid-template-columns:1fr 1fr}.static-stage div{display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;border-right:1px solid var(--line)}#errors{color:var(--bad);font-size:12px}#input{color:var(--muted);font-size:12px}
</style></head><body><nav><b>UI REVIEW · STATIC STAGE · NO 3D RENDERER</b><label>Screen <select id="kind"><option value="tv">TV</option><option value="phone">Phone</option><option value="wide-phone">Wide phone</option></select></label><label>State <select id="state">${Object.keys(JSON.parse(views)).map(k => `<option>${k}</option>`).join('')}</select></label><button id="pad">Controller ↓</button><button id="warn">Toggle warning</button><span id="input"></span><span id="errors"></span></nav><main id="screen"></main><script src="/shared/common.js"></script><script>
window.addEventListener('error',e=>document.querySelector('#errors').textContent=e.message);
window.addEventListener('unhandledrejection',e=>document.querySelector('#errors').textContent=String(e.reason));
const originalLoad=Ark.loadScript;
const allowed=['/games/kart-race/host.js','/games/kart-race/player.js','/games/kart-race/track.js','/games/kart-race/racers.js','/games/kart-race/items.js','/shared/tilt.js','/games/kart-race-3d/ui.js'];
Ark.loadScript=function(src){if(!allowed.includes(src))throw Error('Preview blocks graphics scripts: '+src);return originalLoad(src)};
const views=${views};let renderer;let current;let shown=0;const screen=document.querySelector('#screen');
const stage={mount(el){const s=document.createElement('div');s.className='static-stage';s.innerHTML='<div>Player 1 · static stage</div><div>Player 2 · static stage</div>';el.prepend(s)},update(){},unmount(){}};
const api={send(input){document.querySelector('#input').textContent=JSON.stringify(input)},vibrate(){}};
async function show(){
  const mine=++shown;
  if(renderer)renderer.unmount();
  renderer=null;screen.innerHTML='';
  const kind=document.querySelector('#kind').value;
  screen.className=kind==='tv'?'':kind;
  current=structuredClone(views[document.querySelector('#state').value]);
  if(kind==='tv'){
    await Ark.loadScript('/games/kart-race/host.js');
    await Ark.loadScript('/games/kart-race-3d/ui.js');
    if(mine!==shown)return;
    renderer=ArkKartTV.make({stage,presentation:ArkKart3DUI.create()});
  }else{
    await Ark.loadScript('/games/kart-race/player.js');
    if(mine!==shown)return;
    current.you=0;renderer=ArkKartPhone.make({threeD:true});
  }
  Ark.loadCss('/games/kart-race-3d/style.css');
  renderer.mount(screen,api);renderer.update(current);
}
document.querySelector('#kind').onchange=show;document.querySelector('#state').onchange=show;document.querySelector('#pad').onclick=()=>{if(renderer && renderer.pad)renderer.pad('DOWN',current,0)};document.querySelector('#warn').onclick=()=>{if(renderer && current.karts){current.karts[0].jumped=!current.karts[0].jumped;renderer.update(current)}};show();
</script></body></html>`;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html'); return res.end(page); }
  const name = decodeURIComponent(url.pathname);
  const file = path.resolve(root, '.' + name);
  const safe = file.startsWith(root + path.sep) && /^(\/shared\/|\/play\/play.css$|\/assets\/|\/art\/|\/games\/kart-race\/|\/games\/kart-race-3d\/(ui.js|style.css)$)/.test(name);
  if (!safe) { res.writeHead(403); return res.end('Not part of the UI preview'); }
  try { const data = await fs.readFile(file); res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(4317, '127.0.0.1', () => console.log('Static kart UI preview: http://127.0.0.1:4317 (no WebGL)'));
