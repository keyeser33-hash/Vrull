// Hapat pa I/O të pipeline-it të modelit 3D (build.mjs), me prova te mesh.test.mjs.
// Një mesh: { positions: Float32Array (x, y, z në metra; Y lart, Z përpara), indices: Uint32Array }.

/**
 * Bashkon kulmet me pozicion të njëjtë dhe heq trekëndëshat pa sipërfaqe. OBJ-të e BodyParts3D
 * përsërisin kulmet; pa këtë, skajet "e hapura" mbeten dhe meshoptimizer nuk thjeshton dot nën to.
 */
export function weld(mesh) {
  const ids = new Map()
  const positions = []
  const remap = new Uint32Array(mesh.positions.length / 3)
  for (let vertex = 0; vertex < remap.length; vertex++) {
    const [x, y, z] = mesh.positions.subarray(vertex * 3, vertex * 3 + 3)
    const key = `${x},${y},${z}`
    let id = ids.get(key)
    if (id === undefined) {
      id = positions.length / 3
      ids.set(key, id)
      positions.push(x, y, z)
    }
    remap[vertex] = id
  }
  const indices = []
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const [a, b, c] = [0, 1, 2].map((corner) => remap[mesh.indices[index + corner]])
    if (a !== b && b !== c && a !== c) indices.push(a, b, c)
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices) }
}

/**
 * Aponeuroza e external oblique mbulon rectus abdominis nga përpara, si në anatomi, por kështu
 * barku nuk duket dhe rectus nuk theksohet dot veç. Heq trekëndëshat e `mesh` që bien përpara
 * `cover`, brenda gjerësisë së saj në çdo lartësi (brez 1 cm) dhe në të njëjtën anë.
 */
export function cutOver(mesh, cover) {
  const BAND = 0.01
  const MARGIN = 0.004
  const bands = new Map()
  const bandOf = (x, y) => `${Math.round(y / BAND)}${x < 0 ? '-' : '+'}`
  for (let index = 0; index < cover.positions.length; index += 3) {
    const [x, y, z] = cover.positions.subarray(index, index + 3)
    const band = bands.get(bandOf(x, y)) ?? { width: 0, back: Infinity }
    bands.set(bandOf(x, y), { width: Math.max(band.width, Math.abs(x)), back: Math.min(band.back, z) })
  }
  const kept = []
  for (let index = 0; index < mesh.indices.length; index += 3) {
    const corners = [mesh.indices[index], mesh.indices[index + 1], mesh.indices[index + 2]]
    const [x, y, z] = [0, 1, 2].map((axis) => corners.reduce((sum, corner) => sum + mesh.positions[corner * 3 + axis], 0) / 3)
    const band = bands.get(bandOf(x, y))
    const covered = band !== undefined && Math.abs(x) < band.width - MARGIN && z > band.back
    if (!covered) kept.push(...corners)
  }
  mesh.indices = new Uint32Array(kept)
}

/**
 * Zhvendosja e një pjese nga 3.0 te 4.0: mesatarja e diferencës (qendra 4.0 − qendra 3.0) të
 * fqinjëve që ekzistojnë te të dyja. `pairs`: [[qendra 3.0, qendra 4.0], ...] në mm.
 */
export function meanShift(pairs) {
  if (pairs.length === 0) throw new Error('Zhvendosja kërkon të paktën një fqinj')
  const shift = [0, 1, 2].map((axis) => pairs.reduce((sum, [from, to]) => sum + to[axis] - from[axis], 0) / pairs.length)
  if (!shift.every(Number.isFinite)) throw new Error(`Zhvendosje e pavlefshme: ${shift.join(', ')}`)
  return shift
}
