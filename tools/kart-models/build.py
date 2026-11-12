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

# Test poses for the check renders: bone -> rotation in its own frame (degrees, x y z).
POSES = {  # (a positive x turn lifts an arm forward and up)
    'steer-left': {'upper_arm_l': (-15, 0, 0), 'upper_arm_r': (15, 0, 0), 'forearm_l': (-10, 0, 0), 'forearm_r': (10, 0, 0), 'head': (0, 0, 20)},
    'steer-right': {'upper_arm_l': (15, 0, 0), 'upper_arm_r': (-15, 0, 0), 'forearm_l': (10, 0, 0), 'forearm_r': (-10, 0, 0), 'head': (0, 0, -20)},
    'arms-up': {'upper_arm_l': (110, 0, 0), 'upper_arm_r': (110, 0, 0), 'head': (20, 0, 0)},
    'throw': {'upper_arm_r': (140, 0, 0), 'forearm_r': (60, 0, 0), 'chest': (-10, 0, 0)},
    'drop': {'upper_arm_l': (90, 0, 60), 'forearm_l': (30, 0, 0), 'tail_1': (0, 0, 25), 'tail_2': (0, 0, 20), 'tail_3': (0, 0, 15)},
}
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
    painted = os.path.join(os.path.abspath(opts.texture), name + '.png') if opts.texture else None  # (Blender won't read a relative path)
    paint.paint(meshes, cfg['atlas'][name], os.path.join(ROOT, cfg['views'][name]), align[name], name, TEX, painted, cfg['views'].get(name + 'Wheel'))


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
        # Rex in his seat (his rig carries his mesh), then bent as the game bends him, to catch the
        # skin tearing or folding at the shoulders, elbows, neck or tail root.
        seat = common.B(cfg['kart']['seat'])
        rig = next(o for o in parts['rex'] if o.type == 'ARMATURE')
        rig.location = rig.location + seat
        rig.data.pose_position = 'POSE'  # (the glTF export can leave it showing the rest pose)
        both = parts['kart'] + parts['rex']
        common.render_views(both, os.path.join(CHECK, 'seated'), textured=True)
        for name, bends in POSES.items():
            for pb in rig.pose.bones:
                pb.rotation_mode = 'XYZ'
                pb.rotation_euler = (0, 0, 0)
            for bone, xyz in bends.items():
                rig.pose.bones[bone].rotation_euler = [math.radians(a) for a in xyz]
            bpy.context.view_layer.update()
            common.render_views(both, os.path.join(CHECK, 'rig-' + name), textured=True)
print('built', opts.racer, sorted(parts))
