// @vitest-environment node
import { cutOver, meanShift, weld } from './mesh.mjs'

const mesh = (positions, indices) => ({ positions: new Float32Array(positions), indices: new Uint32Array(indices) })

describe('pipeline-i i modelit 3D', () => {
  it('weld bashkon kulmet me të njëjtin pozicion, që thjeshtimi të mos ndalet te skajet e hapura', () => {
    // Dy trekëndësha që ndajnë një brinjë, por me kulme të dyfishta (si te OBJ-të e BodyParts3D).
    const welded = weld(mesh([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], [0, 1, 2, 3, 5, 4]))
    expect(welded.positions.length / 3).toBe(4)
    expect([...welded.indices]).toEqual([0, 1, 2, 1, 3, 2])
  })

  it('weld heq trekëndëshat që mbeten pa sipërfaqe', () => {
    const welded = weld(mesh([0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0], [0, 1, 2, 0, 1, 3]))
    expect([...welded.indices]).toEqual([0, 1, 2])
  })

  it('cutOver heq vetëm trekëndëshat përpara mbulesës, brenda gjerësisë së saj në atë lartësi dhe anë', () => {
    // Mbulesa: djathtas (x < 0) deri në 8 cm nga mesi, në lartësi 1,00 m.
    const cover = mesh([-0.08, 1, 0.1, -0.01, 1, 0.1, -0.05, 1.005, 0.1], [0, 1, 2])
    const triangle = (x, y) => [x, y, 0.12, x + 0.002, y, 0.12, x, y + 0.002, 0.12]
    const behind = [-0.04, 1, 0, -0.038, 1, 0, -0.04, 1.002, 0]
    const part = mesh(
      [...triangle(-0.04, 1), ...triangle(-0.12, 1), ...triangle(0.04, 1), ...triangle(-0.04, 1.3), ...behind],
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    )
    cutOver(part, cover)
    // Mbetet: jashtë gjerësisë (x −0,12), ana tjetër (x +0,04), një lartësi pa mbulesë (1,30 m) dhe pas mbulesës.
    expect([...part.indices]).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
  })

  it('meanShift: mesatarja e diferencës 4.0 − 3.0 të fqinjëve; pa fqinjë ose me qendër të pavlefshme dështon', () => {
    expect(
      meanShift([
        [
          [0, 0, 10],
          [2, -4, -6],
        ],
        [
          [1, 1, 1],
          [1, -1, -17],
        ],
      ]),
    ).toEqual([1, -3, -17])
    expect(() => meanShift([])).toThrow()
    expect(() =>
      meanShift([
        [
          [Number.NaN, 0, 0],
          [0, 0, 0],
        ],
      ]),
    ).toThrow()
  })
})
