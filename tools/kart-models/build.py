# build.py: turn a racer's raw Hunyuan3D meshes into Kart Race 3D's models, run in Blender:
#   "$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- <racer> [--only kart|rex] [--texture <dir>] [--check]
# BLENDER is the Steam copy, A:/SteamLibrary/steamapps/common/Blender/blender.exe. The racer's numbers
# (wheel hubs, cut planes, seat) are in tools/kart-models/<racer>.json, in the game's frame: x forward,
# y up, z right, in game units (the kart is 1.75 long). Writes public/games/kart-race-3d/models/
# <racer>-kart.glb and <racer>.glb; with --check, six renders of each to asset-references/v5/.
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

import bpy  # noqa: E402
import common, kart  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('racer')
ap.add_argument('--only', choices=['kart', 'rex'])
ap.add_argument('--texture')
ap.add_argument('--check', action='store_true')
opts = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

cfg = json.load(open(os.path.join(HERE, opts.racer + '.json')))
OUT = os.path.join(ROOT, 'public', 'games', 'kart-race-3d', 'models')
CHECK = os.path.join(ROOT, 'asset-references', 'v5', 'textures', opts.racer, 'check')
os.makedirs(OUT, exist_ok=True)

common.reset()
parts = {}
if opts.only in (None, 'kart'):
    parts['kart'] = kart.build(cfg['kart'], ROOT)
    common.export(parts['kart'], os.path.join(OUT, opts.racer + '-kart.glb'))
if opts.check:
    os.makedirs(CHECK, exist_ok=True)
    for name, objs in parts.items():
        common.render_views(objs, os.path.join(CHECK, name))
print('built', opts.racer, sorted(parts))
