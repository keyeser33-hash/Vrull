// Kutia e AI-së (V40, V2-E2-13), pa Deno dhe pa Supabase: kontrolli i kërkesës së telefonit, kërkesa te
// Claude me kontekstin në cache dhe skemën e daljes, dhe drafti i pastër. index.ts e lidh me Deno.serve;
// provat: logic.test.ts dhe handler.test.ts.
//
// Modeli kthen vetëm atë që u tha: ushqimet (me gramë, ose me 2–3 zgjedhje kur sasia mungon), ujin,
// suplementet, setet (V2-E2-14) dhe përgjigjen e trajnerit nga faktet që dërgon telefoni (V2-E2-15). Vakti nga ora e vendos telefoni (SPEC §9 "Kutia e AI-së"); makrot e ushqimeve të njohura i
// llogarit telefoni nga vlerat e veta, AI-ja jep vlera për 100 g vetëm për një ushqim të ri.
import {
  type ContextFood,
  type ContextMeal,
  type ContextSupplement,
  type ContextWorkout,
  type CoachAnswer,
  type DayOffset,
  type Draft,
  type DraftExercise,
  type DraftFood,
  type DraftSet,
  type DraftSupplement,
  type DraftWater,
  MAX_FACTS,
  MAX_FOODS,
  MAX_HISTORY,
  MAX_SUPPLEMENTS,
  MAX_TEXT,
  MAX_WORKOUTS,
  MEAL_KEYS,
  type ParseContext,
  type ParseMealKey,
  type ParseRequest,
  type ParseTurn,
  type Per100,
} from './shared.ts'

export type { Draft, ParseRequest } from './shared.ts'

/** Haiku 5.5: ndarja e një mesazhi të shkurtër në rreshta; rreth 0,001 € për mesazh (SPEC V40). */
export const MODEL = 'claude-haiku-5-5'
export const API_VERSION = '2026-10-21'
export const MAX_TOKENS = 2_000
export const EFFORT = 'low'
export const AI_TIMEOUT_MS = 30_000
/** Kostoja më e keqe: ~8 000 tokena hyrje (shkrimi i cache-it) dhe 2 000 dalje, rreth $0,002; me rezervë. */
export const AI_CALL_RESERVE_EUR = 0.01

type Schema = Record<string, unknown>
const object = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
const string = (description: string): Schema => ({
  type: 'string',
  description,
})
const number = (description: string): Schema => ({
  type: 'number',
  description,
})
const MEAL = {
  type: 'string',
  enum: [...MEAL_KEYS, ''],
  description: 'Meal key only when the user names the meal ("në darkë" → dinner); "" otherwise.',
}
const TIME = string('Clock time the user gave, 24-hour "HH:MM" ("në 7" → "07:00"); "" when none.')
const DAY = {
  type: 'string',
  enum: ['today', 'yesterday'],
  description: 'yesterday only when the user says so ("dje").',
}

