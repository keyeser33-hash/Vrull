import { fitWithin } from './image'

describe('madhësia e fotos së kompresuar', () => {
  it('ana më e gjatë deri në 1600 px, me të njëjtin raport', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(1601, 1, 1600)).toEqual({ width: 1600, height: 1 })
  })
})
