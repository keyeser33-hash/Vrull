import { authPeople, type LimitStore, parseAdminRequest, saveLimit, summarize } from './logic'

// Kufiri i AI-së te Admini (V42, V2-E2-17): përmbledhja e muajit dhe kontrolli i kërkesës.
const OWNER = '11111111-1111-4111-8111-111111111111'
const FRIEND = '22222222-2222-4222-8222-222222222222'
const KLEA = '33333333-3333-4333-8333-333333333333'

describe('përmbledhja', () => {
  it('pronari i pari, kostoja sipas veçorisë pa rezervimet, kufiri ose 10 €, pa llogaritë e provës', () => {
    const people = summarize({
      people: [
        { id: FRIEND, email: 'arben@example.com', name: 'Arben', isAdmin: false },
        { id: OWNER, email: 'pronari@example.com', name: null, isAdmin: true },
        { id: KLEA, email: 'klea@example.com', name: 'Klea', isAdmin: false },
        { id: '44444444-4444-4444-8444-444444444444', email: 'e2e-aibox-1@example.invalid', name: null, isAdmin: false },
      ],
      usage: [
        { user_id: OWNER, feature: 'food_text', cost_eur: '0.001', input_tokens: 400, output_tokens: 600 },
        { user_id: OWNER, feature: 'food_text', cost_eur: '0.002', input_tokens: 400, output_tokens: 600 },
        { user_id: OWNER, feature: 'program_pdf', cost_eur: '0.06', input_tokens: 9000, output_tokens: 4000 },
        // Rezervim në punë: jo shpenzim.
        { user_id: OWNER, feature: 'food_photo', cost_eur: '0.01', input_tokens: 0, output_tokens: 0 },
        { user_id: KLEA, feature: 'food_photo', cost_eur: '10', input_tokens: 1, output_tokens: 1 },
      ],
      limits: [
        { user_id: OWNER, monthly_eur: '40.00' },
        { user_id: KLEA, monthly_eur: 10 },
      ],
      defaultLimitEur: 10,
    })
    expect(people.map((person) => [person.name, person.isAdmin, person.limitEur, person.spentEur])).toEqual([
      ['pronari', true, 40, 0.063],
      ['Arben', false, 10, 0],
      ['Klea', false, 10, 10],
    ])
    expect(people[0].byFeature.food_text).toEqual({ eur: 0.003, count: 2 })
    expect(people[0].byFeature.food_photo).toEqual({ eur: 0, count: 0 })
    expect(people[0].byFeature.program_pdf).toEqual({ eur: 0.06, count: 1 })
  })
})

describe('kërkesa', () => {
  it('lista dhe kufiri i ri; çdo gjë tjetër refuzohet', () => {
    expect(parseAdminRequest({ action: 'list' })).toEqual({ action: 'list' })
    expect(parseAdminRequest({ action: 'set', userId: FRIEND, limitEur: 15 })).toEqual({ action: 'set', userId: FRIEND, limitEur: 15 })
    expect(parseAdminRequest({ action: 'set', userId: FRIEND, limitEur: -5 })).toBeNull()
    expect(parseAdminRequest({ action: 'set', userId: FRIEND, limitEur: 501 })).toBeNull()
    expect(parseAdminRequest({ action: 'set', userId: 'jo-uuid', limitEur: 10 })).toBeNull()
    expect(parseAdminRequest({ action: 'delete' })).toBeNull()
    expect(parseAdminRequest(null)).toBeNull()
  })
})

describe('ruajtja e kufirit', () => {
  /** ai_limits në memorie, me rregullin e serverit: një rresht i gjallë për person. */
  function memoryLimits() {
    const rows: { id: string; userId: string; eur: number }[] = []
    const store: LimitStore = {
      find: async (userId) => rows.find((row) => row.userId === userId) ?? null,
      update: async (id, eur) => void (rows.find((row) => row.id === id)!.eur = eur),
      insert: async (userId, eur) => {
        if (rows.some((row) => row.userId === userId)) throw new Error('23505')
        rows.push({ id: `l${rows.length + 1}`, userId, eur })
      },
    }
    return { store, rows }
  }

  it('i pari shtohet, i dyti ndryshon të njëjtin rresht; personat e tjerë mbeten', async () => {
    const { store, rows } = memoryLimits()
    await saveLimit(store, KLEA, 15)
    await saveLimit(store, FRIEND, 5)
    await saveLimit(store, KLEA, 20)
    expect(rows).toEqual([
      { id: 'l1', userId: KLEA, eur: 20 },
      { id: 'l2', userId: FRIEND, eur: 5 },
    ])
  })

  it('një gabim i bazës nuk fshihet', async () => {
    const store: LimitStore = { find: async () => Promise.reject(new Error('42P01')), update: vi.fn(), insert: vi.fn() }
    await expect(saveLimit(store, KLEA, 15)).rejects.toThrow('42P01')
    expect(store.insert).not.toHaveBeenCalled()
  })
})

describe('personat e Auth-it', () => {
  it('emri nga name, pastaj full_name; admini vetëm nga app_metadata', () => {
    expect(
      authPeople([
        { id: OWNER, email: 'pronari@example.com', user_metadata: { name: '  ' }, app_metadata: { vrull_admin: true } },
        { id: FRIEND, email: null, user_metadata: { full_name: 'Arben Hoxha' }, app_metadata: {} },
        // user_metadata e shkruan përdoruesi: nuk e bën admin.
        { id: KLEA, user_metadata: { name: 'Klea', vrull_admin: true }, app_metadata: { provider: 'email' } },
      ]),
    ).toEqual([
      { id: OWNER, email: 'pronari@example.com', name: null, isAdmin: true },
      { id: FRIEND, email: null, name: 'Arben Hoxha', isAdmin: false },
      { id: KLEA, email: null, name: 'Klea', isAdmin: false },
    ])
  })
})
