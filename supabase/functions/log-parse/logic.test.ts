import { buildRequest, interpret, MODEL, parseRequest, PARSE_SCHEMA } from './logic'
import { NO_FOOD_IN_PHOTO, type ParseContext } from './shared'

// Kutia e AI-së (V40, V2-E2-13): kërkesa me cache-in e kontekstit, kontrolli i hyrjes dhe drafti i pastër.
const CONTEXT: ParseContext = {
  language: 'sq',
  meals: [
    { key: 'breakfast_1', name: 'Mëngjesi 1', time: '08:20' },
    { key: 'snack_am', name: 'Snack paradite', time: '11:50' },
    { key: 'dinner', name: 'Darka', time: '19:50' },
  ],
  foods: [
    { ref: 'f1', name: 'Bukë integrale', portion: '1 fetë = 32 g' },
    { ref: 'f2', name: 'Vezë', portion: '1 copë = 50 g' },
  ],
  supplements: [
    { ref: 's1', name: 'Gold Standard Whey', dose: '1 lugë = 30 g' },
    { ref: 's2', name: 'Kreatinë', dose: '5 g' },
  ],
  workouts: [
    {
      ref: 'w1',
      date: '2026-11-16',
      label: 'Stërvitja 1 · Gjoks, triceps, pulpa',
      status: 'done',
      exercises: [
        { ref: 'e1', name: 'Barbell Bench Press' },
        { ref: 'e2', name: 'Incline Dumbbell Press' },
      ],
    },
    {
      ref: 'w2',
      date: null,
      label: 'Stërvitja 2 · Shpina, biceps, barku',
      status: 'next',
      exercises: [{ ref: 'e3', name: 'Barbell Row' }],
    },
  ],
}
const REQUEST = {
  text: 'Në 12:00 hëngra dy tost me dy vezë',
  date: '2026-11-18',
  time: '22:40',
  context: CONTEXT,
}
const lastText = (request: ReturnType<typeof buildRequest>) => (request.messages.at(-1)!.content as { type: string; text?: string }[]).find((block) => block.type === 'text')!.text!
const reply = (draft: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(draft) }],
  usage: { input_tokens: 300, output_tokens: 400 },
})
const EMPTY = {
  foods: [],
  water: [],
  supplements: [],
  sets: [],
  answer: { headline: '', text: '' },
  not_understood: [],
}
const food = (fields: Record<string, unknown>) => ({
  said: 'dy tost',
  ref: 'f1',
  name: 'Bukë integrale',
  grams: 64,
  portion: '2 feta',
  vague_amount: false,
  kcal_100: -1,
  protein_100: -1,
  carbs_100: -1,
  fat_100: -1,
  options: [],
  meal: '',
  time: '12:00',
  day: 'today',
  ...fields,
})