/** Skema e daljes: çdo fushë gjithnjë e pranishme; -1 ose "" kur nuk ka vlerë. */
export const PARSE_SCHEMA: Schema = object({
  foods: {
    type: 'array',
    items: object({
      said: string("The user's own words for this food, short."),
      ref: string('Ref of the matching known food ("f12"); "" when no known food matches.'),
      name: string("Clean food name in the user's language, sentence case."),
      grams: number('Total grams eaten; -1 when the amount is unknown.'),
      portion: string('The amount in words ("2 feta", "gjysmë pule"); "" when unknown.'),
      vague_amount: {
        type: 'boolean',
        description: 'True when grams were estimated from a vague amount.',
      },
      kcal_100: number('kcal per 100 g for a food without ref; -1 when ref is set.'),
      protein_100: number('Protein g per 100 g for a food without ref; -1 when ref is set.'),
      carbs_100: number('Carbohydrate g per 100 g for a food without ref; -1 when ref is set.'),
      fat_100: number('Fat g per 100 g for a food without ref; -1 when ref is set.'),
      options: {
        type: 'array',
        description: 'Only when grams is -1: 3 typical amounts to choose from.',
        items: object({
          label: string('Amount in words, short ("1 fetë").'),
          grams: number('Grams of that amount.'),
        }),
      },
      meal: MEAL,
      time: TIME,
      day: DAY,
    }),
  },
  water: {
    type: 'array',
    items: object({
      ml: number('Millilitres of water.'),
      time: TIME,
      day: DAY,
    }),
  },
  supplements: {
    type: 'array',
    items: object({
      ref: string('Ref of the matching supplement ("s2").'),
      amount: number('Number of doses; 1 when not said.'),
      meal: MEAL,
      time: TIME,
      day: DAY,
    }),
  },
  sets: {
    type: 'array',
    items: object({
      said: string("The user's own words for this exercise, short."),
      workout_ref: string('Ref of the workout the sets belong to ("w1").'),
      exercise_ref: string('Ref of the exercise in that workout ("e3"); "" when it is not in that workout.'),
      exercise_name: string('Exercise name in English as in a gym library ("Dips", "Barbell Bench Press").'),
      sets: {
        type: 'array',
        items: object({
          reps: number('Repetitions of this set.'),
          weight_kg: number('Weight in kg; -1 for bodyweight or when not said.'),
          rir: number('Reps in reserve when said; -1 otherwise.'),
        }),
      },
      day: DAY,
    }),
  },
  answer: object({
    headline: string('Only when the message asks a question: the key number or fact, very short ("44 g proteinë"); "" otherwise.'),
    text: string('Only for a question: one to three short sentences from the Facts; "" otherwise.'),
  }),
  not_understood: {
    type: 'array',
    items: string("Parts of the message that are not food, water, a known supplement, sets or a question, in the user's words."),
  },
})

