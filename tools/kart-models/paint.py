# paint.py: one 1024 texture per model. Faces are grouped by the side they face (front, back, left,
# right, top, bottom); each side's faces are projected flat onto that side's rect in the texture, the
# whole model scaled the same way, so a side's rect looks like the model seen from that side. The
# first pass fills each side's rect from that side's reference view (ChatGPT's R-002 pictures):
# the top from the edge of the side views, the bottom plain dark. guide() draws the faces' outlines
# and the rect names over it, for ChatGPT to repaint (R-003).
import os
import bpy
import numpy as np

SIZE = 1024
MARGIN = 4 / SIZE
BG = 0.97  # a reference pixel this bright in every channel is the white background
SIDES = ('front', 'back', 'left', 'right', 'top', 'bottom')


def game(v):
    """A Blender point as the game's (x, y, z)."""
    return (v[0], v[2], -v[1])


def project(side, p):
    """A game-frame point as the (u, v) its side's view sees: u to the right, v up."""
    x, y, z = p
    return {'left': (-x, y), 'right': (x, y), 'front': (-z, y), 'back': (z, y),
            'top': (x, -z), 'bottom': (x, z)}[side]


def facing(n):
    """Which side a face's game-frame normal faces most."""
    x, y, z = n
    a = [abs(x), abs(y), abs(z)]
    k = a.index(max(a))
    return [('front', 'back'), ('top', 'bottom'), ('right', 'left')][k][0 if (x, y, z)[k] > 0 else 1]


def fit(bounds, rect):
    """The (scale, offset_u, offset_v) that puts projected bounds in a rect, aspect kept, centred."""
    u0, u1, v0, v1 = bounds
    r0, s0, r1, s1 = rect
    w, h = r1 - r0 - 2 * MARGIN, s1 - s0 - 2 * MARGIN
    k = min(w / (u1 - u0), h / (v1 - v0))
    return k, r0 + MARGIN + (w - k * (u1 - u0)) / 2 - k * u0, s0 + MARGIN + (h - k * (v1 - v0)) / 2 - k * v0


def unwrap(objects, atlas):
    """UVs for every face, and the per-side mapping {side: (bounds, (k, ou, ov))} used to paint."""
    bpy.context.view_layer.update()
    pts = [game(o.matrix_world @ v.co) for o in objects for v in o.data.vertices]
    maps = {}
    for side in SIDES:
        uv = [project(side, p) for p in pts]
        bounds = (min(a for a, _ in uv), max(a for a, _ in uv), min(b for _, b in uv), max(b for _, b in uv))
        maps[side] = (bounds, fit(bounds, atlas[side]))
    for o in objects:
        mesh = o.data
        layer = mesh.uv_layers.new(name='UVMap')
        rot = o.matrix_world.to_3x3()
        for poly in mesh.polygons:
            side = facing(game(rot @ poly.normal))
            k, ou, ov = maps[side][1]
            for li in poly.loop_indices:
                u, v = project(side, game(o.matrix_world @ mesh.vertices[mesh.loops[li].vertex_index].co))
                layer.data[li].uv = (ou + k * u, ov + k * v)
    return maps


def load(path):
    """A reference picture as a float array [rows from the bottom, cols, rgba]."""
    img = bpy.data.images.load(path)
    a = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
    bpy.data.images.remove(img)
    return a


def fill_empty(tex, mask, region):
    """Texels in `region` not yet painted (mask False) take the nearest painted texel's colour."""
    r0, c0, r1, c1 = region
    t, m = tex[r0:r1, c0:c1], mask[r0:r1, c0:c1]
    for _ in range(64):
        if m.all():
            break
        grown = m.copy()
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            src = np.roll(np.roll(m, dr, 0), dc, 1)
            take = src & ~grown
            t[take] = np.roll(np.roll(t, dr, 0), dc, 1)[take]
            grown |= take
        m[:] = grown
    if not m.all():
        t[~m] = t[m].mean(axis=0) if m.any() else (0.1, 0.1, 0.1, 1)


