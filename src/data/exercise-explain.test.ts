import { createDatabase } from './db'
import { type ExplainRemote, type ExplainResult, explainBlock, explainExercise, explainRequest, explainResultFrom, explanationKey, savedExplanation, type ExplainSubject } from './exercise-explain'
import { createLocalStore } from './store'
import { CLEAN } from './tables'

// "Shpjegoje më shumë" në telefon (V56, §0.3e): kërkesa pa tekst personal, pa internet, pas kufirit, ruajtja
// për ushtrimin dhe gjuhën, dhe përgjigjet e funksionit.

const USER = '11111111-1111-4111-8111-111111111111'
const NOW = new Date(2026, 10, 16, 10, 0)

function setup() {
  const db = createDatabase(`explain-${crypto.randomUUID()}`)
  const store = createLocalStore(db, { userId: () => USER, now: () => NOW })
  const spend = (cost: number) =>
    db.ai_usage.put({
      id: crypto.randomUUID(),
      user_id: USER,
      created_at: '2026-11-08T09:00:00Z',
      updated_at: '2026-11-08T09:00:00Z',
      deleted_at: null,
      server_updated_at: '2026-11-08T09:00:00Z',
      month: '2026-11-01',
      feature: 'explain',
      model: 'claude-haiku-5-5',
      input_tokens: 1000,
      output_tokens: 500,
      cost_usd: cost * 1.1165,
      cost_eur: cost,
      _dirty: CLEAN,
    })
  return { store, spend }
}

const text = (sq: string, en = sq) => ({ sq, en })
const list = (...items: string[]) => ({ items: items.map((item) => text(item, `${item} (en)`)), sources: [] })
const SUBJECT: ExplainSubject = {
  key: 'Barbell_Bench_Press_-_Medium_Grip',
  name: 'Bench Press',
  equipment: 'shufër',
  primary: ['Gjoksi'],
  secondary: ['Tricepsi'],
  guide: {
    exercise: 'Bench Press',
    tempo: null,
    setup: list('Shtrihu në stol'),
    steps: list('Ule shufrën'),
    breathing: list('Merr frymë'),
    cues: list('Këmbët në dysheme'),
    mistakes: list('Harkim i tepërt'),
    tips: [{ who: 'Jim Stoppani, PhD', text: text('Pesë pika kontakti', 'Five points of contact'), sources: [] }],
    safety: list('Kërko një rojë'),
    history: null,
    sources: {},
  },
}

const answer = (...paragraphs: string[]): ExplainResult => ({ ok: true, paragraphs, costEur: 0.001 })
function remote(result: ExplainResult = answer('Një.', 'Dy.', 'Tre.')) {
  const calls: Parameters<ExplainRemote['explain']>[0][] = []
  return { calls, remote: { explain: async (request) => (calls.push(request), result) } satisfies ExplainRemote }
}

describe('kërkesa', () => {
  it('emri, muskujt dhe udhëzuesi në gjuhën e kërkuar, pa tekst personal', () => {
    const en = explainRequest(SUBJECT, 'en')
    expect(en.language).toBe('en')
    expect(en.exercise).toEqual({ name: 'Bench Press', primary: ['Gjoksi'], secondary: ['Tricepsi'], equipment: 'shufër' })
    expect(en.guide).toMatchObject({ cues: ['Këmbët në dysheme (en)'], tips: ['Jim Stoppani, PhD: Five points of contact'] })
    expect(Object.keys(en.guide!).sort()).toEqual(['breathing', 'cues', 'mistakes', 'safety', 'setup', 'steps', 'tips'])
    expect(explainRequest(SUBJECT, 'sq').guide?.tips).toEqual(['Jim Stoppani, PhD: Pesë pika kontakti'])
  })

  it('pa udhëzues: guide null', () => {
    expect(explainRequest({ ...SUBJECT, guide: null }, 'sq').guide).toBeNull()
  })
})

