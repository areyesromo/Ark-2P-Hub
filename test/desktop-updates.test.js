import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createUpdates } from '../desktop/updates.js';

const PAGE = 'https://github.com/areyesromo/Ark-2P-Hub/releases/latest';

/** A stand-in for electron-updater's autoUpdater, plus a manual timer. */
function setup({ checkFails = false, downloadFails = false, relaunch } = {}) {
  const updater = new EventEmitter();
  const calls = [];
  updater.checkForUpdates = () => {
    calls.push('check');
    return checkFails ? Promise.reject(new Error('offline')) : Promise.resolve();
  };
  updater.downloadUpdate = () => {
    calls.push('download');
    return downloadFails ? Promise.reject(new Error('404')) : Promise.resolve();
  };
  updater.quitAndInstall = () => calls.push('install');
  const sent = [];
  const opened = [];
  let timer = null;
  const updates = createUpdates({
    updater,
    page: PAGE,
    relaunch,
    send: (s) => sent.push(s),
    openPage: (url) => opened.push(url),
    setTimeout: (fn, ms) => {
      timer = { fn, ms };
      return timer;
    },
  });
  return { updater, calls, sent, opened, updates, fire: () => timer.fn(), timer: () => timer };
}
const tick = () => new Promise((r) => setImmediate(r));

test('checks once, a little after launch, and never downloads by itself', () => {
  const t = setup();
  t.updates.start();
  assert.equal(t.updater.autoDownload, false);
  assert.deepEqual(t.calls, []);
  assert.equal(t.timer().ms, 5000);
  t.fire();
  assert.deepEqual(t.calls, ['check']);
  assert.deepEqual(t.updates.state(), { state: 'idle' });
});

test('a newer version offers an update; the TV is told', () => {
  const t = setup();
  t.updates.start();
  t.fire();
  t.updater.emit('update-available', { version: '0.1.2' });
  assert.deepEqual(t.updates.state(), { state: 'available', version: '0.1.2' });
  assert.deepEqual(t.sent.at(-1), { state: 'available', version: '0.1.2' });
});

test('Update downloads with progress, then Restart installs', async () => {
  const t = setup();
  t.updates.start();
  t.fire();
  t.updater.emit('update-available', { version: '0.1.2' });
  t.updates.act();
  assert.deepEqual(t.calls, ['check', 'download']);
  assert.deepEqual(t.updates.state(), { state: 'downloading', version: '0.1.2', percent: 0 });
  t.updater.emit('download-progress', { percent: 42.7 });
  assert.deepEqual(t.updates.state(), { state: 'downloading', version: '0.1.2', percent: 42 });
  // A second press while downloading does nothing.
  t.updates.act();
  assert.deepEqual(t.calls, ['check', 'download']);
  t.updater.emit('update-downloaded', { version: '0.1.2' });
  assert.deepEqual(t.updates.state(), { state: 'ready', version: '0.1.2', relaunch: true });
  t.updates.act();
  assert.deepEqual(t.calls, ['check', 'download', 'install']);
  await tick();
});

test('a failed check (offline) stays quiet', async () => {
  const t = setup({ checkFails: true });
  t.updates.start();
  t.fire();
  t.updater.emit('error', new Error('offline'));
  await tick();
  assert.deepEqual(t.updates.state(), { state: 'idle' });
  t.updates.act();
  assert.deepEqual(t.opened, []);
});

test('a failed download shows the error, and the button opens the releases page', async () => {
  const t = setup({ downloadFails: true });
  t.updates.start();
  t.fire();
  t.updater.emit('update-available', { version: '0.1.2' });
  t.updates.act();
  await tick();
  assert.deepEqual(t.updates.state(), { state: 'error', version: '0.1.2', url: PAGE });
  t.updates.act();
  assert.deepEqual(t.opened, [PAGE]);
});

test('an error event during the download counts as a failed download', () => {
  const t = setup();
  t.updates.start();
  t.fire();
  t.updater.emit('update-available', { version: '0.1.2' });
  t.updates.act();
  t.updater.emit('error', new Error('checksum'));
  assert.equal(t.updates.state().state, 'error');
});

test('nothing to do before an update is found', () => {
  const t = setup();
  t.updates.start();
  t.updates.act();
  assert.deepEqual(t.calls, []);
  assert.deepEqual(t.opened, []);
});

test('under Steam the update installs and closes instead of relaunching', () => {
  const t = setup({ relaunch: false });
  t.updates.start();
  t.fire();
  t.updater.emit('update-available', { version: '0.1.2' });
  t.updates.act();
  t.updater.emit('update-downloaded', { version: '0.1.2' });
  assert.deepEqual(t.updates.state(), { state: 'ready', version: '0.1.2', relaunch: false });
});

test('a hub left running checks again every 6 hours until it finds one', () => {
  const t = setup();
  t.updates.start();
  t.fire();
  assert.equal(t.timer().ms, 6 * 60 * 60 * 1000);
  t.fire();
  assert.deepEqual(t.calls, ['check', 'check']);
  t.updater.emit('update-available', { version: '0.1.2' });
  const last = t.timer();
  t.fire();
  assert.deepEqual(t.calls, ['check', 'check'], 'no more checks once an update is offered');
  assert.equal(t.timer(), last);
});
