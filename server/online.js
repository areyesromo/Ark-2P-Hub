import { randomBytes } from 'node:crypto';

/**
 * Online play: a friend somewhere else joins over the internet. The TV's 🌍 Invite online button
 * asks for it; this gives the room an internet address (the owner's own tunnel from Settings, or a
 * Cloudflare quick tunnel started for it, see tunnel.js) with a QR code for the friend's phone and
 * a link to a remote screen (the TV, mirrored: /host/?watch=CODE).
 *
 * The quick tunnel runs only while some room has invited someone online. Settings can turn the
 * button off, set an address of your own, or stop the tunnel.
 */
export class Online {
  constructor({ settings, tunnel, rooms, qr = async () => null }) {
    this.settings = settings;
    this.tunnel = tunnel;
    this.rooms = rooms;
    this.qr = qr; // (url) -> data URL of a QR code
    rooms.online = this; // (rooms ask whether online play is allowed)
    this.closing = false;
    this.onShutOut = () => {}; // (room) -> send away whoever came in to it over the internet (sockets.js sets it)
  }

  /** The hub is shutting down: the tunnel goes, and nothing starts it again. */
  shutdown() {
    this.closing = true;
    this.tunnel.stop();
  }

  get allowed() {
    return this.settings.onlineAllowed;
  }

  /** The internet address in use: the owner's own, or the quick tunnel's once it's up (or null). */
  get address() {
    if (this.settings.tunnelUrl) return this.settings.tunnelUrl;
    return this.tunnel.state.status === 'on' ? this.tunnel.state.url : null;
  }

  /** For Settings: allowed, own address, what the tunnel is doing. */
  status() {
    const own = this.settings.tunnelUrl;
    const t = this.tunnel.state;
    return {
      allowed: this.allowed,
      ownUrl: own || '',
      status: own ? 'on' : t.status,
      url: this.address,
      error: own ? null : t.error,
      rooms: [...this.rooms.rooms.values()].filter((r) => r.online).map((r) => r.code),
    };
  }

  /**
   * The TV invites someone online (on) or stops (off). Each invite gets a fresh key that goes in the
   * links: from the internet only someone with it gets in (a 4-letter room code is too easy to guess).
   */
  async invite(room, on) {
    if (on && !this.allowed) return { error: 'Online play is turned off in Settings.' };
    if (on && !room.online) room.onlineKey = randomBytes(8).toString('hex');
    if (!on) room.onlineKey = null;
    room.online = Boolean(on);
    if (!on) this.onShutOut(room); // (Stop: the friend and their screen go too)
    if (on && this.tunnel.state.status === 'error') this.tunnel.stop(); // (Try again: a fresh start)
    await this.refresh();
    return { ok: true };
  }

  /** May this socket or request from the internet get into `room` (online, allowed, with its key)? */
  admits(room, key) {
    return Boolean(room && room.online && this.allowed && room.onlineKey && key === room.onlineKey);
  }

  /** Stop everything (Settings): every room's invite and the tunnel. */
  async stopAll() {
    for (const room of this.rooms.rooms.values()) {
      if (room.online) this.onShutOut(room);
      room.online = false;
      room.onlineKey = null;
    }
    this.tunnel.stop();
    await this.refresh();
  }

  /**
   * The quick tunnel follows the rooms: running while one is online (started again if it dropped),
   * gone when none is, or when your own address is set instead.
   */
  sync() {
    const any = !this.closing && this.allowed && [...this.rooms.rooms.values()].some((r) => r.online);
    const want = any && !this.settings.tunnelUrl;
    const status = this.tunnel.state.status;
    if (!want && status !== 'off') this.tunnel.stop();
    else if (want && status === 'off') this.tunnel.startSoon();
  }

  /** Every online room's join details, from the address now in use; out to their screens. */
  async refresh() {
    this.sync();
    const seq = (this.seq = (this.seq || 0) + 1); // (a newer refresh wins over one still making QR codes)
    const base = this.address;
    for (const room of this.rooms.rooms.values()) {
      if (seq !== this.seq) return;
      const was = JSON.stringify(room.onlineInfo || null);
      if (!room.online) {
        room.onlineInfo = null;
      } else {
        const t = this.tunnel.state;
        const status = this.settings.tunnelUrl ? 'on' : t.status;
        const info = { status, error: status === 'error' ? t.error : null, url: null, watchUrl: null, qr: null };
        if (base) {
          info.url = `${base}/play/?room=${room.code}&k=${room.onlineKey}`;
          info.watchUrl = `${base}/host/?watch=${room.code}&k=${room.onlineKey}`;
          info.qr = room.onlineInfo && room.onlineInfo.url === info.url ? room.onlineInfo.qr : await this.qr(info.url);
          if (seq !== this.seq) return;
        }
        room.onlineInfo = info;
      }
      if (JSON.stringify(room.onlineInfo || null) !== was) room.broadcastState();
    }
  }
}

/**
 * Is this request (or socket) coming in over the internet (through a Cloudflare tunnel)?
 * cloudflared adds Cf-Connecting-Ip; with your own address set, its host counts too (as it came,
 * or forwarded: X-Forwarded-Host, Forwarded host=).
 */
export function overInternet(headers = {}, ownUrl = '') {
  if (headers['cf-connecting-ip']) return true;
  if (!ownUrl) return false;
  let own;
  try {
    own = new URL(ownUrl).host.toLowerCase();
  } catch {
    return false;
  }
  // Its host: as the request came, or as a proxy that rewrites Host passes it on (a home proxy's
  // X-Forwarded-For alone doesn't count: that's how https at home often works).
  const fwd = /(?:^|[;,\s])host="?([^;,"\s]+)/i.exec(String(headers.forwarded || ''));
  const hosts = [headers.host, String(headers['x-forwarded-host'] || '').split(',')[0], fwd && fwd[1]];
  return hosts.some((h) => String(h || '').trim().toLowerCase() === own);
}
