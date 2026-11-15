import { createDatabase } from './db'
import { mentorNoteFor, mentorNotes } from './mentor'
import { createLocalStore } from './store'

// Shënimi i mentorit te Sot (V55, V57): rrethi del vetëm kur ka një shënim të kësaj jave ose të një seance të kësaj jave.
const USER = '11111111-1111-4111-8111-111111111111'
let clock = new Date(2026, 10, 11, 10, 0)
const store = () => createLocalStore(createDatabase(`mentor-${crypto.randomUUID()}`), { userId: () => USER, now: () => clock })

const note = (over: Record<string, unknown>) => ({ kind: 'raport_javor', title: 'Java 3', body: 'Bench Press po ecën.', steps: [], sources: [], language: 'sq', ...over })

describe('shënimet e mentorit', () => {
  it('pa shënime: asgjë', async () => {
    const s = store()
    expect(await mentorNoteFor(s, '2026-11-09')).toBeNull()
  })

  it('raporti ose plani i javës: sipas të hënës së javës', async () => {
    const s = store()
    await s.put('mentor_notes', note({ period_start: '2026-11-02', period_end: '2026-11-08', title: 'Java e kaluar' }))
    expect(await mentorNoteFor(s, '2026-11-09')).toBeNull()
    await s.put('mentor_notes', note({ period_start: '2026-11-09', period_end: '2026-11-15', title: 'Java 3' }))
    expect(await mentorNoteFor(s, '2026-11-09')).toMatchObject({ kind: 'raport_javor', title: 'Java 3', body: 'Bench Press po ecën.', steps: [] })
  })

  it('komenti i një seance të kësaj jave; seanca e javës së kaluar nuk numërohet', async () => {
    const s = store()
    const old = await s.put('workout_sessions', { date: '2026-11-05', status: 'completed', ended_at: '2026-11-05T18:00:00.000Z' })
    const fresh = await s.put('workout_sessions', { date: '2026-11-10', status: 'completed', ended_at: '2026-11-10T18:00:00.000Z' })
    await s.put('mentor_notes', note({ kind: 'komenti_seances', session_id: old.id, title: 'Squat 75 × 11' }))
    expect(await mentorNoteFor(s, '2026-11-09')).toBeNull()
    await s.put('mentor_notes', note({ kind: 'komenti_seances', session_id: fresh.id, title: 'Bench 62,5 × 10' }))
    expect(await mentorNoteFor(s, '2026-11-09')).toMatchObject({ kind: 'komenti_seances', title: 'Bench 62,5 × 10' })
  })

  it('shënimet e provës, përgjigjet e ruajtura dhe të fshirat nuk e shfaqin rrethin', async () => {
    const s = store()
    await s.put('mentor_notes', note({ kind: 'prove', period_start: '2026-11-09' }))
    await s.put('mentor_notes', note({ kind: 'pergjigje', period_start: '2026-11-09' }))
    const gone = await s.put('mentor_notes', note({ period_start: '2026-11-09' }))
    await s.remove('mentor_notes', gone.id)
    expect(await mentorNoteFor(s, '2026-11-09')).toBeNull()
  })

  it('kur janë disa, i fundit sipas krijimit; hapat dhe burimet vijnë të pastruara', async () => {
    const s = store()
    clock = new Date(2026, 10, 9, 7, 0)
    await s.put('mentor_notes', note({ period_start: '2026-11-09', title: 'Raporti', steps: ['Shto 2,5 kg', 7, 'Fli 8 orë'] }))
    clock = new Date(2026, 10, 15, 19, 0)
    await s.put('mentor_notes', note({ kind: 'plani_javes', period_start: '2026-11-09', title: 'Plani', sources: [{ label: 'ACSM', url: 'https://acsm.org' }, { label: 5 }] }))
    const latest = await mentorNoteFor(s, '2026-11-09')
    expect(latest).toMatchObject({ kind: 'plani_javes', title: 'Plani', sources: [{ label: 'ACSM', url: 'https://acsm.org' }] })
    const all = await mentorNotes(s, '2026-11-09')
    expect(all.map((entry) => entry.title)).toEqual(['Plani', 'Raporti'])
    expect(all[1].steps).toEqual(['Shto 2,5 kg', 'Fli 8 orë'])
  })
})
