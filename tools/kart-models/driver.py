# driver.py: a racer's driver, from the raw mesh to the game's skinned model: one mesh (`rex`) on a
# skeleton of 22 bones (`rig`), its origin the point that sits on the kart's `seat`. The joints are
# measured once per racer (<racer>.json "joints", game frame, relative to that point); Blender works
# out the skin weights (at most 4 bones a vertex). The game moves the bones (body3d.js).
import os
import bpy
import common

ROUGH = 60000

# Each bone: (name, from joint, to joint, parent). A bone runs from its joint to the next in its chain.
BONES = [('hips', 'hips', 'spine', None), ('spine', 'spine', 'chest', 'hips'), ('chest', 'chest', 'neck', 'spine'),
         ('neck', 'neck', 'head', 'chest'), ('head', 'head', 'head_top', 'neck')]
for s in ('l', 'r'):
    BONES += [('shoulder_' + s, 'shoulder_' + s, 'upper_arm_' + s, 'chest'),
              ('upper_arm_' + s, 'upper_arm_' + s, 'elbow_' + s, 'shoulder_' + s),
              ('forearm_' + s, 'elbow_' + s, 'hand_' + s, 'upper_arm_' + s),
              ('hand_' + s, 'hand_' + s, 'hand_tip_' + s, 'forearm_' + s),
              ('thigh_' + s, 'thigh_' + s, 'knee_' + s, 'hips'),
              ('shin_' + s, 'knee_' + s, 'ankle_' + s, 'thigh_' + s),
              ('foot_' + s, 'ankle_' + s, 'toe_' + s, 'shin_' + s)]
BONES += [('tail_1', 'tail_1', 'tail_2', 'hips'), ('tail_2', 'tail_2', 'tail_3', 'tail_1'), ('tail_3', 'tail_3', 'tail_tip', 'tail_2')]


def joints(cfg):
    """The joints in the game frame, with each `_l` joint mirrored to `_r` (left is -z)."""
    out = {}
    for name, p in cfg['joints'].items():
        if name.endswith('_l'):
            out[name] = p
            out[name[:-2] + '_r'] = [p[0], p[1], -p[2]]
        else:
            out[name] = p
    return out


def skeleton(cfg):
    j = joints(cfg)
    arm = bpy.data.armatures.new('rig')
    rig = bpy.data.objects.new('rig', arm)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    made = {}
    for name, a, b, parent in BONES:
        bone = arm.edit_bones.new(name)
        bone.head = common.B(j[a])
        bone.tail = common.B(j[b])
        bone.roll = 0
        if parent:
            bone.parent = made[parent]
        made[name] = bone
    bpy.ops.object.mode_set(mode='OBJECT')
    return rig


def build(cfg, root):
    mesh = common.import_raw(os.path.join(root, cfg['src']))
    mesh.name = mesh.data.name = 'rex'
    common.place(mesh, cfg['forward'], cfg['height'], axis=1, origin=cfg['origin'])
    common.remesh(mesh, cfg['voxel'])
    common.decimate(mesh, ROUGH)
    common.drop_specks(mesh)
    common.decimate(mesh, cfg['budget'])
    common.smooth(mesh)
    rig = skeleton(cfg)
    # Skin it: automatic weights, then at most 4 bones a vertex, adding up to 1.
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.select_all(action='DESELECT')
    mesh.select_set(True)
    bpy.ops.object.vertex_group_limit_total(limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    unweighted = sum(1 for v in mesh.data.vertices if not v.groups)
    print('driver triangles', common.triangles(mesh), 'bones', len(rig.data.bones), 'vertices with no bone', unweighted)
    return [rig, mesh]
