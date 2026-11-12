// Reading a .glb in tests without a GPU or a DOM: its JSON and binary chunks, node names, triangle
// count, bounds and embedded image sizes.
import fs from 'node:fs';

/** The two chunks of a .glb: the parsed JSON and the binary buffer. */
export function readGlb(path) {
  const b = fs.readFileSync(path);
  let off = 12;
  const chunks = [];
  while (off < b.length) {
    const len = b.readUInt32LE(off);
    chunks.push(b.subarray(off + 8, off + 8 + len));
    off += 8 + len;
  }
  return { json: JSON.parse(chunks[0].toString('utf8')), bin: chunks[1] };
}

export const nodeNames = (json) => (json.nodes || []).map((n) => n.name);

/** Triangles across every mesh primitive (indices / 3, or positions / 3 without indices). */
export function triangles(json) {
  let n = 0;
  for (const m of json.meshes || []) {
    for (const p of m.primitives) {
      const a = json.accessors[p.indices !== undefined ? p.indices : p.attributes.POSITION];
      n += a.count / 3;
    }
  }
  return n;
}

/** Bounds of the top-level mesh nodes: their POSITION min/max moved by their translation. */
export function bounds(json) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const roots = json.scenes[json.scene || 0].nodes;
  for (const i of roots) {
    const node = json.nodes[i];
    if (node.mesh === undefined) continue;
    const t = node.translation || [0, 0, 0];
    for (const p of json.meshes[node.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], a.min[k] + t[k]);
        max[k] = Math.max(max[k], a.max[k] + t[k]);
      }
    }
  }
  return { min, max };
}

/** Width and height of embedded image i, from its PNG header or JPEG frame marker. */
export function imageSize(json, bin, i) {
  const img = json.images[i];
  const view = json.bufferViews[img.bufferView];
  const d = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  if (d[0] === 0x89 && d[1] === 0x50) return { width: d.readUInt32BE(16), height: d.readUInt32BE(20), mime: 'image/png' };
  let o = 2;
  while (o < d.length) {
    const marker = d[o + 1];
    const len = d.readUInt16BE(o + 2);
    if (marker === 0xc0 || marker === 0xc2) return { width: d.readUInt16BE(o + 7), height: d.readUInt16BE(o + 5), mime: 'image/jpeg' };
    o += 2 + len;
  }
  return null;
}

/** The numbers of float accessor i, as [[a, b, ...], ...] (one entry per element). */
export function floats(json, bin, i) {
  const a = json.accessors[i];
  const view = json.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const stride = view.byteStride || size * 4;
  const start = (view.byteOffset || 0) + (a.byteOffset || 0);
  const out = [];
  for (let n = 0; n < a.count; n++) {
    const e = [];
    for (let k = 0; k < size; k++) e.push(bin.readFloatLE(start + n * stride + k * 4));
    out.push(e);
  }
  return out;
}
