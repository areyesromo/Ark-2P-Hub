// The desktop app (AppImage on Linux / the Steam Deck, installer on Windows): starts the hub
// server inside the app and shows the TV screen full screen in its own window.
import path from 'node:path';
import { app, BrowserWindow, shell, dialog } from 'electron';
import { startHub } from './hub.js';

let hub = null;
let win = null;

// One hub per machine: a second launch brings the open window to the front.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(start).catch((err) => {
    dialog.showErrorBox('Ark 2P Hub could not start', String((err && err.message) || err));
    app.quit();
  });
}

async function start() {
  // Settings, stats and the https certificate live here, so they survive updates.
  const dataDir = path.join(app.getPath('userData'), 'data');
  hub = await startHub({ dataDir, port: Number(process.env.PORT) || 3000, commit: 'app-' + app.getVersion() });
  console.log(`Ark 2P Hub running: ${hub.url}/host/`);
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: process.env.ARK_WINDOWED !== '1',
    autoHideMenuBar: true,
    backgroundColor: '#0b1020',
    title: 'Ark 2P Hub',
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required', // sound without "Tap for sound"
    },
  });
  win.setMenuBarVisibility(false);
  // F11 toggles full screen.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    }
  });
  // Links to other sites open in the system browser; the hub's own pages stay in the app.
  const own = (url) => url.startsWith(hub.url);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!own(url)) shell.openExternal(url);
    return { action: own(url) ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!own(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  win.on('closed', () => {
    win = null;
  });
  await win.loadURL(hub.url + '/host/');
}

app.on('window-all-closed', () => app.quit());
app.on('will-quit', (event) => {
  if (!hub) return;
  event.preventDefault();
  const closing = hub;
  hub = null;
  closing.close().finally(() => app.exit(0));
});
