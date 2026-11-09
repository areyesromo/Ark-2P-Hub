# driver.py: a racer's driver, from the raw mesh to the game's pieces: torso (with legs and tail),
# head (pivot at the neck) and two arms (pivots at the shoulders). The file's origin is the point
# that sits on the kart's `seat`. A piece takes the faces whose centre passes any of its groups of
# planes (each plane [px, py, pz, nx, ny, nz]: keep the side the normal points to); the rest is torso.
import os
import common

ROUGH = 60000


def passes(c, groups):
    for planes in groups:
        if all((c - common.B(p[:3])).dot(common.B(p[3:])) >= 0 for p in planes):
            return True
    return False


def build(cfg, root):
    torso = common.import_raw(os.path.join(root, cfg['src']))
    torso.name = torso.data.name = 'torso'
    common.place(torso, cfg['forward'], cfg['height'], axis=1, origin=cfg['origin'])
    common.remesh(torso, cfg['voxel'])
    common.decimate(torso, ROUGH)
    common.drop_specks(torso)
    pieces = []
    for name, piece in cfg['pieces'].items():
        part = common.separate(torso, name, lambda c, g=piece['any']: passes(c, g))
        if part is None:
            raise SystemExit('no faces for ' + name)
        common.set_origin(part, piece['pivot'])
        budget = cfg['budget']['arm' if name.startswith('arm') else name]
        common.decimate(part, budget)
        common.smooth(part)
        pieces.append(part)
    common.decimate(torso, cfg['budget']['torso'])
    common.smooth(torso)
    print('driver triangles', common.triangles(torso), [(p.name, common.triangles(p)) for p in pieces])
    return [torso] + pieces