const INSTRUCTIONS = `You turn a gym-goer's short message about what they ate, drank, took or trained into diary rows, and answer their questions about their own day. The message is usually Albanian, sometimes English, often typed fast or dictated by voice, without punctuation or diacritics ("hengra" = "hëngra", "dreke" = "drekë"). Return only JSON in the given schema.

Split the message into foods, water, supplements, gym sets and a question. Record only what the user says they ate, drank, took or did; never add anything. Anything else (feelings, plans, chat) goes to not_understood, in the user's words.

Foods
- Match each food to the user's known foods by meaning, not spelling: "tost" or "dy feta buke" can be "Bukë integrale"; "vezë", "veze", "eggs" are the same food. When one matches, set ref and leave the four *_100 values at -1: the app has its own values.
- When no known food matches, set ref to "" and give typical values per 100 g of the food as eaten (cooked, with skin when the user says so), as in USDA FoodData Central. Use a short, clean name in the user's language.
- Amount: use the grams the user gives. For a count, multiply by the usual portion of the known food ("2 vezë" with "1 copë = 50 g" → 100 g) or by a typical piece size. For a vague amount ("gjysmë pule", "një pjatë", "pak") estimate the grams and set vague_amount to true. When there is no amount at all and the food has no usual single portion (bread loaf cake, pasta, rice, meat), set grams to -1 and give 3 options in the user's language, small to large ("1 fetë" 80, "2 feta" 160, "3 feta" 240). A food eaten as one unit ("një banane", "një jogurt") is not missing: use one unit.
- A protein shake or protein powder ("proteinën", "whey", "shake") is a supplement when a known supplement matches, not a food.

Water
- One glass is 250 ml, one small bottle 500 ml, one large bottle 1500 ml. "dy gota ujë" → 500 ml.

Supplements
- Match the user's known supplements by meaning ("kreatinën" → Kreatinë). amount is the number of doses, 1 when not said ("10 g kreatinë" with a 5 g dose → 2).
- A supplement the user does not have in the list goes to not_understood.

Sets (workouts)
- The user may report gym sets ("dje bëra bench 3×10 me 60 kg"). Put them in sets, one row per set: "3×10 me 60 kg" → three rows of 10 reps at 60 kg; "10, 8, 6 me 80" → rows 10, 8, 6 at 80 kg. Bodyweight or no weight → weight_kg -1. rir only when said ("2 në rezervë" → 2).
- workout_ref: the workout with that day's date ("dje" → yesterday's date) that is done or open; when there is none for that day, the workout with status next. exercise_ref: the matching exercise of that workout by meaning ("bench" → "Barbell Bench Press"); "" when it is not in that workout, with its usual English name in exercise_name.

Questions (coach)
- When the message asks something ("sa proteinë më mbetet?", "çfarë stërvitje kam nesër?"), answer it in answer, in the user's language, only from the Facts in the message: headline is the key number or fact, text is one to three short sentences with the numbers that matter and, when useful, one concrete next step from the user's own plan. When the Facts do not hold the answer, say so plainly. No medical advice: for pain, injury, illness or medication, say to ask a doctor. A message can both log something and ask something.
- When there is no question, headline and text are "".

Time, meal and day
- time: only a clock time the user gives ("në 12:00", "ora 7" → "07:00", "në 9 të darkës" → "21:00"). Never guess a time.
- meal: only when the user names a meal: "mëngjes" → breakfast_1, "drekë" → lunch, "darkë" → dinner, "para gjumit" → bedtime, "para stërvitjes" → pre_workout, "pas stërvitjes" → post_workout, "snack" with a time of day → snack_am or snack_pm. When the user gives only a time, leave meal "" (the app picks the nearest meal). Each item keeps the time or meal said for it; an item without its own time takes the time or meal said for the group it belongs to ("në darkë gjysmë pule dhe panetone": both dinner).
- day: "dje" or "yesterday" → yesterday; otherwise today.

Conversation
- When there are earlier messages, your earlier turns are questions about an amount and the last message answers them or adds more. Return only the rows the last message answers or adds, never the earlier rows again: the answered food keeps the same name, with the grams now known ("dy feta" → "Panetone", 160 g).

Examples (known foods f1 "Bukë integrale" 1 fetë = 32 g, f2 "Vezë" 1 copë = 50 g; supplements s1 "Gold Standard Whey", s2 "Kreatinë")
- "Proteinën e mora në 07:00" → supplements [{ref s1, amount 1, time "07:00"}].
- "në 12:00 hëngra dy tost me dy vezë" → foods [{ref f1, grams 64, portion "2 feta", time "12:00"}, {ref f2, grams 100, portion "2 copë", time "12:00"}].
- "Në darkë gjysmë pule dhe panetone" → foods [{ref "", name "Pulë e pjekur me lëkurë", grams 300, vague_amount true, meal dinner, kcal_100 239, protein_100 27.3, carbs_100 0, fat_100 13.6}, {ref "", name "Panetone", grams -1, options 1 fetë 80 / 2 feta 160 / 3 feta 240, meal dinner, kcal_100 362}].
- "Mora edhe kreatinën" → supplements [{ref s2, amount 1}].
- "dje piva 2 litra ujë" → water [{ml 2000, day yesterday}].
- With workout w1 done on 2026-11-16 (e1 Barbell Bench Press) and food day 2026-11-17: "dje bëra bench 3×10 me 60 kg dhe dips 3×12" → sets [{workout_ref w1, exercise_ref e1, 3 rows reps 10 weight_kg 60, day yesterday}, {workout_ref w1, exercise_ref "", exercise_name "Dips", 3 rows reps 12 weight_kg -1, day yesterday}].
- With Facts "Protein: 132 of 176 g; Bedtime plan: cottage cheese 230 g (28 g protein)": "Sa proteinë më mbetet sot?" → answer {headline "44 g proteinë", text "Ke 132 nga 176 g. Gjiza e planit para gjumit jep 28 g; të mbeten 16 g pas saj."}.
- "u lodha shumë sot" → not_understood ["u lodha shumë sot"].`

