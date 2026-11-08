import fixture from '../../../src/program/pdf-import.fixture.json'
import {
  AI_MONTHLY_LIMIT_EUR,
  buildRequest,
  checkDraft,
  costOf,
  createStreamReader,
  interpret,
  isPdf,
  MODEL,
  monthStart,
  parseKnown,
  PROGRAM_SCHEMA,
  schemaComplexity,
  toBase64,
} from './logic'

// Logjika e funksionit program-import pa Deno dhe pa rrjet (V2-E1-11): muaji, kostoja, kërkesa te
// Claude API, leximi i përgjigjes me stream dhe kontrolli i draftit.

const sse = (events: object[]) => events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join('')

/** Një përgjigje e plotë me stream, me tekstin e ndarë në copa. */
function stream(text: string, { input = 150_000, output = 6_000, stop = 'end_turn' } = {}) {
  const pieces = text.match(/[\s\S]{1,700}/g) ?? []
  return sse([
    { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', content: [], model: MODEL, usage: { input_tokens: input, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    ...pieces.map((piece) => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: piece } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: output } },
    { type: 'message_stop' },
  ])
}

describe('funksioni program-import', () => {
  it('muaji sipas orës së Tiranës, që kufiri të rinisë më 1 të muajit atje', () => {
    expect(monthStart(new Date('2026-11-08T12:00:00Z'))).toBe('2026-11-01')
    // 30 nëntor 23:30 UTC është 1 dhjetor 00:30 në Tiranë (UTC+1 në dimër).
    expect(monthStart(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12-01')
    expect(monthStart(new Date('2026-07-31T22:30:00Z'))).toBe('2026-08-01')
  })

  it('kostoja nga tokenat me çmimet e Claude Sonnet 5.5 dhe kursi i BQE-së', () => {
    // 150 000 tokena hyrje × $2/MTok + 6 000 dalje × $10/MTok = $0,36; / 1,1165 = €0,3224.
    const cost = costOf({ inputTokens: 150_000, outputTokens: 6_000, cacheWriteTokens: 0, cacheReadTokens: 0 })
    expect(cost.usd).toBeCloseTo(0.36, 6)
    expect(cost.eur).toBeCloseTo(0.322436, 6)
    expect(costOf({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000 }).usd).toBeCloseTo(2.6, 6)
    expect(AI_MONTHLY_LIMIT_EUR).toBe(10)
  })

  it('PDF-ja njihet nga fillimi i skedarit dhe kthehet në base64', () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\n%âãÏÓ\n1 0 obj')
    expect(isPdf(bytes)).toBe(true)
    expect(isPdf(new TextEncoder().encode('<html>'))).toBe(false)
    const big = new Uint8Array(100_000).map((_, index) => (index * 31) % 256)
    expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'))
    expect(toBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'))
  })

  it('ushtrimet e njohura: tekst, pa përsëritje, me kufi', () => {
    expect(parseKnown(JSON.stringify(['Bench Press', ' Squat ', 'bench press', '', 7]))).toEqual(['Bench Press', 'Squat'])
    expect(parseKnown('jo json')).toEqual([])
    expect(parseKnown(JSON.stringify(Array.from({ length: 5000 }, (_, index) => `Ushtrimi ${index}`)))).toHaveLength(3000)
  })

  it('kërkesa: PDF-ja para tekstit, dalja me skemën e programit, pa stream të ndalur', () => {
    const body = buildRequest({ pdfBase64: 'JVBERi0=', known: ['Barbell Bench Press - Medium Grip', 'Squat'], language: 'sq' })
    expect(body).toMatchObject({ model: 'claude-sonnet-5-5', stream: true, output_config: { format: { type: 'json_schema', schema: PROGRAM_SCHEMA }, effort: 'low' } })
    expect(body.max_tokens).toBeGreaterThanOrEqual(16_000)
    const [message] = body.messages
    expect(message.content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } })
    expect(message.content[1]).toMatchObject({ type: 'text' })
    expect(body.system).toContain('Barbell Bench Press - Medium Grip\nSquat')
    expect(message.content[1].text).toContain('Albanian')
    expect(buildRequest({ pdfBase64: 'x', known: [], language: 'en' }).messages[0].content[1].text).toContain('British English')
  })

  it('skema: pa fusha opsionale dhe pa tipe të përziera, brenda kufijve të daljes së strukturuar', () => {
    expect(schemaComplexity(PROGRAM_SCHEMA)).toEqual({ optional: 0, unions: 0 })
  })

  it('stream-i: tokenat, teksti dhe arsyeja e ndalimit, edhe kur copat ndajnë rreshtat', () => {
    const text = JSON.stringify(fixture)
    const raw = stream(text)
    const reader = createStreamReader()
    for (let index = 0; index < raw.length; index += 333) reader.push(raw.slice(index, index + 333))
    expect(reader.state()).toMatchObject({ inputTokens: 150_000, outputTokens: 6_000, stopReason: 'end_turn', text, error: null })
  })

  it('stream-i i ndërprerë: tokenat e daljes vlerësohen nga teksti, që kostoja të mos humbasë', () => {
    const raw = stream('x'.repeat(9_000))
    const reader = createStreamReader()
    reader.push(raw.slice(0, raw.indexOf('message_delta')))
    const state = reader.state()
    expect(state.stopReason).toBeNull()
    expect(state.inputTokens).toBe(150_000)
    expect(state.outputTokens).toBe(3_000)
  })

  it('gabimi brenda stream-it lexohet si gabim i AI-së', () => {
    const reader = createStreamReader()
    reader.push(sse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]))
    expect(reader.state().error).toBe('overloaded_error')
    expect(interpret(reader.state())).toEqual({ ok: false, error: 'ai_failed' })
  })

  it('përgjigja: drafti dhe ushtrimet e pasigurta; refuzimi, prerja dhe PDF-ja pa program', () => {
    const done = (text: string, stop = 'end_turn') => {
      const reader = createStreamReader()
      reader.push(stream(text, { stop }))
      return interpret(reader.state())
    }
    const result = done(JSON.stringify(fixture))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.draft.days).toHaveLength(4)
      expect(result.uncertain).toEqual(fixture.exercises.flatMap((exercise, index) => (exercise.sure ? [] : [index])))
    }
    expect(done(JSON.stringify(fixture), 'refusal')).toEqual({ ok: false, error: 'unreadable' })
    expect(done(JSON.stringify(fixture).slice(0, 500), 'max_tokens')).toEqual({ ok: false, error: 'too_long' })
    expect(done('{"found": fals')).toEqual({ ok: false, error: 'unreadable' })
    expect(done(JSON.stringify({ ...fixture, found: false }))).toEqual({ ok: false, error: 'no_programme' })
    expect(done(JSON.stringify({ ...fixture, days: [] }))).toEqual({ ok: false, error: 'no_programme' })
  })

  it('drafti me tregues jashtë listave nuk kalon', () => {
    expect(checkDraft(fixture as never)).toBe(true)
    const broken = structuredClone(fixture)
    broken.days[0].slots[0].exercise = fixture.exercises.length
    expect(checkDraft(broken as never)).toBe(false)
    const badPlan = structuredClone(fixture)
    badPlan.days[1].slots[0].blocks.push({ block: fixture.blocks.length + 1, exercise: -1, sets: 0, plan: -1 })
    expect(checkDraft(badPlan as never)).toBe(false)
    const emptyPlan = structuredClone(fixture)
    emptyPlan.plans[0].weeks = []
    expect(checkDraft(emptyPlan as never)).toBe(false)
  })
})
