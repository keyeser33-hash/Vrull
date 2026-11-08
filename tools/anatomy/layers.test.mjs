// @vitest-environment node
import { readFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import * as THREE from 'three'
import { DEEP_MUSCLES } from '@/body/layers'

// Harta e shtresave (src/body/layers.ts) kundrejt modelit: nga ana e treguar, mbulesat ndalin një
// pjesë të madhe të rrezeve drejt kulmeve të muskulit të thellë, dhe pa to rrezet arrijnë te muskuli.
const FILE = new URL('../../public/anatomy/body.glb', import.meta.url)
const SAMPLES = 120

async function loadMuscles() {
  const document = await new NodeIO().readBinary(new Uint8Array(readFileSync(FILE)))
  const muscles = new Map()
  for (const node of document.getRoot().listNodes()) {
    const primitive = node.getMesh()?.listPrimitives()[0]
    if (!primitive || node.getName() === 'skin') continue
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(primitive.getAttribute('POSITION').getArray(), 3))
    geometry.setIndex(new THREE.BufferAttribute(primitive.getIndices().getArray(), 1))
    geometry.applyMatrix4(new THREE.Matrix4().fromArray(node.getWorldMatrix()))
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    mesh.name = node.getName()
    muscles.set(mesh.name, mesh)
  }
  return muscles
}

/** Sa nga kulmet e muskulit arrihen nga ana e dhënë pa prekur muskujt e tjerë (pa ata të `hidden`). */
function visible(muscles, key, side, hidden = []) {
  const target = muscles.get(key)
  const others = [...muscles.values()].filter((mesh) => mesh !== target && !hidden.includes(mesh.name))
  const positions = target.geometry.getAttribute('position')
  const step = Math.max(1, Math.floor(positions.count / SAMPLES))
  const z = side === 'front' ? 5 : -5
  const raycaster = new THREE.Raycaster()
  let seen = 0
  let total = 0
  for (let index = 0; index < positions.count; index += step) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, index)
    raycaster.set(new THREE.Vector3(vertex.x, vertex.y, z), new THREE.Vector3(0, 0, -Math.sign(z)))
    raycaster.far = Math.abs(z - vertex.z) - 0.002
    total++
    if (raycaster.intersectObjects(others, false).length === 0) seen++
  }
  return seen / total
}

describe('shtresat kundrejt modelit 3D', () => {
  it('mbulesat fshehin muskulin e thellë, dhe pa to ai duket', async () => {
    const muscles = await loadMuscles()
    for (const { key, side, covers } of DEEP_MUSCLES) {
      const before = visible(muscles, key, side)
      const after = visible(muscles, key, side, covers)
      // Mbulesat fshehin të paktën 30% të muskulit; pa to, të paktën 80% e tij duket.
      expect(after - before, `${key}: sa fshehin mbulesat (${before.toFixed(2)} -> ${after.toFixed(2)})`).toBeGreaterThanOrEqual(0.3)
      expect(after, `${key} pa mbulesat`).toBeGreaterThanOrEqual(0.8)
    }
  })
})
