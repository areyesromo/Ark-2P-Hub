# slim_glb.py IN OUT: make a board-tile .glb lighter for the TV: keep the parts seen from above,
# drop the underside (nodes named back_*, copper_pipe, gear_hub, hub_cap) and embedded images
# (the faces come from public/games/party-board/tiles/). Usage: python3 tools/slim_glb.py in.glb out.glb
import json, struct, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src, 'rb').read()
off = 12; ch = []
while off < len(b):
    l, t = struct.unpack('<I4s', b[off:off + 8]); ch.append(b[off + 8:off + 8 + l]); off += 8 + l
j = json.loads(ch[0]); binc = ch[1]
DROP = ('back_', 'copper_pipe', 'gear_hub', 'hub_cap')
keep = [i for i, n in enumerate(j['nodes']) if not n.get('name', '').startswith(DROP)]
out = {'asset': {'version': '2.0', 'generator': 'ark slim_glb (from ' + j['asset'].get('generator', '?') + ')'},
       'scene': 0, 'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [], 'buffers': [], 'materials': []}
data = bytearray()
acc_map = {}
def copy_acc(ai):
    if ai in acc_map: return acc_map[ai]
    a = dict(j['accessors'][ai]); bv = j['bufferViews'][a['bufferView']]
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    comp = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[a['componentType']]
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[a['type']]
    stride = bv.get('byteStride', comp * n)
    assert stride == comp * n, 'interleaved data not handled'
    chunk = binc[start:start + a['count'] * comp * n]
    while len(data) % 4: data.append(0)
    out['bufferViews'].append({'buffer': 0, 'byteOffset': len(data), 'byteLength': len(chunk)})
    data.extend(chunk)
    a['bufferView'] = len(out['bufferViews']) - 1; a.pop('byteOffset', None)
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
for m in j['materials']:
    m = json.loads(json.dumps(m)); pbr = m.get('pbrMetallicRoughness', {})
    if 'baseColorTexture' in pbr: pbr.pop('baseColorTexture'); pbr['baseColorFactor'] = [1, 1, 1, 1]
    out['materials'].append(m)
out['scenes'] = [{'nodes': list(range(len(out['nodes'])))}]
while len(data) % 4: data.append(0)
out['buffers'] = [{'byteLength': len(data)}]
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(data)) + struct.pack('<I4s', len(js), b'JSON') + js + struct.pack('<I4s', len(data), b'BIN\0') + bytes(data)
open(dst, 'wb').write(glb)
print('nodes', len(out['nodes']), 'meshes', len(out['meshes']), 'bytes', len(glb))
