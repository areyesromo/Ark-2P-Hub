// The Raspberry Pi scripts, run against stand-ins: the installer in dry-run
// mode with a throwaway home folder, and the updater with fake docker/curl/git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PI = path.resolve('deploy/pi');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ark-pi-'));

function install(home, env = {}) {
  return execFileSync('bash', [path.join(PI, 'install.sh')], {
    env: { PATH: process.env.PATH, HOME: home, ARK_DRY_RUN: '1', ARK_DIR: '/opt/ark', ...env },
    encoding: 'utf8',
  });
}

test('installer (dry run): installs, starts, auto-updates and sets up the kiosk once', () => {
  const home = tmp();
  const out = install(home);
  for (const expected of ['sudo mkdir -p /opt/ark', 'docker pull ghcr.io/areyesromo/ark-2p-hub:latest', 'compose up -d', 'enable --now ark-update.timer']) {
    assert.ok(out.includes(expected), `missing: ${expected}\n${out}`);
  }
  assert.ok(out.includes('cp ' + path.join(PI, 'kiosk.sh')), 'run from a clone, it copies its own files');
  install(home); // again: nothing doubles up
  const autostart = fs.readFileSync(path.join(home, '.config/labwc/autostart'), 'utf8');
  assert.equal(autostart, '/opt/ark/kiosk.sh &\n');
  fs.rmSync(home, { recursive: true, force: true });
});

test('installer: adds the kiosk to an existing wayfire.ini once, inside [autostart]', () => {
  const home = tmp();
  fs.mkdirSync(path.join(home, '.config'), { recursive: true });
  const ini = path.join(home, '.config/wayfire.ini');
  fs.writeFileSync(ini, '[core]\nplugins = autostart\n\n[autostart]\npanel = wf-panel-pi\n');
  install(home);
  install(home);
  const text = fs.readFileSync(ini, 'utf8');
  assert.equal(text.match(/^ark = /gm).length, 1);
  assert.match(text, /\[autostart\]\nark = \/opt\/ark\/kiosk\.sh\npanel = wf-panel-pi/);
  fs.rmSync(home, { recursive: true, force: true });
});

test('installer: source mode clones the repo; no-kiosk mode leaves the desktop alone', () => {
  const home = tmp();
  const out = install(home, { ARK_SOURCE: '1', ARK_NO_KIOSK: '1' });
  assert.ok(out.includes('git clone --depth 50 https://github.com/areyesromo/Ark-2P-Hub.git /opt/ark/repo'));
  assert.ok(!out.includes('docker pull'));
  assert.ok(!fs.existsSync(path.join(home, '.config/labwc/autostart')));
  fs.rmSync(home, { recursive: true, force: true });
});

/**
 * Run ark-update.sh in a folder with fake docker/curl. `running` and `latest`
 * are the image ids of the running container and the newest image;
 * `playing` is what /healthz reports.
 */
function update({ running, latest, playing, force }) {
  const dir = tmp();
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.copyFileSync(path.join(PI, 'ark-update.sh'), path.join(dir, 'ark-update.sh'));
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(path.join(bin, 'docker'), `#!/usr/bin/env bash
echo "docker $*" >> "${log}"
case "$*" in
  "compose config --images") echo ghcr.io/areyesromo/ark-2p-hub:latest ;;
  "image inspect -f {{.Id}} "*) echo "${latest}" ;;
  "inspect -f {{.Image}} ark-2p-hub") echo "${running}" ;;
esac
`);
  fs.writeFileSync(path.join(bin, 'curl'), `#!/usr/bin/env bash
echo '{"ok":true,"rooms":1,"playing":${playing}}'
`);
  fs.chmodSync(path.join(bin, 'docker'), 0o755);
  fs.chmodSync(path.join(bin, 'curl'), 0o755);
  const out = execFileSync('bash', [path.join(dir, 'ark-update.sh')], {
    env: { PATH: `${bin}:${process.env.PATH}`, FORCE: force ? '1' : '0' },
    encoding: 'utf8',
  });
  const calls = fs.readFileSync(log, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { out, restarted: calls.includes('compose up -d') };
}

test('updater: nothing new means no restart', () => {
  const r = update({ running: 'sha256:a', latest: 'sha256:a', playing: 0 });
  assert.match(r.out, /up to date/);
  assert.equal(r.restarted, false);
});

test('updater: a new version waits while a game is being played, then installs', () => {
  const busy = update({ running: 'sha256:a', latest: 'sha256:b', playing: 1 });
  assert.match(busy.out, /once nobody is playing/);
  assert.equal(busy.restarted, false);
  const idle = update({ running: 'sha256:a', latest: 'sha256:b', playing: 0 });
  assert.equal(idle.restarted, true);
  assert.equal(update({ running: 'sha256:a', latest: 'sha256:b', playing: 2, force: true }).restarted, true, 'FORCE=1 updates anyway');
});
