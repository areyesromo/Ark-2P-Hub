// simplify_glb.mjs: shrink an untextured .glb for the TV: merge its parts per material, then
// simplify (three.js SimplifyModifier) to a share of its vertices, and write one mesh per material.
//   node tools/simplify_glb.mjs IN OUT [KEEP=0.12]
// For dense sculpted models (e.g. the board figures, ~96k triangles each). Textures aren't kept.
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';

const [src, dst, keepArg] = process.argv.slice(2);
const keep = Number(keepArg || 0.12);
const buf = fs.readFileSync(src);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), '', res, rej));
gltf.scene.updateMatrixWorld(true);

const groups = new Map();
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
  for (const k of Object.keys(g.attributes)) if (k !== 'position') g.deleteAttribute(k);
  if (!g.index) g.setIndex([...Array(g.attributes.position.count).keys()]);
  if (!groups.has(o.material)) groups.set(o.material, []);
  groups.get(o.material).push(g);
});

const parts = [];
let before = 0;
let after = 0;
for (const [mat, list] of groups) {
  let g = mergeVertices(mergeGeometries(list), 1e-5);
  before += g.index.count / 3;
  const remove = Math.floor(g.attributes.position.count * (1 - keep));
  if (remove > 0) g = new SimplifyModifier().modify(g, remove);
  if (!g.index) g = mergeVertices(g, 1e-5);
  g.computeVertexNormals();
  after += g.index.count / 3;
  parts.push({ mat, g });
}

// A minimal glTF 2.0 binary: one node + mesh per material; positions, normals, 32-bit indices.
const json = { asset: { version: '2.0', generator: 'ark simplify_glb' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
const chunks = [];
let offset = 0;
function view(arr, target) {
  const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  json.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
  chunks.push(bytes);
  offset += bytes.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); offset += pad; }
  return json.bufferViews.length - 1;
}
for (const { mat, g } of parts) {
  const pos = new Float32Array(g.attributes.position.array);
  const nor = new Float32Array(g.attributes.normal.array);
  const idx = new Uint32Array(g.index.array);
  g.computeBoundingBox();
  const a = json.accessors.length;
  json.accessors.push({ bufferView: view(pos, 34962), componentType: 5126, count: pos.length / 3, type: 'VEC3', min: g.boundingBox.min.toArray(), max: g.boundingBox.max.toArray() });
  json.accessors.push({ bufferView: view(nor, 34962), componentType: 5126, count: nor.length / 3, type: 'VEC3' });
  json.accessors.push({ bufferView: view(idx, 34963), componentType: 5125, count: idx.length, type: 'SCALAR' });
  json.materials.push({ name: mat.name, pbrMetallicRoughness: { baseColorFactor: [...mat.color.toArray(), 1], metallicFactor: mat.metalness, roughnessFactor: mat.roughness } });
  json.meshes.push({ name: mat.name, primitives: [{ attributes: { POSITION: a, NORMAL: a + 1 }, indices: a + 2, material: json.materials.length - 1 }] });
  json.nodes.push({ name: mat.name, mesh: json.meshes.length - 1 });
  json.scenes[0].nodes.push(json.nodes.length - 1);
}
json.buffers.push({ byteLength: offset });
let js = Buffer.from(JSON.stringify(json));
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const bin = Buffer.concat(chunks);
const head = Buffer.alloc(12);
head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.write('JSON', 4);
const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write('BIN\0', 4);
fs.writeFileSync(dst, Buffer.concat([head, jh, js, bh, bin]));
console.log(`${dst}: ${Math.round(before)} -> ${Math.round(after)} triangles, ${parts.length} materials, ${12 + 16 + js.length + bin.length} bytes`);