describe('shpjegimi', () => {
  it('thirret një herë, ruhet për ushtrimin dhe gjuhën; hapja e dytë nuk thërret asgjë, as pa internet', async () => {
    const { store } = setup()
    const { calls, remote: fake } = remote()
    const first = await explainExercise(store, fake, SUBJECT, 'sq', true)
    expect(first).toMatchObject({ ok: true, paragraphs: ['Një.', 'Dy.', 'Tre.'] })
    expect(calls).toHaveLength(1)
    expect(await savedExplanation(store, SUBJECT, 'sq')).toEqual(['Një.', 'Dy.', 'Tre.'])
    expect(await savedExplanation(store, SUBJECT, 'en')).toBeNull()
    expect(await savedExplanation(store, { ...SUBJECT, key: 'tjetri' }, 'sq')).toBeNull()

    const again = await explainExercise(store, fake, SUBJECT, 'sq', false)
    expect(again).toMatchObject({ ok: true, paragraphs: ['Një.', 'Dy.', 'Tre.'], costEur: 0 })
    expect(calls).toHaveLength(1)

    // Gjuha tjetër është shpjegim tjetër.
    await explainExercise(store, fake, SUBJECT, 'en', true)
    expect(calls.map((call) => call.language)).toEqual(['sq', 'en'])
  })

  it('pa internet dhe pa shpjegim të ruajtur: asnjë thirrje, gabimi "offline"', async () => {
    const { store } = setup()
    const { calls, remote: fake } = remote()
    expect(await explainExercise(store, fake, SUBJECT, 'sq', false)).toEqual({ ok: false, error: 'offline' })
    expect(await explainBlock(store, false)).toBe('offline')
    expect(calls).toHaveLength(0)
  })

  it('pas kufirit të muajit: asnjë thirrje, gabimi "limit"; një shpjegim i ruajtur hapet prapë', async () => {
    const { store, spend } = setup()
    await spend(9.995)
    const { calls, remote: fake } = remote()
    expect(await explainBlock(store, true)).toBe('limit')
    expect(await explainExercise(store, fake, SUBJECT, 'sq', true)).toEqual({ ok: false, error: 'limit' })
    expect(calls).toHaveLength(0)
    await store.writeDevice(explanationKey(SUBJECT, 'sq'), ['Ruajtur.'])
    expect(await explainExercise(store, fake, SUBJECT, 'sq', true)).toMatchObject({ ok: true, paragraphs: ['Ruajtur.'] })
  })

  it('një gabim i funksionit nuk ruhet', async () => {
    const { store } = setup()
    const { remote: fake } = remote({ ok: false, error: 'timeout' })
    expect(await explainExercise(store, fake, SUBJECT, 'sq', true)).toEqual({ ok: false, error: 'timeout' })
    expect(await savedExplanation(store, SUBJECT, 'sq')).toBeNull()
  })

  it('kur udhëzuesi ndryshon (një fakt i korrigjuar), shpjegimi i vjetër nuk hapet dhe kërkohet një i ri', async () => {
    const { store } = setup()
    const { calls, remote: fake } = remote()
    await explainExercise(store, fake, SUBJECT, 'sq', true)
    const corrected = { ...SUBJECT, guide: { ...SUBJECT.guide!, cues: list('Këmbët të ngulura në dysheme') } }
    expect(await savedExplanation(store, corrected, 'sq')).toBeNull()
    await explainExercise(store, fake, corrected, 'sq', true)
    expect(calls).toHaveLength(2)
    expect(calls[1].guide?.cues).toEqual(['Këmbët të ngulura në dysheme'])
    // Pa udhëzues (ushtrim pa udhëzues ende): kur udhëzuesi vjen me një valë, shpjegimi rikërkohet.
    expect(explanationKey({ ...SUBJECT, guide: null }, 'sq')).not.toBe(explanationKey(SUBJECT, 'sq'))
  })
})

describe('përgjigja e funksionit', () => {
  it('200 me paragrafë dhe kostoja', () => {
    expect(explainResultFrom(200, { paragraphs: ['A', ' ', 'B'], usage: { costEur: 0.002 }, month: {} })).toEqual({ ok: true, paragraphs: ['A', 'B'], costEur: 0.002 })
  })

  it('pa paragrafë: ai_failed; pa lidhje: offline', () => {
    expect(explainResultFrom(200, { paragraphs: [] })).toEqual({ ok: false, error: 'ai_failed' })
    expect(explainResultFrom(null, null)).toEqual({ ok: false, error: 'offline' })
  })

  it('429 me muajin, 401 dhe gabimet e panjohura', () => {
    const month = { month: '2026-11-01', spentEur: 10, limitEur: 10 }
    expect(explainResultFrom(429, { error: 'limit', month })).toEqual({ ok: false, error: 'limit', month })
    expect(explainResultFrom(401, null)).toEqual({ ok: false, error: 'unauthorized' })
    expect(explainResultFrom(500, { error: 'çfarëdo' })).toEqual({ ok: false, error: 'ai_failed' })
    expect(explainResultFrom(502, { error: 'timeout' })).toEqual({ ok: false, error: 'timeout' })
  })
})
