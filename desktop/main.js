// The desktop app (AppImage on Linux / the Steam Deck, installer on Windows): starts the hub
// server inside the app and shows the TV screen full screen in its own window.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell, dialog, ipcMain } from 'electron';
import { startHub, isOwnUrl } from './hub.js';

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
  // Packaged, three.js's add-ons sit beside the app (see electron-builder.yml).
  if (app.isPackaged) process.env.ARK_THREE_ADDONS = path.join(process.resourcesPath, 'three-addons');
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
      // window.arkDesktop for the TV page: the ⛶ and Quit buttons (see preload.cjs).
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.cjs'),
    },
  });
  win.setMenuBarVisibility(false);
  // F11 toggles full screen; Esc leaves it.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.key === 'Escape' && win.isFullScreen())) {
      win.setFullScreen(input.key === 'F11' ? !win.isFullScreen() : false);
      event.preventDefault();
    }
  });
  // Links to other sites open in the system browser (web links only); the hub's own pages stay
  // in the app.
  const own = (url) => isOwnUrl(url, hub.url);
  const outside = (url) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!own(url)) outside(url);
    return { action: own(url) ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!own(url)) {
      event.preventDefault();
      outside(url);
    }
  });
  win.on('closed', () => {
    win = null;
  });
  await win.loadURL(hub.url + '/host/');
}

// The TV page's ⛶ and Quit buttons (only from the hub's own page in our window).
const fromHub = (event) => win && hub && event.sender === win.webContents && isOwnUrl(event.senderFrame?.url, hub.url);
ipcMain.handle('ark:fullscreen', (event) => {
  if (fromHub(event)) win.setFullScreen(!win.isFullScreen());
});
ipcMain.on('ark:quit', (event) => {
  if (fromHub(event)) app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', (event) => {
  if (!hub) return;
  event.preventDefault();
  const closing = hub;
  hub = null;
  setTimeout(() => app.exit(0), 2000).unref(); // in case closing ever stalls
  closing.close().finally(() => app.exit(0));
});
