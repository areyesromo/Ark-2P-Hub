import { spawn as nodeSpawn } from 'node:child_process';

/** The address a quick tunnel gets, as cloudflared prints it. */
export const QUICK_URL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;
/** How long to wait for the address before giving up. */
export const START_MS = 30000;

/**
 * A Cloudflare quick tunnel (https://<random>.trycloudflare.com) to this hub, for playing with
 * someone who isn't in the same house: no Cloudflare account, no settings. It runs the cloudflared
 * program (in the Docker image and the desktop app; CLOUDFLARED points at another copy) and reads
 * the address it prints. One tunnel serves every room; it runs only while a room has invited
 * someone online.
 *
 * state: { status: 'off' | 'starting' | 'on' | 'error', url, error }
 */
export class Tunnel {
  constructor({ port, bin = process.env.CLOUDFLARED || 'cloudflared', spawn = nodeSpawn, onChange = () => {}, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    this.port = port;
    this.bin = bin;
    this.spawn = spawn;
    this.onChange = onChange;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.child = null;
    this.timer = null;
    this.state = { status: 'off', url: null, error: null };
  }

  set(state) {
    this.state = { status: 'off', url: null, error: null, ...state };
    this.onChange(this.state);
  }

  start() {
    if (this.child) return;
    let child;
    try {
      const port = typeof this.port === 'function' ? this.port() : this.port; // (the hub's port, once it's listening)
      child = this.spawn(this.bin, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return this.set({ status: 'error', error: this.why(err) });
    }
    this.child = child;
    this.set({ status: 'starting' });
    // cloudflared logs to stderr: the address turns up in a box a few seconds in.
    const read = (chunk) => {
      const m = String(chunk).match(QUICK_URL);
      if (m && this.child === child && this.state.status !== 'on') {
        this.clearTimer(this.timer);
        this.set({ status: 'on', url: m[0] });
      }
    };
    if (child.stdout) child.stdout.on('data', read);
    if (child.stderr) child.stderr.on('data', read);
    child.on('error', (err) => {
      if (this.child !== child) return;
      this.child = null;
      this.clearTimer(this.timer);
      this.set({ status: 'error', error: this.why(err) });
    });
    child.on('exit', () => {
      if (this.child !== child) return;
      this.child = null;
      this.clearTimer(this.timer);
      // (it stopped by itself: an error if it never got going)
      this.set(this.state.status === 'on' ? { status: 'off' } : { status: 'error', error: 'The tunnel stopped before it was ready. Is the hub online?' });
    });
    this.timer = this.setTimer(() => {
      if (this.child !== child || this.state.status === 'on') return;
      this.stop();
      this.set({ status: 'error', error: 'No tunnel after 30 seconds. Is the hub online?' });
    }, START_MS);
  }

  stop() {
    this.clearTimer(this.timer);
    const child = this.child;
    this.child = null;
    if (child) {
      try {
        child.kill();
      } catch {
        // (already gone)
      }
    }
    if (this.state.status !== 'off') this.set({ status: 'off' });
  }

  why(err) {
    return err && err.code === 'ENOENT' ? 'cloudflared isn\'t installed here (it comes with the Docker image and the desktop app).' : `Couldn't start the tunnel: ${err && err.message}`;
  }
}