/** Një rresht i vetëm: rreshtat e rinj bëhen hapësirë dhe | (ndarësi i listave) bëhet /. */
const clean = (value: string, max: number) => value.replace(/\|/g, '/').replace(/\s+/g, ' ').trim().slice(0, max)

function contextText(context: ParseContext): string {
  const meals = context.meals.map((meal) => `${meal.key} | ${meal.name} | ${meal.time}`)
  const foods = context.foods.map((food) => `${food.ref} | ${food.name}${food.portion ? ` | ${food.portion}` : ''}`)
  const supplements = context.supplements.map((supplement) => `${supplement.ref} | ${supplement.name} | ${supplement.dose}`)
  const workouts = context.workouts.map((workout) => `${workout.ref} | ${workout.date ?? 'next'} | ${workout.status} | ${workout.label} | ${workout.exercises.map((exercise) => `${exercise.ref} ${exercise.name}`).join('; ')}`)
  return [
    `User language: ${context.language === 'en' ? 'English' : 'Albanian'}.`,
    `Meals today (key | name | time):\n${meals.join('\n') || 'none'}`,
    `Known foods (ref | name | usual portion):\n${foods.join('\n') || 'none'}`,
    `Supplements (ref | name | one dose):\n${supplements.join('\n') || 'none'}`,
    `Workouts (ref | date | status | name | exercises):\n${workouts.join('\n') || 'none'}`,
  ].join('\n\n')
}

export function buildRequest(request: ParseRequest) {
  const history = (request.history ?? []).map((turn) => ({
    role: turn.role,
    content: turn.text,
  }))
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text' as const, text: INSTRUCTIONS },
      // Konteksti i përdoruesit ndryshon rrallë: pika e cache-it në fund të tij mban edhe udhëzimet.
      {
        type: 'text' as const,
        text: contextText(request.context),
        cache_control: { type: 'ephemeral' as const },
      },
    ],
    messages: [
      ...history,
      {
        role: 'user' as const,
        content: `Food day: ${request.date}. Now: ${request.time}.${request.facts ? `\n\nFacts:\n${request.facts}` : ''}\n\nMessage: ${request.text}`,
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: PARSE_SCHEMA },
      effort: EFFORT,
    },
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max: number) => (typeof value === 'string' ? clean(value, max) : '')
const list = (value: unknown) => (Array.isArray(value) ? value.filter(isObject) : [])

/** "7:00" → "07:00"; null për çdo gjë që nuk është orë. */
function clock(value: unknown): string | null {
  const match = typeof value === 'string' ? CLOCK.exec(value.trim()) : null
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null
}

export type RequestCheck = { ok: true; request: ParseRequest } | { ok: false; error: 'bad_request' | 'too_long' }

