// electron-builder afterPack hook (Linux): puts a small launcher in front of the app binary.
// Steam preloads its overlay library (gameoverlayrenderer.so) into everything it starts, and in
// Electron's helper processes it hangs (see steam.js). The launcher drops it from LD_PRELOAD before
// Electron starts, so no process ever loads it. The AppImage's AppRun starts "$APPDIR/<name>",
// which is now the launcher; the real binary is "<name>.bin".
const fs = require('node:fs');
const path = require('node:path');

const LAUNCHER = `#!/bin/sh
# Ark 2P Hub launcher (desktop/after-pack.cjs): start the app without Steam's overlay library.
case "$LD_PRELOAD" in
  *gameoverlayrenderer*)
    kept=""
    for lib in $(printf '%s' "$LD_PRELOAD" | tr ':' ' '); do
      case "$lib" in
        *gameoverlayrenderer*) ;;
        *) kept="\${kept:+$kept:}$lib" ;;
      esac
    done
    if [ -n "$kept" ]; then export LD_PRELOAD="$kept"; else unset LD_PRELOAD; fi
    export ARK_STEAM_OVERLAY_REMOVED=launcher
    ;;
esac
exec "$(dirname "$(readlink -f "$0")")/__BIN__" "$@"
`;

exports.LAUNCHER = LAUNCHER;

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return;
  const name = context.packager.executableName;
  const exe = path.join(context.appOutDir, name);
  const bin = name + '.bin';
  fs.renameSync(exe, path.join(context.appOutDir, bin));
  fs.writeFileSync(exe, LAUNCHER.replace('__BIN__', bin), { mode: 0o755 });
};
