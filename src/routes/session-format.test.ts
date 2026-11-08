import { i18nFor } from '@/i18n'
import type { SetRecord } from '@/data/training'
import { elapsedText, loadText, rangeText, setValue, setsDetail, spokenDuration, targetText } from './session-format'

const sq = i18nFor('sq')
const en = i18nFor('en')

const set = (values: Partial<SetRecord>): SetRecord => ({
  id: crypto.randomUUID(),
  slotId: 's',
  exerciseId: 'bench',
  setNumber: 1,
  weightKg: 62.5,
  reps: 12,
  seconds: null,
  rir: null,
  rpe: null,
  technique: 'none',
  segments: [],
  loggedAt: '2026-11-08T17:00:00.000Z',
  notes: null,
  ...values,
})

const reps = (min: number, max: number | null, beyond = false) => ({ kind: 'reps' as const, min, max, beyond })

describe('tekstet e seancës në dy gjuhët', () => {
  it('intervali dhe receta e setit', () => {
    expect(rangeText(reps(9, 11), sq.fmt)).toBe('9–11')
    expect(rangeText(reps(20, null), sq.fmt)).toBe('20+')
    expect(targetText(reps(9, 11), sq)).toBe('9–11 përsëritje')
    expect(targetText(reps(9, 11), en)).toBe('9–11 reps')
    expect(targetText(reps(20, 30, true), en)).toBe('20–30 reps, to failure')
    expect(targetText(reps(0, null), sq)).toBe('Përsëritje të lira')
    expect(targetText({ kind: 'timed', seconds: 60 }, en)).toBe('60 seconds')
    expect(targetText({ kind: 'percent_1rm', percent: 75, reps: 5, amrap: true }, sq)).toBe('5+ përsëritje me 75%')
  })

  it('pesha me intervalin pas pushimit: "62,5 × 9–11" / "62.5 × 9–11"', () => {
    expect(loadText(62.5, reps(9, 11), sq)).toBe('62,5 × 9–11')
    expect(loadText(62.5, reps(9, 11), en)).toBe('62.5 × 9–11')
    expect(loadText(null, reps(9, 11), sq)).toBe('9–11 përsëritje')
    expect(loadText(null, { kind: 'timed', seconds: 45 }, sq)).toBe('45 sekonda')
  })

  it('vlera e setit: pesha × përsëritjet, segmentet me "+", koha dhe pesha e trupit', () => {
    expect(setValue(set({}), sq)).toBe('62,5 × 12')
    expect(setValue(set({ reps: 9, segments: [{ weightKg: 62.5, reps: 3 }] }), en)).toBe('62.5 × 9 + 3')
    expect(setValue(set({ weightKg: null, reps: null, seconds: 60 }), sq)).toBe('60 s')
    expect(setValue(set({ weightKg: 0, reps: 15 }), sq)).toBe('15 përsëritje')
    expect(setValue(set({ weightKg: null, reps: 1 }), en)).toBe('1 rep')
    expect(setValue(set({ weightKg: 12, reps: 11 }), sq, { unit: true })).toBe('12\u00a0kg × 11')
  })

  it('setet e një ushtrimi te lista: "62,5 kg · 12, 10, 9, 9 + 3"', () => {
    const sets = [set({ reps: 12 }), set({ reps: 10 }), set({ reps: 9 }), set({ reps: 9, segments: [{ weightKg: 62.5, reps: 3 }] })]
    expect(setsDetail(sets, sq)).toBe('62,5 kg · 12, 10, 9, 9 + 3')
    expect(setsDetail([set({ weightKg: 12, reps: 11 }), set({ weightKg: 14, reps: 9 })], en)).toBe('12 × 11, 14 × 9')
    expect(setsDetail([set({ weightKg: null, reps: null, seconds: 60 }), set({ weightKg: null, reps: null, seconds: 55 })], sq)).toBe('60 s, 55 s')
  })

  it('koha e seancës "06:10" dhe e pushimit me fjalë', () => {
    expect(elapsedText(370)).toBe('06:10')
    expect(elapsedText(3970)).toBe('1:06:10')
    expect(spokenDuration(75, sq.t)).toBe('1 minutë e 15 sekonda')
    expect(spokenDuration(90, en.t)).toBe('1 minute 30 seconds')
    expect(spokenDuration(3960, sq.t)).toBe('1 orë e 6 minuta')
    expect(spokenDuration(45, en.t)).toBe('45 seconds')
  })
})
