// The desktop app (AppImage on Linux / the Steam Deck, installer on Windows): starts the hub
// server inside the app and shows the TV screen full screen in its own window.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, shell, dialog, ipcMain, screen, crashReporter } from 'electron';
import { startHub, isOwnUrl } from './hub.js';
import { createUpdates } from './updates.js';
import { createLog } from './applog.js';

const RELEASES = 'https://github.com/areyesromo/Ark-2P-Hub/releases/latest';

// How each run went, in ~/.config/Ark 2P Hub/logs/main.log (Windows: %APPDATA%\Ark 2P Hub\logs):
// the place to look when the window shows nothing. It's opened once this copy has the
// one-copy lock (see applog.js). A crash in Electron itself leaves a dump in Crashpad/ beside it.
const log = createLog(path.join(app.getPath('userData'), 'logs'));
crashReporter.start({ uploadToServer: false });
log('Ark 2P Hub ' + app.getVersion() + ' starting', {
  platform: process.platform,
  electron: process.versions.electron,
  args: process.argv.slice(1),
  // What Game Mode on the Deck sets, and how it runs the app.
  env: Object.fromEntries(
    // LD_PRELOAD: Steam's overlay hooks into games through it, a known cause of blank windows.
    ['DISPLAY', 'WAYLAND_DISPLAY', 'XDG_SESSION_TYPE', 'XDG_CURRENT_DESKTOP', 'XDG_RUNTIME_DIR', 'SteamGameId',
      'SteamAppId', 'SteamOverlayGameId', 'SteamDeck', 'GAMESCOPE_WAYLAND_DISPLAY', 'STEAM_COMPAT_DATA_PATH',
      'LD_PRELOAD', 'ELECTRON_OZONE_PLATFORM_HINT', 'LIBVA_DRIVER_NAME', 'APPIMAGE', 'PORT']
      .filter((k) => process.env[k] !== undefined)
      .map((k) => [k, process.env[k]]),
  ),
});
// Logged, and still shown: a listener here replaces Electron's own error box.
process.on('uncaughtException', (err) => {
  const text = String((err && err.stack) || err);
  log('uncaught error', text);
  dialog.showErrorBox('Ark 2P Hub hit an error', text);
});
process.on('unhandledRejection', (err) => log('unhandled error', String((err && err.stack) || err)));
// A helper process (the graphics one, say) stopping at launch is a likely cause of a black window.
app.on('child-process-gone', (_e, details) => log('a helper process stopped', details));

let hub = null;
let win = null;
let updates = null;

// One hub per machine: a second launch brings the open window to the front. A version started
// by an update waits for the old one to finish closing instead.
if (app.requestSingleInstanceLock()) {
  log.open();
  boot();
} else if (process.env.ARK_AFTER_UPDATE === '1') {
  let tries = 0;
  const wait = setInterval(() => {
    if (app.requestSingleInstanceLock()) {
      clearInterval(wait);
      log.open();
      boot();
    } else if (++tries >= 60) {
      app.quit();
    }
  }, 250);
} else {
  log.open({ rotate: false }); // add a line to the running copy's log, don't replace it
  log('another copy is already running: closing this one');
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
    log('could not start', String(err && err.stack || err));
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
    log('self-update is off', err.message); // built without it
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
  log('graphics', {
    features: app.getGPUFeatureStatus(),
    ozonePlatform: app.commandLine.getSwitchValue('ozone-platform') || '(default)',
    gpuOff: app.commandLine.hasSwitch('disable-gpu'),
  });
  app.getGPUInfo('basic').then((info) => log('graphics card', info.gpuDevice), (err) => log('no graphics card info', String(err)));
  log('displays', screen.getAllDisplays().map((d) => ({ bounds: d.bounds, scaleFactor: d.scaleFactor })));
  hub = await startHub({ dataDir, port: Number(process.env.PORT) || 3000, commit: 'app-' + app.getVersion() });
  console.log(`Ark 2P Hub running: ${hub.url}/host/`);
  log('hub running', { url: hub.url });
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
  win.once('ready-to-show', () => log('window ready', { visible: win.isVisible(), fullScreen: win.isFullScreen(), bounds: win.getBounds() }));
  win.once('show', () => log('window shown'));
  win.on('enter-full-screen', () => log('full screen on'));
  win.on('leave-full-screen', () => log('full screen off'));
  // The page's own warnings and errors (a 3D game failing to get WebGL, say), the first 50.
  let pageLines = 0;
  win.webContents.on('console-message', (event) => {
    if ((event.level === 'warning' || event.level === 'error') && pageLines++ < 50) log('page ' + event.level, event.message);
  });
  win.on('unresponsive', () => log('the window stopped responding'));
  win.webContents.on('render-process-gone', (_e, details) => log('the page stopped', details));
  win.webContents.on('did-fail-load', (_e, code, desc, url) => log('the page failed to load', { code, desc, url }));
  win.webContents.on('did-finish-load', () => log('page loaded'));
  await win.loadURL(hub.url + '/host/');
  startUpdates().catch((err) => log('self-update failed to start', String(err)));
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
