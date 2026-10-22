// The hub server for the desktop app (see main.js): plain Node, no Electron, so it can be tested.
import net from 'node:net';

/** The first port from `from` (trying `tries` of them) that can be listened on. */
export async function findPort(from = 3000, tries = 20) {
  for (let port = from; port < from + tries; port++) {
    const free = await new Promise((resolve) => {
      const s = net.createServer();
      s.once('error', () => resolve(false));
      s.listen(port, () => s.close(() => resolve(true)));
    });
    if (free) return port;
  }
  throw new Error(`No free port between ${from} and ${from + tries - 1}.`);
}

/**
 * Start the hub on the first free port from `port`, keeping its data (settings, stats, the https
 * certificate) in `dataDir`. Gives { port, url, close }.
 */
export async function startHub({ dataDir, port = 3000, commit = 'app', built = new Date().toISOString(), onPortFound } = {}) {
  // The server reads its version when it is first loaded: set it before.
  process.env.ARK_COMMIT = process.env.ARK_COMMIT || commit;
  process.env.ARK_BUILT = process.env.ARK_BUILT || built;
  const { createApp } = await import('../server/app.js');
  let from = port;
  for (let attempt = 0; attempt < 5; attempt++) {
    const free = await findPort(from);
    if (onPortFound) await onPortFound(free); // (tests: another program grabs it now)
    const server = createApp({ port: free, dataDir });
    try {
      await server.listen();
      return { port: free, url: `http://localhost:${free}`, close: () => server.close() };
    } catch (err) {
      // Taken between finding it free and listening on it: try the next one.
      await server.close();
      if (err.code !== 'EADDRINUSE') throw err;
      from = free + 1;
    }
  }
  throw new Error(`Could not start the hub on a port from ${port}.`);
}

/** Is `url` one of the hub's own pages (same origin as `base`), to keep in the app window? */
export function isOwnUrl(url, base) {
  try {
    return new URL(url).origin === new URL(base).origin;
  } catch {
    return false;
  }
}
