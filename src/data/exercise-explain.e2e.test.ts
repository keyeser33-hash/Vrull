// @vitest-environment node
// Prova e "Shpjegoje më shumë" me AI-në e vërtetë (V56; MESIMET, AI-ja: çdo veçori me AI provohet me të dhëna
// të vërteta para lëshimit). Dërgon te funksioni `exercise-explain` kërkesën që ndërton app-i, me udhëzuesin
// e paketuar: Bench Press shqip, Squat anglisht dhe një ushtrim pa udhëzues shqip. Tregon paragrafët, koston
// dhe kohën. Kërkon një përdorues prove të përkohshëm, që krijohet dhe fshihet jashtë provës (SQL), vetëm kur
// pronari është i pranishëm.
//   E2E_EMAIL=… E2E_PASSWORD=… npx vitest run src/data/exercise-explain.e2e.test.ts
import { createClient } from '@supabase/supabase-js'
import { guideFor } from '@/program/exercise-guide-data'
import { explainRequest, explainResultFrom, type ExplainSubject } from './exercise-explain'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase'

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const email = env.E2E_EMAIL
const password = env.E2E_PASSWORD

const subject = (key: string, name: string, primary: string[], secondary: string[], equipment: string | null, guideName: string | null): ExplainSubject => ({
  key,
  name,
  primary,
  secondary,
  equipment,
  guide: guideName ? guideFor({ libraryId: key, name: guideName }) : null,
})

describe.skipIf(!email || !password)('"Shpjegoje më shumë" me AI-në e vërtetë', { timeout: 120_000 }, () => {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

  beforeAll(async () => {
    const { error } = await client.auth.signInWithPassword({ email: email!, password: password! })
    if (error) throw error
  })

  const cases = [
    { label: 'Bench Press, shqip', language: 'sq' as const, subject: subject('Barbell_Bench_Press_-_Medium_Grip', 'Bench Press', ['Gjoksi'], ['Shpatullat', 'Tricepsi'], 'shufër', 'Bench Press') },
    { label: 'Squat, anglisht', language: 'en' as const, subject: subject('Barbell_Squat', 'Squat', ['Quadriceps'], ['Glutes', 'Hamstrings'], 'barbell', 'Squat') },
    { label: 'pa udhëzues, shqip', language: 'sq' as const, subject: subject('Arnold_Dumbbell_Press', 'Arnold Dumbbell Press', ['Supet'], ['Tricepsi'], 'shtangë dore', null) },
  ]

  for (const { label, language, subject: item } of cases) {
    it(label, async () => {
      const request = explainRequest(item, language)
      // Udhëzuesi i paketuar shkon vërtet si kontekst, përndryshe prova do të provonte rastin pa udhëzues.
      if (label !== 'pa udhëzues, shqip') expect(request.guide).not.toBeNull()
      const started = Date.now()
      const { data, error } = await client.functions.invoke('exercise-explain', { body: request })
      const status = error ? ((error as { context?: Response }).context?.status ?? null) : 200
      const body = error ? await (error as { context?: Response }).context?.json().catch(() => null) : data
      const result = explainResultFrom(status, body)
      console.log(`\n== ${label} (udhëzuesi: ${request.guide ? Object.keys(request.guide).join(', ') : 'asnjë'}) · ${Date.now() - started} ms`)
      console.log(JSON.stringify(body?.usage ?? body, null, 1))
      if (result.ok) result.paragraphs.forEach((paragraph, index) => console.log(`${index + 1}. ${paragraph}`))
      expect(result).toMatchObject({ ok: true })
      if (!result.ok) return
      expect(result.paragraphs.length).toBeGreaterThanOrEqual(3)
      expect(result.paragraphs.length).toBeLessThanOrEqual(6)
      const text = result.paragraphs.join(' ')
      expect(text).not.toMatch(/https?:\/\/|\bet al\b|!/)
      if (language === 'sq') expect(text).toMatch(/[ëç]/)
    })
  }
})
