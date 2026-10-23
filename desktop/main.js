// The desktop app (AppImage on Linux / the Steam Deck, installer on Windows): starts the hub
// server inside the app and shows the TV screen full screen in its own window.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell, dialog, ipcMain } from 'electron';
import { startHub, isOwnUrl } from './hub.js';
import { createUpdates } from './updates.js';

const RELEASES = 'https://github.com/areyesromo/Ark-2P-Hub/releases/latest';

let hub = null;
let win = null;
let updates = null;

// One hub per machine: a second launch brings the open window to the front. A version started
// by an update waits for the old one to finish closing instead.
if (app.requestSingleInstanceLock()) {
  boot();
} else if (process.env.ARK_AFTER_UPDATE === '1') {
  let tries = 0;
  const wait = setInterval(() => {
    if (app.requestSingleInstanceLock()) {
      clearInterval(wait);
      boot();
    } else if (++tries >= 60) {
      app.quit();
    }
  }, 250);
} else {
  app.quit();
}

function boot() {
  delete process.env.ARK_AFTER_UPDATE;
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

// Self-update from GitHub Releases (see updates.js): only the packaged app, and on Linux only the
// AppImage (it replaces that file). ARK_NO_UPDATE=1 turns it off; ARK_UPDATE_URL points it at
// another feed (for testing).
async function startUpdates() {
  if (!app.isPackaged || process.env.ARK_NO_UPDATE === '1') return;
  if (process.platform === 'linux' && !process.env.APPIMAGE) return;
  let autoUpdater;
  try {
    ({ autoUpdater } = (await import('electron-updater')).default);
  } catch (err) {
    console.error('Self-update is off:', err.message); // built without it
    return;
  }
  if (process.env.ARK_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.ARK_UPDATE_URL });
  updates = createUpdates({
    updater: autoUpdater,
    page: RELEASES,
    send: (state) => {
      if (win) win.webContents.send('ark:update-state', state);
    },
    openPage: (url) => shell.openExternal(url),
    // Started from Steam (Game Mode on the Deck), a relaunched app would run outside Steam, without
    // its controller layout or focus: install and close, and it's started again from Steam.
    relaunch: !process.env.SteamGameId,
    install: () => {
      // The new version starts with this one's environment: tell it to wait for this one to close,
      // and don't hand it this version's stamp for /version.
      process.env.ARK_AFTER_UPDATE = '1';
      delete process.env.ARK_COMMIT;
      delete process.env.ARK_BUILT;
      // Silent: no installer wizard on Windows (a TV may have only a controller).
      autoUpdater.quitAndInstall(true, !process.env.SteamGameId);
    },
  });
  updates.start();
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
    icon: path.join(path.dirname(fileURLToPath(import.meta.url)), 'icons', 'icon.png'),
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
  startUpdates().catch((err) => console.error('Self-update failed to start:', err));
}

// The TV page's ⛶ and Quit buttons (only from the hub's own page in our window).
const fromHub = (event) => win && hub && event.sender === win.webContents && isOwnUrl(event.senderFrame?.url, hub.url);
ipcMain.handle('ark:fullscreen', (event) => {
  if (fromHub(event)) win.setFullScreen(!win.isFullScreen());
});
ipcMain.on('ark:quit', (event) => {
  if (fromHub(event)) app.quit();
});
ipcMain.handle('ark:update-state', (event) => (fromHub(event) && updates ? updates.state() : { state: 'idle' }));
ipcMain.on('ark:update', (event) => {
  if (fromHub(event) && updates) updates.act();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', (event) => {
  if (!hub) return;
  event.preventDefault();
  const closing = hub;
  hub = null;
  // Quit again (hub is null now, so this time it goes through): a downloaded update installs on
  // quit. After 2 s quit anyway, in case closing ever stalls, and exit as a last resort.
  setTimeout(() => app.quit(), 2000).unref();
  setTimeout(() => app.exit(0), 6000).unref();
  closing.close().finally(() => app.quit());
});
