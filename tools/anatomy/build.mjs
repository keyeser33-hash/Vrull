// Pipeline-i i modelit 3D (SPEC §11, TH-05): BodyParts3D 4.0 (OBJ 99%, pema IS-A) → GLB me një
// nyje për çdo çelës të Shtojcës D dhe lëkurën si siluetë. Latissimus dorsi dhe rectus abdominis
// mungojnë te 4.0 dhe merren nga 3.0 (parts.json, `_v3`). I përsëritshëm:
//   node tools/anatomy/build.mjs <dosja 4.0> <dosja 3.0> [dalja.glb]
// Burimet shkarkohen me dorë nga https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html:
// dosja 4.0 me isa_BP3D_4.0_obj_99.zip dhe isa_element_parts.txt; dosja 3.0 (data/bodyparts3d/20110915/)
// me BodyParts3D_3.0_obj_99.zip dhe parts_list_e.txt.
// Licenca e GLB-së: public/anatomy/LICENSE.txt (CC BY-SA 2.1 Japan, sepse përmban pjesë nga 3.0).
// Një pjesë, fqinj ose lëkurë që mungon e ndal build-in: GLB-ja nuk shkruhet gjysmë.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Document, NodeIO } from '@gltf-transform/core'
import { MeshoptSimplifier } from 'meshoptimizer'
import { cutOver, meanShift, weld } from './mesh.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const [source4, source3, outputArg] = process.argv.slice(2)
const output = outputArg ?? join(here, '..', '..', 'public', 'anatomy', 'body.glb')
if (!source4 || !source3) throw new Error('Përdorimi: node tools/anatomy/build.mjs <dosja 4.0> <dosja 3.0> [dalja.glb]')
const zip4 = join(source4, 'isa_BP3D_4.0_obj_99.zip')
const zip3 = join(source3, 'BodyParts3D_3.0_obj_99.zip')
// Kufiri i trekëndëshave për çdo muskul dhe për lëkurën.
const MAX_TRIANGLES = Number(process.env.MAX_TRIANGLES ?? 5000)
const SKIN_TRIANGLES = Number(process.env.SKIN_TRIANGLES ?? 12000)
const SIDES = ['right', 'left']

const { _: _note, _v3: fromV3, _cuts: cuts = [], ...parts } = JSON.parse(readFileSync(join(here, 'parts.json'), 'utf8'))
// 4.0: emri → skedarët FJ (një pjesë mund të ketë disa). 3.0: emri → skedari FMA.
const files4 = new Map()
for (const line of readFileSync(join(source4, 'isa_element_parts.txt'), 'utf8').split('\n').slice(1)) {
  const [, name, file] = line.trim().split('\t')
  if (name && file) files4.set(name, [...(files4.get(name) ?? []), file])
}
const files3 = new Map()
for (const line of readFileSync(join(source3, 'parts_list_e.txt'), 'utf8').split('\n').slice(1)) {
  const [id, name] = line.trim().split('\t')
  if (id && name) files3.set(name, id)
}
const entries4 = (name) => (files4.get(name) ?? []).map((file) => [zip4, `isa_BP3D_4.0_obj_99/${file}.obj`])
// Emrat brenda zip-it 3.0 kanë "\" si ndarës; "?" i unzip-it e kap pa e lexuar si escape.
const entries3 = (name) => (files3.has(name) ? [[zip3, `BodyParts3D_3.0_obj_99?${files3.get(name)}.obj`]] : [])

function required(entries, what) {
  if (entries.length === 0) throw new Error(`Mungon te burimi: ${what}`)
  return entries
}

/** Kulmet (mm, koordinatat e burimit: Z lart, Y mbrapa) dhe trekëndëshat e një OBJ-je. */
function readObj([zip, entry]) {
  const text = execFileSync('unzip', ['-p', zip, entry], { maxBuffer: 64 * 1024 * 1024 }).toString()
  const vertices = []
  const indices = []
  for (const line of text.split('\n')) {
    if (line.startsWith('v ')) {
      vertices.push(line.trim().split(/\s+/).slice(1, 4).map(Number))
    } else if (line.startsWith('f ')) {
      const corners = line.trim().split(/\s+/).slice(1).map((item) => Number(item.split('/')[0]) - 1)
      for (let index = 1; index + 1 < corners.length; index++) indices.push(corners[0], corners[index], corners[index + 1])
    }
  }
  return { vertices, indices }
}

function bounds(points) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const point of points) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis])
      max[axis] = Math.max(max[axis], point[axis])
    }
  }
  return { min, max }
}

/** Qendra e kutisë kufizuese të disa OBJ-ve, në mm. */
function center(entries) {
  const { min, max } = bounds(entries.flatMap((entry) => readObj(entry).vertices))
  return min.map((value, axis) => (value + max[axis]) / 2)
}

