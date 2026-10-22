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
export async function startHub({ dataDir, port = 3000, commit = 'app', built = new Date().toISOString() } = {}) {
  const free = await findPort(port);
  // The server reads its version when it is first loaded: set it before.
  process.env.ARK_COMMIT = process.env.ARK_COMMIT || commit;
  process.env.ARK_BUILT = process.env.ARK_BUILT || built;
  const { createApp } = await import('../server/app.js');
  const server = createApp({ port: free, dataDir });
  await server.listen();
  return { port: free, url: `http://localhost:${free}`, close: () => server.close() };
}
