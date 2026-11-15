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
# still works; the button just says it isn't installed. A pinned version, checked against the
# SHA-256 from its release notes (github.com/cloudflare/cloudflared/releases); the desktop app's
# workflow pins the same one. To update: the new version and its hashes, here and in desktop.yml.
# No download (no internet) still builds, without it; a file that doesn't match its hash stops the build.
ARG TARGETARCH
ARG CLOUDFLARED_VERSION=2026.11.0
RUN ARCH="${TARGETARCH:-$(uname -m)}"; \
    case "$ARCH" in x86_64) ARCH=amd64;; aarch64) ARCH=arm64;; armv7l) ARCH=arm;; esac; \
    case "$ARCH" in \
      amd64) SHA=51f7c68b57ed7269164075d7e789efce5b59355982f06392deeb037d982a51fd;; \
      arm64) SHA=abe54a006acf9faf2d19ee9d953cb0d0804e92f59c5382a162e57b84d086f56f;; \
      arm) SHA=57f6a61df47583ccd5c3507b87964820adccb1f9fd35f311417c7872004dc368;; \
      *) SHA=;; \
    esac; \
    if [ -z "$SHA" ]; then echo "No cloudflared for $ARCH: online play's quick tunnel won't be available"; exit 0; fi; \
    if ! wget -qO /tmp/cloudflared "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${ARCH}"; then \
      rm -f /tmp/cloudflared; echo "cloudflared not downloaded: online play's quick tunnel won't be available"; exit 0; \
    fi; \
    echo "$SHA  /tmp/cloudflared" | sha256sum -c - || { echo "cloudflared ${CLOUDFLARED_VERSION} ($ARCH) doesn't match its SHA-256"; exit 1; }; \
    install -m 755 /tmp/cloudflared /usr/local/bin/cloudflared && rm /tmp/cloudflared

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