/** OBJ-të në një mesh të salduar: mm → m, Y lart, Z përpara (kamera shikon pjesën e përparme). */
function toMesh(objs, shift = [0, 0, 0]) {
  const positions = []
  const indices = []
  for (const { vertices, indices: faces } of objs) {
    const offset = positions.length / 3
    for (const [x, y, z] of vertices) positions.push((x + shift[0]) / 1000, (z + shift[2]) / 1000, -(y + shift[1]) / 1000)
    for (const index of faces) indices.push(index + offset)
  }
  return weld({ positions: new Float32Array(positions), indices: new Uint32Array(indices) })
}

function simplify(mesh, maxTriangles) {
  const target = Math.min(mesh.indices.length, maxTriangles * 3)
  const [indices] = MeshoptSimplifier.simplify(mesh.indices, mesh.positions, 3, target, 0.02, [])
  // Vetëm kulmet që përdoren mbeten.
  const remap = new Map()
  const positions = []
  const out = new Uint32Array(indices.length)
  indices.forEach((index, position) => {
    if (!remap.has(index)) {
      remap.set(index, positions.length / 3)
      positions.push(mesh.positions[index * 3], mesh.positions[index * 3 + 1], mesh.positions[index * 3 + 2])
    }
    out[position] = remap.get(index)
  })
  return { positions: new Float32Array(positions), indices: out }
}

await MeshoptSimplifier.ready
const meshes = {}
for (const [key, names] of Object.entries(parts)) {
  const found = SIDES.flatMap((side) => names.flatMap((name) => entries4(name.replace('{s}', side))))
  meshes[key] = toMesh(required(found, key).map(readObj))
}
// 3.0 dhe 4.0 ndajnë të njëjtin sistem koordinatash, por trungu te 4.0 është rimodeluar rreth 16 mm
// më poshtë. Çdo anë e një pjese nga 3.0 zhvendoset me mesataren e diferencës së fqinjëve të saj.
const shifts = {}
for (const [key, { parts: names, anchors }] of Object.entries(fromV3)) {
  const objs = SIDES.flatMap((side) => {
    const pairs = anchors.map((anchor) => {
      const name = anchor.replace('{s}', side)
      return [center(required(entries3(name), `${name} (3.0)`)), center(required(entries4(name), `${name} (4.0)`))]
    })
    const shift = meanShift(pairs)
    shifts[`${key}/${side}`] = shift.map((value) => Math.round(value * 10) / 10)
    const found = names.flatMap((name) => entries3(name.replace('{s}', side)))
    return required(found, `${key}/${side} (3.0)`).map((entry) => {
      const obj = readObj(entry)
      return { ...obj, vertices: obj.vertices.map((vertex) => vertex.map((value, axis) => value + shift[axis])) }
    })
  })
  meshes[key] = toMesh(objs)
}
for (const { part, over } of cuts) {
  if (!meshes[part] || !meshes[over]) throw new Error(`Prerja ${part}/${over}: pjesa mungon`)
  cutOver(meshes[part], meshes[over])
}
for (const key of Object.keys(meshes)) meshes[key] = simplify(meshes[key], MAX_TRIANGLES)
meshes.skin = simplify(toMesh(required(entries4('skin'), 'skin').map(readObj)), SKIN_TRIANGLES)

// Qendra e trupit (lëkura) në origjinë, këmbët në y = 0.
const skinPoints = []
for (let index = 0; index < meshes.skin.positions.length; index += 3) skinPoints.push(meshes.skin.positions.subarray(index, index + 3))
const { min, max } = bounds(skinPoints)
const shift = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2]

const doc = new Document()
const buffer = doc.createBuffer()
const scene = doc.createScene('Trupi')
const triangles = {}
let vertices = 0
for (const [key, mesh] of Object.entries(meshes)) {
  for (let index = 0; index < mesh.positions.length; index += 3) {
    for (let axis = 0; axis < 3; axis++) mesh.positions[index + axis] += shift[axis]
  }
  if (!mesh.positions.every(Number.isFinite)) throw new Error(`Pozicione të pavlefshme te ${key}`)
  vertices += mesh.positions.length / 3
  triangles[key] = mesh.indices.length / 3
  const position = doc.createAccessor(`${key}-position`).setType('VEC3').setArray(mesh.positions).setBuffer(buffer)
  const indices = doc
    .createAccessor(`${key}-indices`)
    .setType('SCALAR')
    .setArray(mesh.positions.length / 3 < 65536 ? new Uint16Array(mesh.indices) : mesh.indices)
    .setBuffer(buffer)
  const primitive = doc.createPrimitive().setAttribute('POSITION', position).setIndices(indices)
  scene.addChild(doc.createNode(key).setMesh(doc.createMesh(key).addPrimitive(primitive)))
}
await new NodeIO().write(output, doc)
const size = readFileSync(output).length
console.log(
  JSON.stringify({
    output,
    keys: Object.keys(meshes).length - 1,
    shifts,
    vertices,
    triangles: Object.values(triangles).reduce((sum, count) => sum + count, 0),
    heaviest: Object.entries(triangles)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4),
    megabytes: Math.round((size / 1048576) * 100) / 100,
    height: Math.round((max[1] - min[1]) * 1000) / 1000,
  }),
)
