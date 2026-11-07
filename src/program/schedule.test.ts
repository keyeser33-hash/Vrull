import { firstWeek } from './schedule'

describe('java e parë sipas ditëve të zgjedhura', () => {
  it('stërvitjet me radhë në ditët e javës, nga e hëna', () => {
    expect(firstWeek([5, 1, 4, 2], 4)).toEqual([
      { day: 1, workout: 1 },
      { day: 2, workout: 2 },
      { day: 4, workout: 3 },
      { day: 5, workout: 4 },
    ])
  })

  it('me më shumë ditë se stërvitje, radha vazhdon nga e para', () => {
    expect(firstWeek([1, 2, 3, 4, 5], 4).map((entry) => entry.workout)).toEqual([1, 2, 3, 4, 1])
  })

  it('me më pak ditë, java mbyllet para stërvitjes së fundit', () => {
    expect(firstWeek([2, 6], 4)).toEqual([
      { day: 2, workout: 1 },
      { day: 6, workout: 2 },
    ])
  })
})
