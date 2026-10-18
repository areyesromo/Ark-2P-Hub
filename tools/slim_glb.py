# slim_glb.py: make a .glb lighter for the TV (the hub plays on a Raspberry Pi).
#   python3 tools/slim_glb.py IN OUT [--drop PREFIX,...] [--no-images] [--tex PX]
# --drop       leave out nodes whose name starts with one of these (e.g. parts never seen)
# --no-images  leave out embedded images (textured materials turn plain white)
# --tex PX     shrink embedded images to at most PX wide, saved as JPEG (needs Pillow)
# Example (the board tile: its underside is never seen, its face comes from tiles/*.webp):
#   python3 tools/slim_glb.py tile.glb public/games/party-board/models/tile.glb \
#     --drop back_,copper_pipe,gear_hub,hub_cap --no-images
import argparse, io, json, struct

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dst')
ap.add_argument('--drop', default='')
ap.add_argument('--no-images', action='store_true')
ap.add_argument('--tex', type=int, default=0)
args = ap.parse_args()

b = open(args.src, 'rb').read()
off = 12; ch = []
while off < len(b):
    l, t = struct.unpack('<I4s', b[off:off + 8]); ch.append(b[off + 8:off + 8 + l]); off += 8 + l
j = json.loads(ch[0]); binc = ch[1]
drop = tuple(p for p in args.drop.split(',') if p)
keep = [i for i, n in enumerate(j['nodes']) if not (drop and n.get('name', '').startswith(drop))]
out = {'asset': {'version': '2.0', 'generator': 'ark slim_glb (from ' + j['asset'].get('generator', '?') + ')'},
       'scene': 0, 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [], 'materials': []}
data = bytearray()

def add_view(chunk):
    while len(data) % 4: data.append(0)
    out['bufferViews'].append({'buffer': 0, 'byteOffset': len(data), 'byteLength': len(chunk)})
    data.extend(chunk)
    return len(out['bufferViews']) - 1

acc_map = {}
def copy_acc(ai):
    if ai in acc_map: return acc_map[ai]
    a = dict(j['accessors'][ai]); bv = j['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    comp = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a['componentType']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    assert bv.get('byteStride', comp * n) == comp * n, 'interleaved data not handled'
    a['bufferView'] = add_view(binc[start:start + a['count'] * comp * n]); a.pop('byteOffset', None)
    out['accessors'].append(a); acc_map[ai] = len(out['accessors']) - 1
    return acc_map[ai]

mesh_map = {}
for ni in keep:
    n = dict(j['nodes'][ni]); n.pop('children', None)
    if 'mesh' in n:
        mi = n['mesh']
        if mi not in mesh_map:
            m = j['meshes'][mi]; prims = []
            for p in m['primitives']:
                q = dict(p); q['attributes'] = {k: copy_acc(v) for k, v in p['attributes'].items()}
                if 'indices' in p: q['indices'] = copy_acc(p['indices'])
                prims.append(q)
            out['meshes'].append({'name': m.get('name'), 'primitives': prims}); mesh_map[mi] = len(out['meshes']) - 1
        n['mesh'] = mesh_map[mi]
    out['nodes'].append(n)

keep_images = not args.no_images and j.get('images')
for m in j.get('materials', []):
    m = json.loads(json.dumps(m)); pbr = m.get('pbrMetallicRoughness', {})
    if not keep_images and 'baseColorTexture' in pbr:
        pbr.pop('baseColorTexture'); pbr['baseColorFactor'] = [1, 1, 1, 1]
    out['materials'].append(m)
if keep_images:
    out['textures'] = j['textures']
    if 'samplers' in j: out['samplers'] = j['samplers']
    out['images'] = []
    for im in j['images']:
        bv = j['bufferViews'][im['bufferView']]
        raw = binc[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        mime = im.get('mimeType', 'image/png')
        if args.tex:
            from PIL import Image
            pic = Image.open(io.BytesIO(raw)).convert('RGB')
            if pic.width > args.tex: pic = pic.resize((args.tex, round(pic.height * args.tex / pic.width)), Image.LANCZOS)
            buf = io.BytesIO(); pic.save(buf, 'JPEG', quality=85); raw = buf.getvalue(); mime = 'image/jpeg'
        out['images'].append({'bufferView': add_view(raw), 'mimeType': mime})

out['scenes'] = [{'nodes': list(range(len(out['nodes'])))}]
while len(data) % 4: data.append(0)
out['buffers'] = [{'byteLength': len(data)}]
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(data), b'BIN\0') + bytes(data)
open(args.dst, 'wb').write(glb)
print(args.dst, 'nodes', len(out['nodes']), 'bytes', len(glb))
