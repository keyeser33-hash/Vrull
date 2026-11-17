import { AI_MONTHLY_LIMIT_EUR, type UsageStore } from '../_shared/ai'
import { runExplain } from './handler'
import { buildRequest, type ExplainRequest, interpret, parseRequest } from './logic'

// Rrjedha e një shpjegimi me të rreme: paragrafët me koston, kufiri, gabimet, gjuha dhe kërkesa.
const MONTH = '2026-11-01'
const REQUEST: ExplainRequest = {
  language: 'sq',
  exercise: { name: 'Bench Press', primary: ['Gjoksi'], secondary: ['Tricepsi'], equipment: 'shufër' },
  guide: { cues: ['Këmbët në dysheme'], mistakes: ['Harkim i tepërt i belit'] },
}
const PARAGRAPHS = ['Një.', 'Dy.', 'Tre.']
const ok = (text = JSON.stringify({ paragraphs: PARAGRAPHS })) =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }], usage: { input_tokens: 600, output_tokens: 400 } }), { status: 200 })

function memoryUsage(spentEur = 0) {
  const rows = new Map<string, { eur: number; deleted: boolean }>()
  if (spentEur) rows.set('earlier', { eur: spentEur, deleted: false })
  let next = 0
  const store: UsageStore = {
    reserve: async (_month, eur) => {
      const id = `r${++next}`
      rows.set(id, { eur, deleted: false })
      return id
    },
    spent: async (_month, except) => [...rows].filter(([id, row]) => id !== except && !row.deleted).reduce((sum, [, row]) => sum + row.eur, 0),
    settle: async (id, usage) => void rows.set(id, { eur: usage.eur, deleted: false }),
    cancel: async (id) => void (rows.get(id)!.deleted = true),
  }
  return { store, live: () => [...rows.values()].filter((row) => !row.deleted) }
}