describe('kërkesa', () => {
  it('Haiku 5.5, skema e daljes dhe konteksti në cache, ora dhe data te mesazhi', () => {
    const request = buildRequest(REQUEST)
    expect(MODEL).toBe('claude-haiku-5-5')
    expect(request.model).toBe(MODEL)
    expect(request.output_config.format).toEqual({
      type: 'json_schema',
      schema: PARSE_SCHEMA,
    })
    const [instructions, context] = request.system
    expect('cache_control' in instructions).toBe(false)
    expect(context.cache_control).toEqual({ type: 'ephemeral' })
    expect(context.text).toContain('f1 | Bukë integrale | 1 fetë = 32 g')
    expect(context.text).toContain('s2 | Kreatinë | 5 g')
    expect(context.text).toContain('dinner | Darka | 19:50')
    expect(context.text).toContain('w1 | 2026-11-16 | done | Stërvitja 1 · Gjoks, triceps, pulpa | e1 Barbell Bench Press; e2 Incline Dumbbell Press')
    expect(context.text).toContain('w2 | next | next | Stërvitja 2 · Shpina, biceps, barku | e3 Barbell Row')
    // Data dhe ora ndryshojnë çdo mesazh: jashtë cache-it.
    expect(context.text).not.toContain('22:40')
    expect(request.messages.at(-1)!.role).toBe('user')
    expect(lastText(request)).toContain('2026-11-18')
    expect(lastText(request)).toContain('22:40')
    expect(lastText(request)).toContain('dy tost')
    expect(lastText(request)).not.toContain('Facts')
    // Faktet e trajnerit ndryshojnë pas çdo regjistrimi: me mesazhin, jo në cache.
    const withFacts = buildRequest({
      ...REQUEST,
      facts: 'Protein today: 132 of 176 g.',
    })
    expect(lastText(withFacts)).toContain('Facts:\nProtein today: 132 of 176 g.')
    expect(withFacts.system[1].text).toBe(context.text)
  })

  it('foto e pjatës shkon para tekstit, si bllok imazhi', () => {
    const image = { mediaType: 'image/jpeg' as const, data: 'A'.repeat(400) }
    const request = buildRequest({ ...REQUEST, image })
    const content = request.messages.at(-1)!.content as { type: string }[]
    expect(content.map((block) => block.type)).toEqual(['image', 'text'])
    expect(content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.data } })
    expect(parseRequest({ ...REQUEST, image })).toMatchObject({ ok: true, request: { image } })
    expect(parseRequest({ ...REQUEST, image: { mediaType: 'image/gif', data: image.data } })).toEqual({ ok: false, error: 'bad_request' })
    expect(parseRequest({ ...REQUEST, image: { mediaType: 'image/jpeg', data: 'A'.repeat(7_000_001) } })).toEqual({ ok: false, error: 'too_long' })
    // Foto pa ushqim: udhëzimi kërkon shenjën që app-i e kthen në fjali.
    expect(request.system[0].text).toContain(`put "${NO_FOOD_IN_PHOTO}" in not_understood`)
  })

  it('udhëzimet e kalojnë pragun e cache-it (512 tokena te Haiku 5.5)', () => {
    // ~4 shkronja për token: 512 tokena ≈ 2 000 shkronja.
    expect(buildRequest(REQUEST).system[0].text.length).toBeGreaterThan(2_400)
  })

  it('biseda e mëparshme vjen para mesazhit të ri', () => {
    const history = [
      { role: 'user' as const, text: 'Hëngra panetone' },
      { role: 'assistant' as const, text: 'Sa panetone hëngre?' },
    ]
    const request = buildRequest({ ...REQUEST, text: 'gjysmë feta', history })
    expect(request.messages.map((message) => message.role)).toEqual(['user', 'assistant', 'user'])
    expect(request.messages[0].content).toBe('Hëngra panetone')
  })
})

describe('hyrja', () => {
  it('pranon kërkesën e app-it', () => {
    expect(parseRequest(REQUEST)).toEqual({
      ok: true,
      request: { ...REQUEST, facts: '', history: [] },
    })
    const facts = parseRequest({ ...REQUEST, facts: 'x'.repeat(5_000) })
    expect(facts.ok && facts.request.facts!.length).toBe(4_000)
  })

  it('refuzon tekstin bosh, shumë të gjatë, datën ose orën e gabuar', () => {
    expect(parseRequest({ ...REQUEST, text: '   ' })).toEqual({
      ok: false,
      error: 'bad_request',
    })
    expect(parseRequest({ ...REQUEST, text: 'a'.repeat(1_001) })).toEqual({
      ok: false,
      error: 'too_long',
    })
    expect(parseRequest({ ...REQUEST, date: '18.11.2026' })).toEqual({
      ok: false,
      error: 'bad_request',
    })
    expect(parseRequest({ ...REQUEST, time: '24:10' })).toEqual({
      ok: false,
      error: 'bad_request',
    })
    expect(parseRequest(null)).toEqual({ ok: false, error: 'bad_request' })
  })

  it('pastron kontekstin: rreshtat e rinj dhe | nuk prishin listën, kufijtë mbahen', () => {
    const parsed = parseRequest({
      ...REQUEST,
      context: {
        ...CONTEXT,
        foods: [
          { ref: 'f1', name: 'Bukë\nintegrale | e zezë', portion: null },
          ...Array.from({ length: 200 }, (_, index) => ({
            ref: `x${index}`,
            name: 'Ushqim',
            portion: null,
          })),
        ],
        meals: [...CONTEXT.meals, { key: 'brunch', name: 'Brunch', time: '10:00' }],
      },
      history: Array.from({ length: 10 }, (_, index) => ({
        role: index % 2 ? 'assistant' : 'user',
        text: `t${index}`,
      })),
    })
    if (!parsed.ok) throw new Error('duhej pranuar')
    expect(parsed.request.context.foods[0].name).toBe('Bukë integrale / e zezë')
    expect(parsed.request.context.foods).toHaveLength(150)
    expect(parsed.request.context.meals.map((meal) => meal.key)).toEqual(['breakfast_1', 'snack_am', 'dinner'])
    // Gjashtë të fundit, që biseda të fillojë me përdoruesin.
    expect(parsed.request.history!.map((turn) => turn.text)).toEqual(['t4', 't5', 't6', 't7', 't8', 't9'])
  })
})

