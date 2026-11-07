// @vitest-environment node
import { readFileSync, statSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { MUSCLE_GROUPS } from '@/program/muscles'

// GLB-ja e Trupit (public/anatomy/body.glb, nga build.mjs): një nyje për çdo çelës të grupeve të
// muskujve plus lëkura, pozicione të vlefshme, brenda objektivit të SPEC §11.
const FILE = new URL('../../public/anatomy/body.glb', import.meta.url)

describe('modeli 3D i trupit', () => {
  it('ka saktë çelësat e muskujve dhe lëkurën, me pozicione të vlefshme dhe kufirin e trekëndëshave', async () => {
    const document = await new NodeIO().readBinary(new Uint8Array(readFileSync(FILE)))
    const meshes = new Map(document.getRoot().listNodes().map((node) => [node.getName(), node.getMesh()?.listPrimitives()[0]]))
    const keys = MUSCLE_GROUPS.flatMap((group) => group.keys)
    expect([...meshes.keys()].sort()).toEqual([...keys, 'skin'].sort())
    for (const [name, primitive] of meshes) {
      const positions = primitive?.getAttribute('POSITION')?.getArray()
      expect(positions && positions.length > 0 && Array.from(positions).every(Number.isFinite), name).toBe(true)
      if (name !== 'skin') expect(primitive.getIndices().getCount() / 3, name).toBeLessThanOrEqual(5000)
    }
  })

  it('mbetet nën 5 MB dhe ka licencën pranë', () => {
    expect(statSync(FILE).size).toBeLessThanOrEqual(5 * 1024 * 1024)
    expect(readFileSync(new URL('../../public/anatomy/LICENSE.txt', import.meta.url), 'utf8')).toContain('CC BY-SA 2.1')
  })
})
