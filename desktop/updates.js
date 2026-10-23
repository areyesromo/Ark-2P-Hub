// The desktop app's self-update, as a small state machine around electron-updater's autoUpdater
// (passed in, so it's tested without Electron). The TV shows the state as a banner in the lobby:
//   idle → available {version} → downloading {version, percent} → ready {version, relaunch}
//   or error {version, url} if the download fails (the button then opens the releases page).
// A failed check (offline, GitHub down) stays quiet: nobody asked for it.

const CHECK_DELAY_MS = 5000; // let the hub and the TV page start first
const RECHECK_MS = 6 * 60 * 60 * 1000; // a hub left running looks again every 6 hours

/**
 * @param {{ updater, page: string, send: (state) => void, openPage: (url: string) => void,
 *   install?: () => void, relaunch?: boolean, setTimeout?: (fn: () => void, ms: number) => unknown }} opts
 *   relaunch: whether installing brings the app back by itself (the TV says "Restart now"), or
 *   just closes it (under Steam: "Install and close", then start it from Steam).
 */
export function createUpdates({ updater, page, send, openPage, install = () => updater.quitAndInstall(), relaunch = true, setTimeout: later = setTimeout }) {
  let current = { state: 'idle' };
  const set = (next) => {
    current = next;
    send(current);
  };
  const failed = () => {
    // Only a download someone asked for shows an error.
    if (current.state === 'downloading') set({ state: 'error', version: current.version, url: page });
  };

  updater.on('update-available', (info) => {
    if (current.state === 'idle') set({ state: 'available', version: info.version });
  });
  updater.on('download-progress', (p) => {
    if (current.state === 'downloading') set({ state: 'downloading', version: current.version, percent: Math.floor(p.percent) });
  });
  updater.on('update-downloaded', (info) => set({ state: 'ready', version: info.version, relaunch }));
  updater.on('error', failed);

  return {
    state: () => current,
    start() {
      updater.autoDownload = false; // only when someone presses Update
      const check = () => {
        if (current.state !== 'idle') return; // found one: no need to look again
        updater.checkForUpdates().catch(() => {});
        later(check, RECHECK_MS);
      };
      later(check, CHECK_DELAY_MS);
    },
    /** The banner's button: download, restart and install, or open the releases page. */
    act() {
      if (current.state === 'available') {
        set({ state: 'downloading', version: current.version, percent: 0 });
        updater.downloadUpdate().catch(failed);
      } else if (current.state === 'ready') {
        install();
      } else if (current.state === 'error') {
        openPage(current.url);
      }
    },
  };
}
