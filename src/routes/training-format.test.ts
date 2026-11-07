import { clock, dateLabel, kg, setsText, targetText, techniqueLabel, techniqueText } from './training-format'

describe('tekstet e stërvitjes', () => {
  it('kilogramët me presje dhjetore, pa zero të tepërta', () => {
    expect(kg(47.5)).toBe('47,5')
    expect(kg(50)).toBe('50')
    expect(kg(22.25)).toBe('22,25')
  })

  it('objektivi i setit', () => {
    expect(targetText({ kind: 'reps', min: 12, max: 15, beyond: false })).toBe('12–15 përsëritje')
    expect(targetText({ kind: 'reps', min: 20, max: 30, beyond: true })).toBe('20–30 përsëritje, deri në dështim')
    expect(targetText({ kind: 'reps', min: 8, max: null, beyond: false })).toBe('8+ përsëritje')
    expect(targetText({ kind: 'reps', min: 0, max: null, beyond: false })).toBe('Përsëritje të lira')
    expect(targetText({ kind: 'timed', seconds: 75 })).toBe('75 sekonda')
    expect(targetText({ kind: 'percent_1rm', percent: 85, reps: 5, amrap: true })).toBe('5+ përsëritje me 85%')
    expect(targetText({ kind: 'linear', reps: 5, startKg: 40, incrementKg: 2.5, failuresBeforeDeload: 3, deloadPercent: 10 })).toBe('5 përsëritje')
  })

  it('setet e ushtrimit: "4 × 12–15" ose "3 × 60 s"', () => {
    expect(setsText(4, { kind: 'reps', min: 12, max: 15, beyond: false })).toBe('4 × 12–15')
    expect(setsText(3, { kind: 'timed', seconds: 60 })).toBe('3 × 60 s')
    expect(setsText(3, { kind: 'reps', min: 0, max: null, beyond: false })).toBe('3 sete')
    expect(setsText(1, { kind: 'reps', min: 0, max: null, beyond: false })).toBe('1 set')
  })

  it('teknika me emrin e plotë te editori', () => {
    expect(techniqueLabel(undefined)).toBe('Asnjë')
    expect(techniqueLabel({ type: 'none' })).toBe('Asnjë')
    expect(techniqueLabel({ type: 'rest_pause' })).toBe('Rest-pause, 15 s')
    expect(techniqueLabel({ type: 'rest_pause', restSeconds: 20 })).toBe('Rest-pause, 20 s')
    expect(techniqueLabel({ type: 'drop_set' })).toBe('Drop set')
    expect(techniqueLabel({ type: 'drop_set', percent: 70 })).toBe('Drop set, 70%')
    expect(techniqueLabel({ type: 'to_failure' })).toBe('Deri në dështim')
  })

  it('teknika me fjalë', () => {
    expect(techniqueText({ type: 'rest_pause' })).toBe('rest-pause')
    expect(techniqueText({ type: 'drop_set' })).toBe('drop set')
    expect(techniqueText({ type: 'to_failure' })).toBe('deri në dështim')
    expect(techniqueText({ type: 'none' })).toBeNull()
  })

  it('data si te rreshtat: "e hënë 07.12"', () => {
    expect(dateLabel(new Date(2026, 11, 7))).toBe('e hënë 07.12')
    expect(dateLabel(new Date(2026, 11, 13))).toBe('e diel 13.12')
  })

  it('ora e timer-it dhe e seancës', () => {
    expect(clock(90)).toBe('1:30')
    expect(clock(5)).toBe('0:05')
    expect(clock(18 * 60 + 42)).toBe('18:42')
    expect(clock(3723)).toBe('1:02:03')
  })
})