describe('drafti', () => {
  it('ushqimi i njohur merr emrin e app-it dhe pa vlera të AI-së', () => {
    const outcome = interpret(reply({ ...EMPTY, foods: [food({ name: 'Tost', kcal_100: 250 })] }), CONTEXT)
    expect(outcome).toEqual({
      ok: true,
      draft: {
        foods: [
          {
            said: 'dy tost',
            ref: 'f1',
            name: 'Bukë integrale',
            grams: 64,
            portion: '2 feta',
            estimated: false,
            per100: null,
            options: [],
            meal: null,
            time: '12:00',
            day: 0,
          },
        ],
        water: [],
        supplements: [],
        sets: [],
        answer: null,
        notUnderstood: [],
      },
    })
  })

  it('ushqimi i ri me vlerat për 100 g; sasia e paqartë shënohet', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        foods: [
          food({
            said: 'gjysmë pule',
            ref: '',
            name: 'Pulë e pjekur me lëkurë',
            grams: 300,
            portion: 'gjysmë pule',
            vague_amount: true,
            kcal_100: 239,
            protein_100: 27.3,
            carbs_100: 0,
            fat_100: 13.6,
            meal: 'dinner',
            time: '',
          }),
        ],
      }),
      CONTEXT,
    )
    if (!outcome.ok) throw new Error('duhej draft')
    expect(outcome.draft.foods[0]).toMatchObject({
      ref: null,
      estimated: true,
      per100: { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 },
      meal: 'dinner',
      time: null,
    })
  })

  it('sasia që mungon: gramët null dhe zgjedhjet e pastra', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        foods: [
          food({
            said: 'panetone',
            ref: '',
            name: 'Panetone',
            grams: -1,
            portion: '',
            kcal_100: 362,
            protein_100: 6.5,
            carbs_100: 55,
            fat_100: 13,
            options: [
              { label: '1 fetë', grams: 80 },
              { label: '2 feta', grams: 160 },
              { label: 'pa gramë', grams: 0 },
              { label: '3 feta', grams: 240 },
              { label: '4 feta', grams: 320 },
            ],
          }),
        ],
      }),
      CONTEXT,
    )
    if (!outcome.ok) throw new Error('duhej draft')
    expect(outcome.draft.foods[0].grams).toBeNull()
    expect(outcome.draft.foods[0].options).toEqual([
      { label: '1 fetë', grams: 80 },
      { label: '2 feta', grams: 160 },
      { label: '3 feta', grams: 240 },
    ])
  })

  it('referenca që nuk ekziston bëhet ushqim i ri; pa vlera të vlefshme shkon te të pakuptuarat', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        foods: [
          food({
            ref: 'f99',
            name: 'Kos',
            kcal_100: 61,
            protein_100: 3.5,
            carbs_100: 4.7,
            fat_100: 3.3,
          }),
          food({ said: 'diçka', ref: 'f77', name: 'Diçka', kcal_100: 2_000 }),
        ],
      }),
      CONTEXT,
    )
    if (!outcome.ok) throw new Error('duhej draft')
    expect(outcome.draft.foods).toHaveLength(1)
    expect(outcome.draft.foods[0]).toMatchObject({
      ref: null,
      name: 'Kos',
      per100: { kcal: 61 },
    })
    expect(outcome.draft.notUnderstood).toEqual(['diçka'])
  })

  it('uji, suplementet, dita e djeshme dhe vlerat jashtë kufijve', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        water: [
          { ml: 500, time: '', day: 'today' },
          { ml: 90_000, time: '', day: 'today' },
        ],
        supplements: [
          { ref: 's2', amount: 1, meal: '', time: '', day: 'yesterday' },
          { ref: 's9', amount: 1, meal: '', time: '', day: 'today' },
          {
            ref: 's1',
            amount: 1,
            meal: 'breakfast_1',
            time: '7:00',
            day: 'today',
          },
        ],
        not_understood: ['pastaj fjeta', ''],
      }),
      CONTEXT,
    )
    expect(outcome).toEqual({
      ok: true,
      draft: {
        foods: [],
        water: [{ ml: 500, time: null, day: 0 }],
        supplements: [
          { ref: 's2', amount: 1, meal: null, time: null, day: -1 },
          { ref: 's1', amount: 1, meal: 'breakfast_1', time: '07:00', day: 0 },
        ],
        sets: [],
        answer: null,
        notUnderstood: ['pastaj fjeta'],
      },
    })
  })

  it('setet: një rresht për çdo set, pesha e trupit null, ushtrimi jashtë stërvitjes pa referencë', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        sets: [
          {
            said: 'bench 3×10 me 60 kg',
            workout_ref: 'w1',
            exercise_ref: 'e1',
            exercise_name: 'Bench',
            sets: [1, 2, 3].map(() => ({ reps: 10, weight_kg: 60, rir: -1 })),
            day: 'yesterday',
          },
          {
            said: 'dips 3×12',
            workout_ref: 'w1',
            exercise_ref: 'e9',
            exercise_name: 'Dips',
            sets: [{ reps: 12, weight_kg: -1, rir: 2 }],
            day: 'yesterday',
          },
          {
            said: 'diçka',
            workout_ref: 'w9',
            exercise_ref: '',
            exercise_name: 'Squat',
            sets: [{ reps: 5, weight_kg: 100, rir: -1 }],
            day: 'today',
          },
          {
            said: 'pa sete',
            workout_ref: 'w1',
            exercise_ref: 'e2',
            exercise_name: 'Incline',
            sets: [{ reps: 0, weight_kg: 20, rir: -1 }],
            day: 'today',
          },
        ],
      }),
      CONTEXT,
    )
    if (!outcome.ok) throw new Error('duhej draft')
    expect(outcome.draft.sets).toEqual([
      {
        said: 'bench 3×10 me 60 kg',
        workoutRef: 'w1',
        exerciseRef: 'e1',
        exerciseName: 'Barbell Bench Press',
        sets: [1, 2, 3].map(() => ({ reps: 10, weightKg: 60, rir: null })),
        day: -1,
      },
      {
        said: 'dips 3×12',
        workoutRef: 'w1',
        exerciseRef: null,
        exerciseName: 'Dips',
        sets: [{ reps: 12, weightKg: null, rir: 2 }],
        day: -1,
      },
    ])
    expect(outcome.draft.notUnderstood).toEqual(['diçka', 'pa sete'])
  })

  it('pyetja: përgjigja e trajnerit; bosh kur nuk ka pyetje', () => {
    const outcome = interpret(
      reply({
        ...EMPTY,
        answer: { headline: '44 g proteinë', text: 'Ke 132 nga 176 g.' },
      }),
      CONTEXT,
    )
    expect(outcome.ok && outcome.draft.answer).toEqual({
      headline: '44 g proteinë',
      text: 'Ke 132 nga 176 g.',
    })
    expect(interpret(reply(EMPTY), CONTEXT)).toMatchObject({
      ok: true,
      draft: { answer: null },
    })
  })

  it('përgjigja që nuk lexohet', () => {
    expect(interpret({ content: [{ type: 'text', text: 'jo json' }] }, CONTEXT)).toEqual({ ok: false, error: 'unreadable' })
    expect(interpret(null, CONTEXT)).toEqual({
      ok: false,
      error: 'unreadable',
    })
  })
})
