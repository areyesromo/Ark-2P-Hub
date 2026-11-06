# Multi-arch friendly: node:22-alpine has amd64 and arm64 (Raspberry Pi 4/5) images.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app

COPY package.json package-lock.json ./
# (Optional dependencies are the desktop app's self-update: not needed here.)
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# cloudflared, for online play's quick tunnel (the TV's 🌍 Invite online button). Without it the hub
# still works; the button just says it isn't installed.
ARG TARGETARCH
RUN ARCH="${TARGETARCH:-$(uname -m)}"; \
    case "$ARCH" in x86_64) ARCH=amd64;; aarch64) ARCH=arm64;; armv7l) ARCH=arm;; esac; \
    (wget -qO /usr/local/bin/cloudflared "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH}" \
      && chmod +x /usr/local/bin/cloudflared) \
    || (rm -f /usr/local/bin/cloudflared; echo "cloudflared not downloaded: online play's quick tunnel won't be available")

COPY server ./server
COPY public ./public

# Stamped by update.sh / update.ps1 (and CI) so /version shows what is running.
ARG GIT_SHA=unknown
ARG BUILD_TIME=unknown
ENV ARK_COMMIT=$GIT_SHA \
    ARK_BUILT=$BUILD_TIME

# Settings (admin password hash, join address) live here; compose mounts a volume on it.
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:${PORT}/healthz >/dev/null || exit 1

CMD ["node", "server/index.js"]