/** Kërkesa e telefonit, e kontrolluar dhe e pastruar para se të shkojë te modeli. */
export function parseRequest(raw: unknown): RequestCheck {
  if (!isObject(raw) || typeof raw.text !== 'string' || !isObject(raw.context)) return { ok: false, error: 'bad_request' }
  const message = raw.text.trim()
  if (!message) return { ok: false, error: 'bad_request' }
  if (message.length > MAX_TEXT) return { ok: false, error: 'too_long' }
  const time = clock(raw.time)
  if (typeof raw.date !== 'string' || !DATE.test(raw.date) || !time) return { ok: false, error: 'bad_request' }
  const context = raw.context
  const meals: ContextMeal[] = list(context.meals)
    .filter((meal) => (MEAL_KEYS as readonly unknown[]).includes(meal.key) && clock(meal.time))
    .map((meal) => ({
      key: meal.key as ParseMealKey,
      name: text(meal.name, 40),
      time: clock(meal.time)!,
    }))
  const foods: ContextFood[] = list(context.foods)
    .filter((food) => typeof food.ref === 'string' && text(food.name, 80))
    .slice(0, MAX_FOODS)
    .map((food) => ({
      ref: text(food.ref, 8),
      name: text(food.name, 80),
      portion: text(food.portion, 40) || null,
    }))
  const supplements: ContextSupplement[] = list(context.supplements)
    .filter((supplement) => typeof supplement.ref === 'string' && text(supplement.name, 80))
    .slice(0, MAX_SUPPLEMENTS)
    .map((supplement) => ({
      ref: text(supplement.ref, 8),
      name: text(supplement.name, 80),
      dose: text(supplement.dose, 40),
    }))
  const workouts: ContextWorkout[] = list(context.workouts)
    .filter((workout) => typeof workout.ref === 'string' && ['done', 'open', 'next'].includes(workout.status as string))
    .slice(0, MAX_WORKOUTS)
    .map((workout) => ({
      ref: text(workout.ref, 8),
      date: typeof workout.date === 'string' && DATE.test(workout.date) ? workout.date : null,
      label: text(workout.label, 80),
      status: workout.status as ContextWorkout['status'],
      exercises: list(workout.exercises)
        .filter((exercise) => typeof exercise.ref === 'string' && text(exercise.name, 80))
        .slice(0, 20)
        .map((exercise) => ({
          ref: text(exercise.ref, 8),
          name: text(exercise.name, 80),
        })),
    }))
  const facts = typeof raw.facts === 'string' ? raw.facts.trim().slice(0, MAX_FACTS) : ''
  const turns: ParseTurn[] = list(raw.history)
    .filter((turn) => (turn.role === 'user' || turn.role === 'assistant') && typeof turn.text === 'string' && turn.text.trim())
    .map((turn) => ({
      role: turn.role as ParseTurn['role'],
      text: (turn.text as string).trim().slice(0, 1_500),
    }))
  // Gjashtë të fundit, duke filluar me përdoruesin (Messages API e do të parin "user").
  let history = turns.slice(-MAX_HISTORY)
  while (history.length && history[0].role !== 'user') history = history.slice(1)
  return {
    ok: true,
    request: {
      text: message,
      date: raw.date,
      time,
      context: {
        language: context.language === 'en' ? 'en' : 'sq',
        meals,
        foods,
        supplements,
        workouts,
      },
      facts,
      history,
    },
  }
}

const inRange = (value: unknown, min: number, max: number): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? Math.round(value * 10) / 10 : null)
const day = (value: unknown): DayOffset => (value === 'yesterday' ? -1 : 0)
const meal = (value: unknown): ParseMealKey | null => ((MEAL_KEYS as readonly unknown[]).includes(value) ? (value as ParseMealKey) : null)

function per100(raw: Record<string, unknown>): Per100 | null {
  const kcal = inRange(raw.kcal_100, 0, 900)
  const proteinG = inRange(raw.protein_100, 0, 100)
  const carbsG = inRange(raw.carbs_100, 0, 100)
  const fatG = inRange(raw.fat_100, 0, 100)
  if (kcal === null || proteinG === null || carbsG === null || fatG === null) return null
  return { kcal, proteinG, carbsG, fatG }
}

export type Outcome = { ok: true; draft: Draft } | { ok: false; error: 'unreadable' }