def first_pass(maps, atlas, views_dir, align):
    """The first-pass texture: each side's rect resampled from its reference view."""
    tex = np.zeros((SIZE, SIZE, 4), np.float32)
    tex[..., 3] = 1
    mask = np.zeros((SIZE, SIZE), bool)
    pics = {}
    for side in ('front', 'back', 'left', 'right'):
        pics[side] = load(os.path.join(views_dir, side + '.png'))
    for side in SIDES:
        rect = atlas[side]
        c0, r0 = int(rect[0] * SIZE), int(rect[1] * SIZE)
        c1, r1 = int(rect[2] * SIZE), int(rect[3] * SIZE)
        (u0, u1, v0, v1), (k, ou, ov) = maps[side]
        cols = (np.arange(c0, c1) + 0.5) / SIZE
        rows = (np.arange(r0, r1) + 0.5) / SIZE
        U, V = np.meshgrid((cols - ou) / k, (rows - ov) / k)  # model (u, v) of each texel
        if side == 'bottom':
            tex[r0:r1, c0:c1, :3] = 0.08
            mask[r0:r1, c0:c1] = True
            continue
        if side == 'top':
            # No view from above: the top at (x, z) takes the colour along the top edge of the side
            # view on its side (left for z < 0), at the same x.
            for name, sign in (('left', -1), ('right', 1)):
                pic, a = pics[name], align[name]
                (su0, su1, sv0, sv1), _ = maps[name]
                su = -U if name == 'left' else U  # top u is x; the side view's u is -x or x
                half = (V < 0) if sign > 0 else (V >= 0)  # top v is -z
                px = a['subjectX'] + (su - su0) / (su1 - su0) * a['subjectWidth']
                top = edge_rows(pic)
                ci = np.clip(px.astype(int), 0, pic.shape[1] - 1)
                ri = np.clip(top[ci] - 3, 0, pic.shape[0] - 1)
                got = pic[ri, ci]
                ok = half & (top[ci] >= 0)
                tex[r0:r1, c0:c1][ok] = got[ok]
                mask[r0:r1, c0:c1][ok] = True
            fill_empty(tex, mask, (r0, c0, r1, c1))
            continue
        pic, a = pics[side], align[side]
        h = pic.shape[0]
        px = a['subjectX'] + (U - u0) / (u1 - u0) * a['subjectWidth']
        py_top = a['subjectY'] + (v1 - V) / (v1 - v0) * a['subjectHeight']  # from the picture's top
        ri = np.clip((h - 1 - py_top).astype(int), 0, h - 1)
        ci = np.clip(px.astype(int), 0, pic.shape[1] - 1)
        got = pic[ri, ci]
        ok = ~(got[..., :3] > BG).all(axis=-1) & (got[..., 3] > 0.5)
        tex[r0:r1, c0:c1][ok] = got[ok]
        mask[r0:r1, c0:c1][ok] = True
        fill_empty(tex, mask, (r0, c0, r1, c1))
    return tex


def edge_rows(pic):
    """For each column of a picture, the row (from the bottom) of its topmost subject pixel, or -1."""
    subject = ~(pic[..., :3] > BG).all(axis=-1) & (pic[..., 3] > 0.5)
    h = pic.shape[0]
    any_ = subject.any(axis=0)
    top = h - 1 - np.argmax(subject[::-1], axis=0)
    return np.where(any_, top, -1)


def image(name, pixels):
    img = bpy.data.images.new(name, SIZE, SIZE, alpha=False)
    img.pixels.foreach_set(pixels.ravel())
    img.file_format = 'PNG'
    img.pack()
    return img


def from_file(name, path):
    img = bpy.data.images.load(path)
    if tuple(img.size) != (SIZE, SIZE):
        img.scale(SIZE, SIZE)
    img.name = name
    img.pack()
    return img


def material(objects, img):
    mat = bpy.data.materials.new(img.name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value = 0.8
    bsdf.inputs['Metallic'].default_value = 0.0
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = img
    mat.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    for o in objects:
        o.data.materials.clear()
        o.data.materials.append(mat)


def save(pixels, path):
    img = bpy.data.images.new(os.path.basename(path), SIZE, SIZE, alpha=False)
    img.pixels.foreach_set(pixels.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def guide(pixels, objects, atlas, path):
    """The texture with every face's outline in white and each rect's border in black, saved as PNG;
    the rect names go in a .txt beside it (same name), as `side: u0 v0 u1 v1` in texture fractions."""
    g = pixels.copy()
    for o in objects:
        mesh = o.data
        uv = mesh.uv_layers.active.data
        for poly in mesh.polygons:
            li = list(poly.loop_indices)
            for a, b in zip(li, li[1:] + li[:1]):
                (u0, v0), (u1, v1) = uv[a].uv, uv[b].uv
                n = int(max(abs(u1 - u0), abs(v1 - v0)) * SIZE) + 2
                cs = np.clip((np.linspace(u0, u1, n) * SIZE).astype(int), 0, SIZE - 1)
                rs = np.clip((np.linspace(v0, v1, n) * SIZE).astype(int), 0, SIZE - 1)
                g[rs, cs, :3] = g[rs, cs, :3] * 0.4 + 0.6
    for side, (u0, v0, u1, v1) in atlas.items():
        c0, r0, c1, r1 = int(u0 * SIZE), int(v0 * SIZE), int(u1 * SIZE) - 1, int(v1 * SIZE) - 1
        g[r0, c0:c1, :3] = g[r1, c0:c1, :3] = 0
        g[r0:r1, c0, :3] = g[r0:r1, c1, :3] = 0
    save(g, path)
    with open(path[:-4] + '.txt', 'w') as f:
        f.write('Rects in this texture (fractions of 1024, from the bottom-left), and what each shows:\n')
        for side, r in atlas.items():
            f.write('%s: %s  (the model seen from its %s)\n' % (side, ' '.join('%.3f' % x for x in r), side))


def paint(objects, atlas, views_dir, align, name, out_dir, texture=None):
    """UVs, the first pass (or a painted texture, if given), the material; writes the first pass and
    the guide to out_dir as <name>-texture.png and <name>-guide.png."""
    maps = unwrap(objects, atlas)
    first = first_pass(maps, atlas, views_dir, align)
    os.makedirs(out_dir, exist_ok=True)
    save(first, os.path.join(out_dir, name + '-texture.png'))
    guide(first, objects, atlas, os.path.join(out_dir, name + '-guide.png'))
    img = from_file(name, texture) if texture else image(name, first)
    material(objects, img)
