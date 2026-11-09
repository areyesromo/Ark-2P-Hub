# build.py: turn a racer's raw Hunyuan3D meshes into Kart Race 3D's models, run in Blender:
#   "$BLENDER" -b --factory-startup --python tools/kart-models/build.py -- <racer> [--only kart|rex] [--texture <dir>] [--check]
# BLENDER is the Steam copy, A:/SteamLibrary/steamapps/common/Blender/blender.exe. The racer's numbers
# (wheel hubs, cut planes, seat) are in tools/kart-models/<racer>.json, in the game's frame: x forward,
# y up, z right, in game units (the kart is 1.75 long). Writes public/games/kart-race-3d/models/
# <racer>-kart.glb and <racer>.glb, the first-pass textures and ChatGPT's guides to
# asset-references/v5/textures/<racer>/; with --check, six renders of each to its check/ folder.
# --texture <dir> uses <dir>/kart.png and <dir>/rex.png (painted over the guides) instead of the first pass.
import argparse, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

import bpy  # noqa: E402
import math  # noqa: E402
import common, driver, kart, paint  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('racer')
ap.add_argument('--only', choices=['kart', 'rex'])
ap.add_argument('--texture')
ap.add_argument('--check', action='store_true')
opts = ap.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

cfg = json.load(open(os.path.join(HERE, opts.racer + '.json')))
OUT = os.path.join(ROOT, 'public', 'games', 'kart-race-3d', 'models')
CHECK = os.path.join(ROOT, 'asset-references', 'v5', 'textures', opts.racer, 'check')
TEX = os.path.join(ROOT, 'asset-references', 'v5', 'textures', opts.racer)
os.makedirs(OUT, exist_ok=True)
align = {}
for a in json.load(open(os.path.join(ROOT, cfg['views']['alignment']))):
    align.setdefault(a['set'], {})[a['view']] = a


def colour(name, objs):
    """UVs and the texture: the first pass, or with --texture, <dir>/<name>.png painted over the guide."""
    meshes = [o for o in objs if o.type == 'MESH']
    painted = os.path.join(opts.texture, name + '.png') if opts.texture else None
    paint.paint(meshes, cfg['atlas'][name], os.path.join(ROOT, cfg['views'][name]), align[name], name, TEX, painted)


common.reset()
parts = {}
if opts.only in (None, 'kart'):
    parts['kart'] = kart.build(cfg['kart'], ROOT)
    colour('kart', parts['kart'])
    common.export(parts['kart'], os.path.join(OUT, opts.racer + '-kart.glb'))
if opts.only in (None, 'rex'):
    parts['rex'] = driver.build(cfg['rex'], ROOT)
    colour('rex', parts['rex'])
    common.export(parts['rex'], os.path.join(OUT, opts.racer + '.glb'))
if opts.check:
    os.makedirs(CHECK, exist_ok=True)
    for name, objs in parts.items():
        common.render_views(objs, os.path.join(CHECK, name), textured=True)
    if len(parts) == 2:
        # Rex in his seat, then turned as far as the game turns him (full right lock): head 30 degrees,
        # the left hand up and the right hand down at the shoulders (KRRig.ARM_PER_STEER x 25 degrees).
        seat = common.B(cfg['kart']['seat'])
        for o in parts['rex']:
            o.location = o.location + seat
        both = parts['kart'] + parts['rex']
        common.render_views(both, os.path.join(CHECK, 'seated'), textured=True)
        byname = {o.name: o for o in both}
        byname['head'].rotation_euler.z -= math.radians(30)  # looking right
        raise_ = 0.6 * math.radians(25)  # a raise turns about game z, which is Blender -y
        byname['arm_l'].rotation_euler.y -= raise_
        byname['arm_r'].rotation_euler.y += raise_
        for n in ('wheel_fl', 'wheel_fr'):
            byname[n].rotation_euler.z -= math.radians(25)  # to the right
        common.render_views(both, os.path.join(CHECK, 'posed'), textured=True)
print('built', opts.racer, sorted(parts))