/** Përgjigja e API-së (pa stream) si draft: referencat që s'ekzistojnë hiqen, vlerat jashtë kufijve bien. */
export function interpret(body: unknown, context: ParseContext): Outcome {
  const content = (body as { content?: { type: string; text?: string }[] } | null)?.content ?? []
  const answer = content.find((block) => block.type === 'text')?.text ?? ''
  let raw: unknown
  try {
    raw = JSON.parse(answer)
  } catch {
    return { ok: false, error: 'unreadable' }
  }
  if (!isObject(raw)) return { ok: false, error: 'unreadable' }
  const foodsByRef = new Map(context.foods.map((food) => [food.ref, food]))
  const supplementRefs = new Set(context.supplements.map((supplement) => supplement.ref))
  const notUnderstood: string[] = []
  for (const part of Array.isArray(raw.not_understood) ? raw.not_understood : []) {
    const said = text(part, 200)
    if (said) notUnderstood.push(said)
  }

  const foods: DraftFood[] = []
  for (const item of list(raw.foods).slice(0, 20)) {
    const said = text(item.said, 200)
    const known = typeof item.ref === 'string' ? foodsByRef.get(item.ref) : undefined
    const values = known ? null : per100(item)
    const name = known ? known.name : text(item.name, 120)
    if (!known && (!values || !name)) {
      if (said || name) notUnderstood.push(said || name)
      continue
    }
    const grams = inRange(item.grams, 1, 3_000)
    const options =
      grams === null
        ? list(item.options)
            .flatMap((option) => {
              const label = text(option.label, 40)
              const optionGrams = inRange(option.grams, 1, 3_000)
              return label && optionGrams !== null ? [{ label, grams: optionGrams }] : []
            })
            .slice(0, 3)
        : []
    foods.push({
      said: said || name,
      ref: known ? known.ref : null,
      name,
      grams,
      portion: text(item.portion, 60),
      estimated: grams !== null && item.vague_amount === true,
      per100: values,
      options,
      meal: meal(item.meal),
      time: clock(item.time),
      day: day(item.day),
    })
  }

  const water: DraftWater[] = list(raw.water)
    .slice(0, 10)
    .flatMap((item) => {
      const ml = inRange(item.ml, 50, 3_000)
      return ml === null ? [] : [{ ml, time: clock(item.time), day: day(item.day) }]
    })

  const supplements: DraftSupplement[] = list(raw.supplements)
    .slice(0, 20)
    .flatMap((item) => {
      const amount = inRange(item.amount, 0.25, 10)
      if (typeof item.ref !== 'string' || !supplementRefs.has(item.ref) || amount === null) return []
      return [
        {
          ref: item.ref,
          amount,
          meal: meal(item.meal),
          time: clock(item.time),
          day: day(item.day),
        },
      ]
    })

  const workoutsByRef = new Map(context.workouts.map((workout) => [workout.ref, workout]))
  const sets: DraftExercise[] = []
  for (const item of list(raw.sets).slice(0, 20)) {
    const said = text(item.said, 200)
    const workout = typeof item.workout_ref === 'string' ? workoutsByRef.get(item.workout_ref) : undefined
    const exercise = workout?.exercises.find((candidate) => candidate.ref === item.exercise_ref)
    const rows: DraftSet[] = list(item.sets)
      .slice(0, 20)
      .flatMap((set) => {
        const reps = inRange(set.reps, 1, 200)
        if (reps === null) return []
        return [
          {
            reps: Math.round(reps),
            weightKg: inRange(set.weight_kg, 0, 1_000),
            rir: set.rir === -1 ? null : inRange(set.rir, 0, 10),
          },
        ]
      })
    const name = exercise?.name ?? text(item.exercise_name, 80)
    if (!workout || !rows.length || !name) {
      if (said || name) notUnderstood.push(said || name)
      continue
    }
    sets.push({
      said: said || name,
      workoutRef: workout.ref,
      exerciseRef: exercise?.ref ?? null,
      exerciseName: name,
      sets: rows,
      day: day(item.day),
    })
  }

  const rawAnswer = isObject(raw.answer) ? raw.answer : {}
  const headline = text(rawAnswer.headline, 80)
  const answerText = typeof rawAnswer.text === 'string' ? rawAnswer.text.trim().slice(0, 600) : ''
  const coach: CoachAnswer | null = headline || answerText ? { headline, text: answerText } : null

  return {
    ok: true,
    draft: { foods, water, supplements, sets, answer: coach, notUnderstood },
  }
}
