import { daySummary, rowChange } from './week-review'

// "Peshat e javës" (bordi "Sugjerimi"): çdo rresht rritet, ulet, mbetet njësoj ose s'ka sugjerim;
// dita e thotë me numra ("4 rriten · 3 njësoj · 2 pa sugjerim").

const row = (previousKg: number | null, weightKg: number | null) => ({ previousKg, weightKg })

describe('ndryshimi i peshës së javës', () => {
  it('kundrejt peshës së fundit të përdorur', () => {
    expect(rowChange(row(62.5, 67.5))).toBe('up')
    expect(rowChange(row(30, 30))).toBe('same')
    expect(rowChange(row(30, 27.5))).toBe('down')
    expect(rowChange(row(null, 40))).toBe('new')
    expect(rowChange(row(70, null))).toBe('none')
    expect(rowChange(row(null, null))).toBe('none')
    // Pa gabimet e numrave dhjetorë.
    expect(rowChange(row(0.1 + 0.2, 0.3))).toBe('same')
  })

  it('përmbledhja e ditës', () => {
    expect(daySummary([row(62.5, 67.5), row(50, 55), row(30, 30), row(null, 12), row(70, null), row(30, 25)])).toEqual({
      up: 2,
      down: 1,
      same: 1,
      new: 1,
      none: 1,
    })
  })
})
