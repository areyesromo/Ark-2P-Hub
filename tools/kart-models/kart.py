# kart.py: a racer's kart, from the raw mesh to the game's parts: body, four wheels that can spin
# and steer (origins at their hubs), the steering wheel (`steer`, turning on the column, with the
# driver's grips `grip_l` / `grip_r` at 10 and 2 o'clock), and markers for the seat and the column.
import math
import os
import bpy
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
    steer = steering_wheel(body, cfg)
    common.decimate(steer, cfg['budget'].get('steer', 300))
    common.smooth(steer)
    # The body takes what the wheels and the steering wheel leave of the whole budget.
    common.decimate(body, cfg['budget']['body'] + 4 * cfg['budget']['wheel'] - sum(common.triangles(w) for w in wheels) - common.triangles(steer))
    common.smooth(body)
    seat = common.empty('seat', cfg['seat'])
    column = common.empty('column', cfg['column']['at'], cfg['column']['axis'])
    print('kart triangles', common.triangles(body), [common.triangles(w) for w in wheels], 'steer', common.triangles(steer))
    return [body] + wheels + [steer] + grips(steer, cfg) + [seat, column]


def steering_wheel(body, cfg):
    '''Cut the steering wheel out (the faces near the column's axis, close to the wheel's plane), its
    origin on the column at the wheel's centre and its local up (glTF +y) along the column.'''
    s = cfg['steer']
    centre = common.B(s['centre'])
    axis = common.B(cfg['column']['axis']).normalized()

    def inside(c):
        d = c - centre
        along = d.dot(axis)
        return abs(along) <= s['depth'] and (d - axis * along).length <= s['radius'] * 1.1

    steer = common.separate(body, 'steer', inside)
    if steer is None:
        raise SystemExit('no faces in the steering wheel')
    common.set_origin(steer, s['centre'])
    q = axis.to_track_quat('Z', 'Y')
    steer.data.transform(q.inverted().to_matrix().to_4x4())
    steer.rotation_mode = 'QUATERNION'
    steer.rotation_quaternion = q
    return steer


def grips(steer, cfg):
    '''The driver's grips on the rim, children of `steer`: `gripAngle` degrees round from the top
    each side (120: 8 and 4 o'clock, the near side of a wheel tilted towards the driver, in reach).'''
    s = cfg['steer']
    axis = Vector(cfg['column']['axis']).normalized()  # (game frame)
    up = Vector((0, 1, 0))
    twelve = (up - axis * up.dot(axis)).normalized()  # the top of the wheel, as the driver sees it
    right = Vector((0, 0, 1))
    right = (right - axis * right.dot(axis) - twelve * right.dot(twelve)).normalized()
    out = []
    bpy.context.view_layer.update()
    for name, side in (('grip_l', -1), ('grip_r', 1)):
        p = Vector(s['centre']) + s['radius'] * (math.cos(math.radians(s.get('gripAngle', 60))) * twelve + side * math.sin(math.radians(s.get('gripAngle', 60))) * right)
        g = common.empty(name, list(p))
        bpy.context.view_layer.update()
        world = g.matrix_world.copy()
        g.parent = steer
        g.matrix_world = world
        out.append(g)
    return out
