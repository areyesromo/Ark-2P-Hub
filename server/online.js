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

  /** The TV invites someone online (on) or stops (off). */
  async invite(room, on) {
    if (on && !this.allowed) return { error: 'Online play is turned off in Settings.' };
    room.online = Boolean(on);
    if (on && !this.settings.tunnelUrl && this.tunnel.state.status !== 'on') this.tunnel.start();
    await this.refresh();
    this.sync();
    return { ok: true };
  }

  /** Stop everything (Settings): every room's invite and the tunnel. */
  async stopAll() {
    for (const room of this.rooms.rooms.values()) room.online = false;
    this.tunnel.stop();
    await this.refresh();
  }

  /** No room online any more (one closed, or all stopped): the quick tunnel goes. */
  sync() {
    const any = [...this.rooms.rooms.values()].some((r) => r.online);
    if (!any && this.tunnel.state.status !== 'off') this.tunnel.stop();
  }

  /** Every online room's join details, from the address now in use; out to their screens. */
  async refresh() {
    const base = this.address;
    for (const room of this.rooms.rooms.values()) {
      const was = JSON.stringify(room.onlineInfo || null);
      if (!room.online) {
        room.onlineInfo = null;
      } else {
        const t = this.tunnel.state;
        const status = this.settings.tunnelUrl ? 'on' : t.status;
        const info = { status, error: status === 'error' ? t.error : null, url: null, watchUrl: null, qr: null };
        if (base) {
          info.url = `${base}/play/?room=${room.code}`;
          info.watchUrl = `${base}/host/?watch=${room.code}`;
          info.qr = room.onlineInfo && room.onlineInfo.url === info.url ? room.onlineInfo.qr : await this.qr(info.url);
        }
        room.onlineInfo = info;
      }
      if (JSON.stringify(room.onlineInfo || null) !== was) room.broadcastState();
    }
  }
}

/**
 * Is this request (or socket) coming in over the internet (through a Cloudflare tunnel)?
 * cloudflared adds Cf-Connecting-Ip; the owner's own tunnel host counts too.
 */
export function overInternet(headers = {}, ownUrl = '') {
  if (headers['cf-connecting-ip']) return true;
  if (!ownUrl) return false;
  try {
    return String(headers.host || '').toLowerCase() === new URL(ownUrl).host.toLowerCase();
  } catch {
    return false;
  }
}
