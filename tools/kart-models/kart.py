# kart.py: a racer's kart, from the raw mesh to the game's parts: body, four wheels that can spin
# and steer (origins at their hubs), and markers for the seat and the steering column.
import os
import common
from mathutils import Vector

ROUGH = 60000  # decimate the 1.2M-triangle raw mesh to this before cutting


def build(cfg, root):
    body = common.import_raw(os.path.join(root, cfg['src']))
    body.name = body.data.name = 'body'
    common.place(body, cfg['forward'], cfg['length'])
    common.remesh(body, cfg['voxel'])
    common.decimate(body, ROUGH)
    common.drop_specks(body)
    wheels = []
    for wid, w in cfg['wheels'].items():
        hub = common.B(w['hub'])
        r, half = w['radius'] * 1.05, w['width'] * 1.1 / 2

        def inside(c, hub=hub, r=r, half=half):
            # The axle runs along game z, which is Blender y.
            return abs(c.y - hub.y) <= half and Vector((c.x - hub.x, c.z - hub.z)).length <= r

        wheel = common.separate(body, 'wheel_' + wid, inside)
        if wheel is None:
            raise SystemExit('no faces inside wheel ' + wid)
        common.set_origin(wheel, w['hub'])
        common.decimate(wheel, cfg['budget']['wheel'])
        common.smooth(wheel)
        wheels.append(wheel)
    # The body takes what the wheels leave of the whole budget.
    common.decimate(body, cfg['budget']['body'] + 4 * cfg['budget']['wheel'] - sum(common.triangles(w) for w in wheels))
    common.smooth(body)
    seat = common.empty('seat', cfg['seat'])
    column = common.empty('column', cfg['column']['at'], cfg['column']['axis'])
    print('kart triangles', common.triangles(body), [common.triangles(w) for w in wheels])
    return [body] + wheels + [seat, column]
