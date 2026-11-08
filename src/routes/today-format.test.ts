import { i18nFor } from '@/i18n'
import { MUSCLE_GROUPS } from '@/program/muscles'
import type { Target } from '@/program/types'
import { programDayName, programLabel, repsText, targetLine } from './today-format'

const sq = i18nFor('sq')
const en = i18nFor('en')
const reps = (min: number, max: number | null, beyond = false): Target => ({ kind: 'reps', min, max, beyond })
const exercise = (target: Target, weightKg: number | null, tracking: 'weight_reps' | 'bodyweight_reps' | 'timed' = 'weight_reps') => ({
  name: 'Bench Press',
  tracking,
  target,
  weightKg,
})

describe('emrat e programit te Sot', () => {
  it('blloku dhe java: "Faza 1 · Java 2" / "Phase 1 · Week 2"; Java 0 pa javë', () => {
    expect(programLabel(sq.t, { blockName: 'Faza 1', blockWeeks: 4, week: 2 })).toBe('Faza 1 · Java 2')
    expect(programLabel(en.t, { blockName: 'Faza 1', blockWeeks: 4, week: 2 })).toBe('Phase 1 · Week 2')
    expect(programLabel(en.t, { blockName: 'Java 0', blockWeeks: 1, week: 1 })).toBe('Week 0')
    // Blloqet e programeve të tua mbeten si i shkroi përdoruesi.
    expect(programLabel(en.t, { blockName: 'Hipertrofi', blockWeeks: 3, week: 1 })).toBe('Hipertrofi · Week 1')
  })

  it('ditët e Shortcut to Size në anglisht; ditët e tua mbeten', () => {
    expect(programDayName(sq.t, 'Gjoks, triceps, pulpa')).toBe('Gjoks, triceps, pulpa')
    expect(programDayName(en.t, 'Gjoks, triceps, pulpa')).toBe('Chest, triceps, calves')
    expect(programDayName(en.t, 'Shpinë, biceps, bark')).toBe('Back, biceps, abs')
    expect(programDayName(en.t, 'Shpatulla, trapez, pulpa')).toBe('Shoulders, traps, calves')
    expect(programDayName(en.t, 'Këmbë, bark')).toBe('Legs, abs')
    expect(programDayName(en.t, 'Sipër A')).toBe('Sipër A')
  })

  it('çdo grup muskujsh ka titullin e ditës dhe emrin në të dyja gjuhët', () => {
    for (const group of MUSCLE_GROUPS) {
      // Shqip, emri i grupit është ai i Trupit.
      expect(sq.t(`today.group.${group.id}` as 'today.group.gjoksi')).toBe(group.name)
      for (const key of [`today.dayOf.${group.id}`, `today.group.${group.id}`]) {
        expect(sq.t(key as 'today.dayOf.gjoksi'), key).not.toBe(key)
        expect(en.t(key as 'today.dayOf.gjoksi'), key).not.toBe(sq.t(key as 'today.dayOf.gjoksi'))
      }
    }
  })
})

describe('rreshti i ushtrimit të parë', () => {
  it('intervali i përsëritjeve pa u ndarë në dy rreshta', () => {
    expect(repsText(reps(9, 11))).toBe('9–\u206011')
    expect(repsText(reps(12, null))).toBe('12+')
    expect(repsText({ kind: 'percent_1rm', percent: 85, reps: 5, amrap: true })).toBe('5+')
    expect(repsText({ kind: 'timed', seconds: 60 })).toBe('')
  })

  it('me peshën e javës: "Bench Press: synim 62,5 × 9–11." / "target 62.5 × 9–11."', () => {
    expect(targetLine(sq, exercise(reps(9, 11), 62.5))).toBe('Bench Press: synim 62,5\u00A0×\u00A09–\u206011.')
    expect(targetLine(en, exercise(reps(9, 11), 62.5))).toBe('Bench Press: target 62.5\u00A0×\u00A09–\u206011.')
  })

  it('pa peshë (para setit të parë): zgjidh peshën ku mbyll intervalin (§7)', () => {
    expect(targetLine(sq, exercise(reps(12, 15), null))).toBe('Bench Press: zgjidh peshën ku mbyll 12–\u206015.')
    expect(targetLine(en, exercise(reps(12, 15), null))).toBe('Bench Press: pick a weight you can lift for 12–\u206015.')
  })

  it('pesha e trupit, koha dhe përqindja e 1RM-së pa 1RM', () => {
    expect(targetLine(sq, exercise(reps(20, 30, true), null, 'bodyweight_reps'))).toBe('Bench Press: synim 20–\u206030 përsëritje.')
    expect(targetLine(sq, exercise({ kind: 'timed', seconds: 60 }, null, 'timed'))).toBe('Bench Press: synim 60\u00A0s.')
    expect(targetLine(en, exercise({ kind: 'percent_1rm', percent: 85, reps: 5, amrap: false }, null))).toBe('Bench Press: 5 reps at 85% of 1RM.')
    expect(targetLine(sq, exercise({ kind: 'percent_1rm', percent: 85, reps: 5, amrap: false }, 80))).toBe('Bench Press: synim 80\u00A0×\u00A05.')
  })
})
