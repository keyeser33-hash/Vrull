import { BAR_KG, BAR_OPTIONS, isBarKg, platesPerSide } from './plates'

// Disqet për anë te tastiera e peshës (bordi "Seanca · tastiera"): shufra 20 kg dhe disqet e zakonshme
// të palestrës; "62,5 = 20 + 2 × 21,25", "Për anë: 20 + 1,25".

describe('disqet për anë', () => {
  it('62,5 kg me shufrën 20 kg: 21,25 për anë, 20 + 1,25', () => {
    expect(BAR_KG).toBe(20)
    expect(platesPerSide(62.5)).toEqual({ barKg: 20, perSideKg: 21.25, plates: [20, 1.25] })
  })

  it('disqet më të mëdha së pari', () => {
    expect(platesPerSide(100)).toEqual({ barKg: 20, perSideKg: 40, plates: [25, 15] })
    expect(platesPerSide(142.5)).toEqual({ barKg: 20, perSideKg: 61.25, plates: [25, 25, 10, 1.25] })
  })

  it('vetëm shufra: asnjë disk', () => {
    expect(platesPerSide(20)).toEqual({ barKg: 20, perSideKg: 0, plates: [] })
  })

  it('nën shufrën ose një peshë që disqet nuk e bëjnë: asgjë', () => {
    expect(platesPerSide(15)).toBeNull()
    expect(platesPerSide(61)).toBeNull()
    expect(platesPerSide(0)).toBeNull()
    expect(platesPerSide(Number.NaN)).toBeNull()
  })

  it('një shufër tjetër', () => {
    expect(platesPerSide(30, 10)).toEqual({ barKg: 10, perSideKg: 10, plates: [10] })
  })
})

describe('zgjedhja e shufrës', () => {
  it('20, 15, 10 kg ose pa shufër', () => {
    expect(BAR_OPTIONS).toEqual([20, 15, 10, 0])
    expect(isBarKg(15)).toBe(true)
    expect(isBarKg(0)).toBe(true)
    expect(isBarKg(12)).toBe(false)
    expect(isBarKg('20')).toBe(false)
  })

  it('62,5 kg me shufrën 15 kg: 23,75 për anë, 20 + 2,5 + 1,25', () => {
    expect(platesPerSide(62.5, 15)).toEqual({ barKg: 15, perSideKg: 23.75, plates: [20, 2.5, 1.25] })
  })

  it('62,5 kg me shufrën 10 kg: 26,25 për anë, 25 + 1,25', () => {
    expect(platesPerSide(62.5, 10)).toEqual({ barKg: 10, perSideKg: 26.25, plates: [25, 1.25] })
  })

  it('pa shufër: gjysma e peshës për anë; 15 kg nuk është më nën shufrën', () => {
    expect(platesPerSide(60, 0)).toEqual({ barKg: 0, perSideKg: 30, plates: [25, 5] })
    expect(platesPerSide(15, 20)).toBeNull()
    expect(platesPerSide(15, 0)).toEqual({ barKg: 0, perSideKg: 7.5, plates: [5, 2.5] })
  })

  it('një peshë që disqet nuk e bëjnë mbetet pa ndarje, edhe me shufër tjetër', () => {
    expect(platesPerSide(61, 15)).toBeNull()
  })
})
