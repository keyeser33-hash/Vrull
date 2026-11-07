import { usdaFromJson } from './usda'

const food = (fdcId: number, description: string, nutrients: [string, string, number][]) => ({
  fdcId,
  description,
  dataType: 'SR Legacy',
  foodNutrients: nutrients.map(([nutrientNumber, unitName, value]) => ({ nutrientNumber, unitName, value })),
})

describe('USDA', () => {
  it('ushqimet me makro për 100 g; energjia nga kcal, Atwater ose kJ', () => {
    const foods = usdaFromJson({
      foods: [
        food(171477, 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', [
          ['208', 'KCAL', 165],
          ['203', 'G', 31.02],
          ['204', 'G', 3.57],
          ['205', 'G', 0],
        ]),
        food(2346393, 'Rice, white, cooked', [
          ['957', 'KCAL', 130.5],
          ['203', 'G', 2.7],
          ['204', 'G', 0.3],
          ['205', 'G', 28.2],
          ['291', 'G', 0.4],
        ]),
        food(1, 'Oats', [
          ['268', 'kJ', 1550],
          ['203', 'G', 13],
          ['204', 'G', 7],
          ['205', 'G', 60],
        ]),
        food(2, 'Pa makro', [['208', 'KCAL', 10]]),
      ],
    })
    expect(foods.map((item) => [item.sourceId, item.name, item.kcal, item.proteinG, item.carbsG, item.fatG, item.fiberG])).toEqual([
      ['171477', 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', 165, 31.02, 0, 3.57, null],
      ['2346393', 'Rice, white, cooked', 130.5, 2.7, 28.2, 0.3, 0.4],
      ['1', 'Oats', 370.5, 13, 60, 7, null],
    ])
    expect(foods[0]).toMatchObject({ source: 'usda', brand: null, servingG: null, servingLabel: null })
    expect(usdaFromJson({})).toEqual([])
  })
})
