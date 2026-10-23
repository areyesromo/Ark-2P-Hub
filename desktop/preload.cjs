// The desktop app's bridge to the TV page: only these calls, nothing else from Node.
// (CommonJS: a sandboxed preload can't be an ES module.)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkDesktop', {
  /** Full screen on / off. */
  toggleFullScreen: () => ipcRenderer.invoke('ark:fullscreen'),
  /** Close the app (and the hub with it). */
  quit: () => ipcRenderer.send('ark:quit'),
  /** Self-update: cb gets the state now and on every change (see desktop/updates.js). */
  onUpdate: (cb) => {
    ipcRenderer.on('ark:update-state', (_event, state) => cb(state));
    ipcRenderer.invoke('ark:update-state').then(cb);
  },
  /** The update banner's button: download, restart, or open the releases page. */
  update: () => ipcRenderer.send('ark:update'),
});
