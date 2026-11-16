import { describe, expect, it } from 'vitest'
import { guideFor } from './exercise-guide-data'

describe('guideFor', () => {
  it('gjen udhëzuesin sipas emrit ose ID-së së bibliotekës', () => {
    const byName = guideFor({ libraryId: null, name: 'Bench Press' })
    expect(byName?.exercise).toBe('Bench Press')
    expect(guideFor({ libraryId: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press - Medium Grip' })).toBe(byName)
  })
  it('ushtrimi pa udhëzues kthen null (p.sh. 13 të Shortcut to Size)', () => {
    expect(guideFor({ libraryId: null, name: 'Hip Thrust' })).toBeNull()
    expect(guideFor({ libraryId: 'Arnold_Dumbbell_Press', name: 'Arnold Dumbbell Press' })).toBeNull()
  })
})
