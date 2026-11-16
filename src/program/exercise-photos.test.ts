// @vitest-environment node
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import bundled from './exercise-photos.json'

// Çdo ID e paketuar ka të dyja fotot e lëvizjes (V58): fillimi `<id>.jpg` dhe fundi `<id>-end.jpg`.
const dir = fileURLToPath(new URL('../../public/exercise-photos/', import.meta.url))

describe('fotot e paketuara', () => {
  it('çdo ushtrim ka foton e fillimit dhe të fundit', () => {
    const missing = bundled.ids.flatMap((id) => [`${id}.jpg`, `${id}-end.jpg`]).filter((file) => !existsSync(dir + file))
    expect(missing).toEqual([])
  })
})
