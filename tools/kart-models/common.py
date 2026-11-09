# common.py: the steps both the kart and the driver share (import, place, decimate, cut, export,
# check renders). Positions in the settings are in the game's frame (x forward, y up, z right); the
# glTF exporter turns Blender's Z-up into glTF's Y-up as glTF (x, y, z) = Blender (x, z, -y), so a game
# point (x, y, z) is Blender (x, -z, y).
import math, os
import bmesh, bpy
from mathutils import Matrix, Vector

# Which way the raw mesh's nose points (a glTF axis), as a turn about Blender Z that brings it to +X.
# (The importer puts glTF +z at Blender -y, and -z at +y.)
FORWARD = {'+x': 0, '-x': 180, '+z': 90, '-z': -90}


def B(p):
    """A game-frame point or direction as a Blender vector."""
    return Vector((p[0], -p[2], p[1]))


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_raw(path):
    """The raw mesh as one object (its small loose specks dropped later, by decimate + clean)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in bpy.data.objects:
        if o not in before and o.type != 'MESH':
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def place(obj, forward, size, axis=0, origin=None):
    """Turn the nose to +X, scale so the extent along game `axis` (0 length, 1 height) is `size`,
    centre it on x and z with its lowest point at y = 0; then move `origin` (game frame) to (0,0,0)."""
    obj.data.transform(Matrix.Rotation(math.radians(FORWARD[forward]), 4, 'Z'))
    vs = [v.co for v in obj.data.vertices]
    lo = Vector([min(v[k] for v in vs) for k in range(3)])
    hi = Vector([max(v[k] for v in vs) for k in range(3)])
    ext = (hi - lo)[[0, 2][axis]]  # game x is Blender x, game y is Blender z
    s = size / ext
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    obj.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-centre))
    if origin is not None:
        obj.data.transform(Matrix.Translation(-B(origin)))
    obj.data.update()
    return s


def remesh(obj, voxel):
    """Rebuild the surface on a voxel grid: Hunyuan's meshes have thousands of non-manifold edges,
    which the decimator won't collapse; the remeshed surface is closed and clean."""
    m = obj.modifiers.new('remesh', 'REMESH')
    m.mode = 'VOXEL'
    m.voxel_size = voxel
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier=m.name)


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def decimate(obj, target):
    """Collapse-decimate to about `target` triangles (a little under, so budgets hold)."""
    for _ in range(8):  # one pass can stop short (holes and seams slow the collapse): repeat
        n = triangles(obj)
        if n <= target:
            return
        m = obj.modifiers.new('dec', 'DECIMATE')
        m.decimate_type = 'COLLAPSE'
        m.use_collapse_triangulate = True
        m.ratio = max(0.05, target * 0.97 / n)
        with bpy.context.temp_override(object=obj, active_object=obj):
            bpy.ops.object.modifier_apply(modifier=m.name)
    if triangles(obj) > target:
        print('decimate: %s stopped at %d triangles (target %d)' % (obj.name, triangles(obj), target))


def drop_specks(obj, keep_share=0.01):
    """Delete loose pieces with fewer than keep_share of the faces (Hunyuan's floating crumbs)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    seen, pieces = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, piece = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            piece.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        pieces.append(piece)
    total = len(bm.faces)
    gone = [f for p in pieces if len(p) < total * keep_share for f in p]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def separate(obj, name, inside):
    """Move the faces whose centre passes inside(blender_vector) to a new object `name`; close the
    holes left on both sides. Returns the new object (or None when no face matched)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    picked = [f for f in bm.faces if inside(f.calc_center_median())]
    if not picked:
        bm.free()
        return None
    new_bm = bmesh.new()
    vmap = {}
    for f in picked:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = new_bm.verts.new(v.co)
            vs.append(vmap[v])
        new_bm.faces.new(vs)
    bmesh.ops.delete(bm, geom=picked, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.validate()
    mesh = bpy.data.meshes.new(name)
    new_bm.to_mesh(mesh)
    new_bm.free()
    mesh.validate()
    part = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(part)
    for o in (obj, part):
        fill_holes(o)
    return part


def fill_holes(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    edges = [e for e in bm.edges if e.is_boundary]
    if edges:
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.to_mesh(obj.data)
    bm.free()


def set_origin(obj, game_point):
    """Put the object's origin at a game-frame point, without moving its surface."""
    p = B(game_point)
    obj.data.transform(Matrix.Translation(-p))
    obj.location = obj.location + p


def smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def empty(name, game_point, game_axis=None):
    """A marker node; with game_axis, its local up (glTF +y, Blender +z) points along it."""
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = B(game_point)
    if game_axis is not None:
        e.rotation_mode = 'QUATERNION'
        e.rotation_quaternion = B(game_axis).normalized().to_track_quat('Z', 'Y')
    return e


def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True, export_yup=True,
        export_apply=True, export_image_format='JPEG', export_jpeg_quality=90,
        export_extras=False, export_cameras=False, export_lights=False)


def render_views(objs, out, textured=False, size=512):
    """Six orthographic renders (front, left, back, right, three-quarter, top) of these objects,
    to out_<view>.png: clay shading, or the texture with textured=True."""
    scn = bpy.context.scene
    tints = {'wheel': (0.9, 0.35, 0.3, 1), 'head': (0.3, 0.6, 0.9, 1), 'arm': (0.35, 0.8, 0.4, 1)}
    for o in objs:  # the moving parts in their own colours, to see the cuts
        o.color = next((c for k, c in tints.items() if o.name.startswith(k)), (0.8, 0.78, 0.74, 1))
    hidden = [o for o in scn.objects if o.type == 'MESH' and o not in objs]
    for o in hidden:
        o.hide_render = True
    lo = Vector((1e9,) * 3)
    hi = -lo
    for o in objs:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
    scn.render.engine = 'BLENDER_WORKBENCH'
    scn.display.shading.light = 'STUDIO'
    scn.display.shading.color_type = 'TEXTURE' if textured else 'OBJECT'
    scn.display.shading.show_cavity = not textured
    scn.render.resolution_x = scn.render.resolution_y = size
    scn.world = scn.world or bpy.data.worlds.new('w')
    scn.world.color = (1, 1, 1)
    centre, span = (lo + hi) / 2, (hi - lo).length
    cd = bpy.data.cameras.new('check')
    cd.type = 'ORTHO'
    cd.ortho_scale = span * 0.85
    cam = bpy.data.objects.new('check', cd)
    scn.collection.objects.link(cam)
    scn.camera = cam
    # The kart faces Blender +X, its left is Blender +Y (game -z).
    for name, az, el in [('front', 0, 0), ('left', 90, 0), ('back', 180, 0), ('right', 270, 0), ('threequarter', 35, 25), ('top', 0, 89)]:
        a, e = math.radians(az), math.radians(el)
        d = Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))
        cam.location = centre + d * span * 3
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        scn.render.filepath = out + '_' + name + '.png'
        bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)
    for o in hidden:
        o.hide_render = False