describe('shpjegimi i ushtrimit', () => {
  it('paragrafët, kostoja dhe muaji; modeli dhe gjuha te kërkesa', async () => {
    const usage = memoryUsage()
    let sent: ReturnType<typeof buildRequest> | undefined
    const reply = await runExplain({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async (request) => ((sent = request as typeof sent), ok()) })
    expect(reply.status).toBe(200)
    expect(reply.body.paragraphs).toEqual(PARAGRAPHS)
    // Shqipja me Sonnet 5.5 (Haiku bënte gabime fjalësh në shqip, 17.11.2026): 600 × 2 + 400 × 10 = 5 200 $ për milion
    const eur = Math.round((5_200 / 1e6 / 1.1165) * 1e6) / 1e6
    expect(reply.body).toMatchObject({ usage: { inputTokens: 600, outputTokens: 400, costEur: eur }, month: { month: MONTH, limitEur: AI_MONTHLY_LIMIT_EUR } })
    expect(usage.live().map((row) => row.eur)).toEqual([eur])
    expect(sent?.model).toBe('claude-sonnet-5-5')
    const text = sent!.messages[0].content[0].text
    expect(text).toContain('Language: Albanian.')
    expect(text).toContain('Exercise: Bench Press.')
    expect(text).toContain('- Këmbët në dysheme')
  })

  it('anglishtja me Haiku 5.5: 600 × 0,10 + 400 × 0,50 = 260 $ për milion, rezervimi 0,01 €', async () => {
    const reserved: number[] = []
    const usage = memoryUsage()
    const store: UsageStore = { ...usage.store, reserve: async (month, eur) => (reserved.push(eur), usage.store.reserve(month, eur)) }
    let sent: ReturnType<typeof buildRequest> | undefined
    const reply = await runExplain({ month: MONTH, request: { ...REQUEST, language: 'en' }, usage: store, callClaude: async (request) => ((sent = request as typeof sent), ok()) })
    expect(sent?.model).toBe('claude-haiku-5-5')
    expect(reply.body).toMatchObject({ usage: { costEur: Math.round((260 / 1e6 / 1.1165) * 1e6) / 1e6 } })
    expect(reserved).toEqual([0.01])
  })

  it('shqipja rezervon koston më të keqe të Sonnet-it: 3 000 + 3 000 tokena, 0,04 €', async () => {
    const reserved: number[] = []
    const usage = memoryUsage()
    const store: UsageStore = { ...usage.store, reserve: async (month, eur) => (reserved.push(eur), usage.store.reserve(month, eur)) }
    await runExplain({ month: MONTH, request: REQUEST, usage: store, callClaude: async () => ok() })
    expect(reserved).toEqual([0.04])
    expect((3_000 * 2 + 3_000 * 10) / 1e6 / 1.1165).toBeLessThan(0.04)
  })

  it('anglishtja kërkohet me anglishten britanike; pa udhëzues thuhet', () => {
    const body = buildRequest({ ...REQUEST, language: 'en', guide: null })
    const text = body.messages[0].content[0].text
    expect(text).toContain('Language: British English.')
    expect(text).toContain('Guide: none.')
  })

  it('kufiri i muajit: 429 pa thirrje', async () => {
    let called = false
    const reply = await runExplain({ month: MONTH, request: REQUEST, usage: memoryUsage(AI_MONTHLY_LIMIT_EUR).store, callClaude: async () => ((called = true), ok()) })
    expect(reply).toMatchObject({ status: 429, body: { error: 'limit', month: { limitEur: AI_MONTHLY_LIMIT_EUR } } })
    expect(called).toBe(false)
  })

  it('përgjigja që nuk lexohet, ose me më pak se tre paragrafë, numërohet por kthehet si gabim', async () => {
    for (const text of ['jo json', JSON.stringify({ paragraphs: ['Vetëm një.'] })]) {
      const usage = memoryUsage()
      const reply = await runExplain({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => ok(text) })
      expect(reply).toMatchObject({ status: 502, body: { error: 'unreadable' } })
      expect(usage.live()).toHaveLength(1)
    }
  })

  it('afati dhe gabimi i API-së: pa kosto', async () => {
    const usage = memoryUsage()
    const slow = await runExplain({
      month: MONTH,
      request: REQUEST,
      usage: usage.store,
      timeoutMs: 10,
      callClaude: (_request, signal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
    })
    expect(slow).toMatchObject({ status: 502, body: { error: 'timeout', costEur: 0 } })
    const failed = await runExplain({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => new Response('{}', { status: 529 }) })
    expect(failed.body).toMatchObject({ error: 'ai_failed' })
    expect(usage.live()).toEqual([])
  })

  it('50 kërkesa paralele te kufiri: asnjë nuk e kalon', async () => {
    const usage = memoryUsage(AI_MONTHLY_LIMIT_EUR - 0.015)
    const replies = await Promise.all(Array.from({ length: 50 }, () => runExplain({ month: MONTH, request: REQUEST, usage: usage.store, callClaude: async () => ok() })))
    expect(replies.filter((reply) => reply.status === 200).length).toBeLessThanOrEqual(1)
    expect(replies.every((reply) => reply.status === 200 || reply.status === 429)).toBe(true)
    expect(usage.live().reduce((sum, row) => sum + row.eur, 0)).toBeLessThanOrEqual(AI_MONTHLY_LIMIT_EUR)
  })
})

describe('kërkesa e telefonit', () => {
  const raw = { language: 'en', exercise: { name: ' Bench  Press ', primary: ['Chest', 5], secondary: [], equipment: 'barbell' }, guide: { cues: ['  A  cue '], steps: [], extra: ['x'] } }

  it('pastrohet: emri, muskujt, vetëm seksionet e njohura', () => {
    expect(parseRequest(raw)).toEqual({
      ok: true,
      request: { language: 'en', exercise: { name: 'Bench Press', primary: ['Chest'], secondary: [], equipment: 'barbell' }, guide: { cues: ['A cue'] } },
    })
  })

  it('gjuha e panjohur, pa emër ose pa ushtrim: bad_request', () => {
    expect(parseRequest({ ...raw, language: 'fr' })).toEqual({ ok: false, error: 'bad_request' })
    expect(parseRequest({ ...raw, exercise: { name: '' } })).toEqual({ ok: false, error: 'bad_request' })
    expect(parseRequest(null)).toEqual({ ok: false, error: 'bad_request' })
    expect(parseRequest({ language: 'sq' })).toEqual({ ok: false, error: 'bad_request' })
  })

  it('emri ose udhëzuesi shumë i gjatë: too_long', () => {
    expect(parseRequest({ ...raw, exercise: { ...raw.exercise, name: 'x'.repeat(200) } })).toEqual({ ok: false, error: 'too_long' })
    const big = { cues: Array.from({ length: 8 }, () => 'y'.repeat(400)), mistakes: Array.from({ length: 8 }, () => 'y'.repeat(400)) }
    expect(parseRequest({ ...raw, guide: big })).toEqual({ ok: false, error: 'too_long' })
  })

  it('pa udhëzues: guide null', () => {
    expect(parseRequest({ ...raw, guide: undefined })).toMatchObject({ ok: true, request: { guide: null } })
  })
})

describe('interpret', () => {
  it('pret gjashtë paragrafët', () => {
    const many = Array.from({ length: 9 }, (_, index) => `P${index}`)
    const result = interpret({ content: [{ type: 'text', text: JSON.stringify({ paragraphs: many }) }] })
    expect(result).toEqual({ ok: true, paragraphs: many.slice(0, 6) })
  })
})
