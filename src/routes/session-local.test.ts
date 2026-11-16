import type { SetRecord } from '@/data/training'
import { type LocalChange, setKey, settled, withLocal } from './session-local'

// Setet e seancës para bazës (V58, "Zhbëj"; docs/MESIMET.md: një prekje që duhet të duket menjëherë nuk
// pret leximin): "Ruaj setin" dhe "Zhbëj" shfaqen në prekje si ndryshime lokale mbi leximin, dhe ndryshimi
// largohet kur shkrimi ka mbaruar dhe leximi e tregon.

const set = (setNumber: number, values: Partial<SetRecord> = {}): SetRecord => ({
  id: `s${setNumber}`,
  slotId: 'bench',
  exerciseId: 'bench-ex',
  setNumber,
  weightKg: 62.5,
  reps: 8,
  seconds: null,
  rir: null,
  rpe: null,
  technique: 'none',
  segments: [],
  loggedAt: `2026-11-16T18:0${setNumber}:00Z`,
  notes: null,
  ...values,
})

const change = (record: SetRecord | null, key: string, written = false, token = 1): LocalChange => ({ key, set: record, written, token })

describe('setet para bazës', () => {
  it('seti i ri del menjëherë, i fundit, pas seteve të leximit', () => {
    const read = [set(1), set(2)]
    const merged = withLocal(read, [change(set(3, { id: 'local' }), setKey(set(3)))])
    expect(merged.map((entry) => entry.id)).toEqual(['s1', 's2', 'local'])
  })

  it('"Zhbëj" e fsheh setin edhe kur leximi e ka ende', () => {
    expect(withLocal([set(1), set(2)], [change(null, setKey(set(2)))]).map((entry) => entry.id)).toEqual(['s1'])
  })

  it('segmenti i shtohet setit të leximit në vend, pa e lëvizur', () => {
    const read = [set(1), set(2, { technique: 'drop_set' })]
    const merged = withLocal(read, [change(set(2, { technique: 'drop_set', segments: [{ weightKg: 52.5, reps: 4 }] }), setKey(set(2)))])
    expect(merged[1]).toMatchObject({ id: 's2', segments: [{ weightKg: 52.5, reps: 4 }] })
    expect(merged).toHaveLength(2)
  })

  it('ndryshimi mbetet derisa shkrimi të mbarojë dhe leximi ta tregojë', () => {
    const key = setKey(set(3))
    const local = [change(set(3, { id: 'local' }), key)]
    // Shkrimi s'ka mbaruar: mbetet edhe kur leximi e ka.
    expect(settled([set(1), set(3, { id: 'local' })], local)).toEqual(local)
    // Shkrimi mbaroi, leximi ende jo: mbetet.
    const written = [change(set(3, { id: 'local' }), key, true)]
    expect(settled([set(1)], written)).toEqual(written)
    // Leximi e tregon: largohet.
    expect(settled([set(1), set(3, { id: 'local' })], written)).toEqual([])
  })

  it('"Zhbëj" largohet kur leximi nuk e ka më setin', () => {
    const key = setKey(set(2))
    const undone = [change(null, key, true)]
    expect(settled([set(1), set(2)], undone)).toEqual(undone)
    expect(settled([set(1)], undone)).toEqual([])
  })

  it('segmenti largohet kur leximi ka po aq segmente', () => {
    const key = setKey(set(4))
    const withSegment = [change(set(4, { segments: [{ weightKg: 60, reps: 3 }] }), key, true)]
    expect(settled([set(4)], withSegment)).toEqual(withSegment)
    expect(settled([set(4, { segments: [{ weightKg: 60, reps: 3 }] })], withSegment)).toEqual([])
    // "Zhbëj" i segmentit: seti pa segment, derisa leximi ta tregojë pa të.
    const without = [change(set(4), key, true)]
    expect(settled([set(4, { segments: [{ weightKg: 60, reps: 3 }] })], without)).toEqual(without)
    expect(settled([set(4)], without)).toEqual([])
  })
})
