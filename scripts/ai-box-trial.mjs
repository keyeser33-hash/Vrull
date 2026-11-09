// Prova e kutisë së AI-së me AI-në e vërtetë (V40, V2-E2-13; MESIMET: çdo veçori me AI provohet me të
// dhëna të vërteta para lëshimit). Dërgon mesazhet shembull te funksioni log-parse me një përdorues prove
// të përkohshëm dhe tregon draftin, koston dhe cache-in.
//
//   E2E_EMAIL=… E2E_PASSWORD=… node scripts/ai-box-trial.mjs
//
// Përdoruesi i provës krijohet dhe fshihet jashtë skriptit (SQL), vetëm kur pronari është i pranishëm.
const URL = process.env.SUPABASE_URL ?? 'https://hxwkyhfqcadtipkpopnq.supabase.co'
const KEY = 'sb_publishable_ifgYyLvgDITa1NZo_lCVZw_SVLHlwv1'
const { E2E_EMAIL: email, E2E_PASSWORD: password } = process.env
if (!email || !password) {
  console.log('Pa E2E_EMAIL dhe E2E_PASSWORD: prova kapërcehet.')
  process.exit(0)
}

// Konteksti si e ndërton app-i për pronarin (orari: zgjimi 08:20, stërvitja 21:00, gjumi 01:00).
const CONTEXT = {
  language: 'sq',
  meals: [
    ['breakfast_1', 'Mëngjesi 1', '08:20'],
    ['breakfast_2', 'Mëngjesi 2', '09:05'],
    ['snack_am', 'Snack paradite', '11:50'],
    ['lunch', 'Dreka', '14:20'],
    ['snack_pm', 'Snack pasdite', '17:20'],
    ['dinner', 'Darka', '19:50'],
    ['pre_workout', 'Para stërvitjes', '20:30'],
    ['post_workout', 'Pas stërvitjes', '22:30'],
    ['bedtime', 'Para gjumit', '00:30'],
  ].map(([key, name, time]) => ({ key, name, time })),
  foods: [
    ['f1', 'Bukë integrale', '1 fetë = 32 g'],
    ['f2', 'Vezë', '1 copë = 50 g'],
    ['f3', 'Gjoks pule', null],
    ['f4', 'Oriz kaf', null],
    ['f5', 'Tërshërë', '1 filxhan = 80 g'],
    ['f6', 'Gjizë me pak yndyrë', null],
    ['f7', 'Jogurt grek pa yndyrë', '1 kupë = 170 g'],
    ['f8', 'Brokoli', null],
    ['f9', 'Banane', '1 copë = 118 g'],
    ['f10', 'Bajame', '1 grusht = 28 g'],
    ['f11', 'Salmon', null],
    ['f12', 'Patate e ëmbël', null],
  ].map(([ref, name, portion]) => ({ ref, name, portion })),
  supplements: [
    { ref: 's1', name: 'Gold Standard 100% Whey', dose: '1 lugë = 30 g' },
    { ref: 's2', name: 'Kreatinë', dose: '5 g' },
    { ref: 's3', name: 'Multivitaminë', dose: '1 tabletë' },
  ],
}

const FIRST = 'Proteinën e mora në 07:00, në 12:00 hëngra dy tost me dy vezë. Në darkë gjysmë pule dhe panetone. Mora edhe kreatinën.'
const CASES = [
  { text: FIRST, time: '22:40' },
  { text: FIRST, time: '22:41', note: 'i njëjti mesazh: cache-i duhet lexuar' },
  { text: 'ne dreke hengra 200 g pule me oriz dhe piva dy gota uje', time: '15:10' },
  { text: 'dje para gjumit 250 g gjize', time: '09:30' },
  { text: 'nje banane dhe nje grusht bajame, pastaj shkova ne palester', time: '17:40' },
  { text: 'dy feta', time: '22:42', history: [{ role: 'user', text: FIRST }, { role: 'assistant', text: 'Sa panetone hëngre?' }] },
]

const auth = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
if (!auth.ok) throw new Error(`Hyrja dështoi: ${auth.status}`)
const { access_token: token } = await auth.json()

let total = 0
for (const item of CASES) {
  const started = Date.now()
  const response = await fetch(`${URL}/functions/v1/log-parse`, {
    method: 'POST',
    headers: { apikey: KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ text: item.text, date: '2026-11-18', time: item.time, context: CONTEXT, history: item.history ?? [] }),
  })
  const body = await response.json()
  console.log(`\n### ${item.text}${item.note ? ` (${item.note})` : ''}`)
  console.log(`status ${response.status}, ${Date.now() - started} ms`)
  if (body.usage) {
    total += body.usage.costEur
    console.log(`tokena: hyrje ${body.usage.inputTokens}, dalje ${body.usage.outputTokens}, cache shkruar ${body.usage.cacheWriteTokens}, lexuar ${body.usage.cacheReadTokens}; ${body.usage.costEur} €`)
  }
  console.log(JSON.stringify(body.draft ?? body, null, 1))
}
console.log(`\nGjithsej: ${total.toFixed(6)} €`)
