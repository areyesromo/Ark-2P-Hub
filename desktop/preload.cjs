// The desktop app's bridge to the TV page: only these two calls, nothing else from Node.
// (CommonJS: a sandboxed preload can't be an ES module.)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkDesktop', {
  /** Full screen on / off; gives the new state. */
  toggleFullScreen: () => ipcRenderer.invoke('ark:fullscreen'),
  /** Close the app (and the hub with it). */
  quit: () => ipcRenderer.send('ark:quit'),
});
