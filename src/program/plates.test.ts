import { BAR_KG, platesPerSide } from './plates'

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
