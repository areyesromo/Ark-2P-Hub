import fs from 'node:fs';
import { createApp } from './app.js';
import { resolveJoinBase } from './network.js';

const port = Number(process.env.PORT) || 3000;
const server = createApp({ port });

await server.listen();
console.log(`Ark 2P Hub running on port ${port}`);
if (!process.env.PUBLIC_URL && fs.existsSync('/.dockerenv')) {
  // Inside a container we only see the container's own IP, which phones can't reach.
  console.log(`  TV screen: http://<this-machine's-LAN-IP>:${port}/host/`);
  console.log('  Phones join via the QR code on the TV. Set PUBLIC_URL if the TV uses localhost.');
} else {
  const base = resolveJoinBase({ publicUrl: process.env.PUBLIC_URL, port });
  console.log(`  TV screen: ${base}/host/`);
  console.log(`  Phones:    ${base}/play/`);
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await server.close();
    process.exit(0);
  });
}
