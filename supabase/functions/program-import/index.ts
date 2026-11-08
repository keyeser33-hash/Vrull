// Importi i programit nga PDF me AI (V2-E1-11; SPEC V6, V21, V25, §19). Merr PDF-në e përdoruesit të
// hyrë, kontrollon kufirin e muajit, ia jep Claude API-së dhe kthen draftin e programit me ushtrimet ku
// AI-ja nuk ishte e sigurt. Kostoja llogaritet nga tokenat që kthen API-ja dhe ruhet te ai_usage për
// përdoruesin dhe muajin, edhe kur leximi dështon pasi AI-ja ka punuar.
//
// - Çelësi ANTHROPIC_API_KEY rri si secret i funksionit (e shton përdoruesi, §19); nuk shkon kurrë te
//   telefoni dhe nuk del në përgjigje ose në log.
// - verify_jwt mbetet aktiv: platforma pranon vetëm kërkesa me sesion të vlefshëm; funksioni e lexon
//   përdoruesin nga i njëjti token. Kostoja shkruhet me çelësin sekret (service role), sepse përdoruesi
//   e lexon vetëm (RLS te ai_usage).
// - Kërkesa: multipart/form-data me `file` (PDF, deri në 15 MB), `known` (JSON: emrat e ushtrimeve që
//   app-i njeh) dhe `language` (sq | en, për emrat e blloqeve dhe ditëve).
// - Përgjigja 200: { draft, uncertain, usage: { inputTokens, outputTokens, costEur, ms }, month }.
//   Gabimet: { error, month?, costEur? } me 400 (not_pdf, too_large, bad_request), 401, 429 (limit),
//   502 (ai_failed, unreadable, too_long, no_programme, timeout), 503 (not_configured).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  AI_MONTHLY_LIMIT_EUR,
  AI_TIMEOUT_MS,
  API_VERSION,
  buildRequest,
  costOf,
  createStreamReader,
  interpret,
  isLanguage,
  isPdf,
  MAX_PDF_BYTES,
  MODEL,
  monthStart,
  parseKnown,
  type StreamState,
  toBase64,
} from './logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const round2 = (value: number) => Math.round(value * 100) / 100

/** Çelësi sekret i projektit: i ri (SUPABASE_SECRET_KEYS.default) ose ai i vjetër (service role). */
function secretKey(): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    if (keys.default) return keys.default
  } catch {
    // Pa çelësat e rinj: mbetet çelësi i vjetër.
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
}

/** Lexon përgjigjen me stream deri në fund ose deri te koha; tokenat e numëruar mbeten edhe pas ndërprerjes. */
async function readStream(response: Response, signal: AbortSignal): Promise<{ state: StreamState; timedOut: boolean }> {
  const reader = createStreamReader()
  const decoder = new TextDecoder()
  const body = response.body!.getReader()
  try {
    while (true) {
      const { done, value } = await body.read()
      if (done) break
      reader.push(decoder.decode(value, { stream: true }))
    }
    return { state: reader.state(), timedOut: false }
  } catch (error) {
    if (signal.aborted) return { state: reader.state(), timedOut: true }
    throw error
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  const url = Deno.env.get('SUPABASE_URL')
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const secret = secretKey()
  if (!apiKey || !url || !secret) return json({ error: 'not_configured' }, 503)

  // Përdoruesi nga tokeni i sesionit (platforma e ka verifikuar me verify_jwt).
  const authorization = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, req.headers.get('apikey') ?? publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const userId = userData?.user?.id
  if (userError || !userId) return json({ error: 'unauthorized' }, 401)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const file = form.get('file')
  if (!(file instanceof File)) return json({ error: 'bad_request' }, 400)
  if (file.size > MAX_PDF_BYTES) return json({ error: 'too_large' }, 400)
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isPdf(bytes)) return json({ error: 'not_pdf' }, 400)
  const known = parseKnown(typeof form.get('known') === 'string' ? (form.get('known') as string) : null)
  const language = isLanguage(form.get('language')) ? (form.get('language') as 'sq' | 'en') : 'sq'

  // Kufiri i muajit, para thirrjes: shuma e kostove të përdoruesit këtë muaj (RLS: vetëm të vetat).
  const month = monthStart(new Date())
  const { data: rows, error: sumError } = await userClient.from('ai_usage').select('cost_eur').eq('month', month).is('deleted_at', null)
  if (sumError) return json({ error: 'ai_failed' }, 502)
  const spentBefore = (rows ?? []).reduce((sum: number, row: { cost_eur: number | string }) => sum + Number(row.cost_eur), 0)
  const monthInfo = (spent: number) => ({ month, spentEur: round2(spent), limitEur: AI_MONTHLY_LIMIT_EUR })
  if (spentBefore >= AI_MONTHLY_LIMIT_EUR) return json({ error: 'limit', month: monthInfo(spentBefore) }, 429)

  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  let state: StreamState | null = null
  let timedOut = false
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
      body: JSON.stringify(buildRequest({ pdfBase64: toBase64(bytes), known, language })),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) {
      // Kërkesa u refuzua para leximit (p.sh. PDF me fjalëkalim, mbingarkesë): AI-ja nuk harxhoi tokena.
      console.error(`program-import: Claude API ${response.status}`)
      const error = response.status === 413 ? 'too_large' : response.status === 400 ? 'unreadable' : 'ai_failed'
      return json({ error, month: monthInfo(spentBefore) }, error === 'too_large' ? 400 : 502)
    }
    ;({ state, timedOut } = await readStream(response, controller.signal))
  } catch {
    if (!controller.signal.aborted) return json({ error: 'ai_failed', month: monthInfo(spentBefore) }, 502)
    timedOut = true
  } finally {
    clearTimeout(timer)
  }
  const ms = Date.now() - started

  // Kostoja nga tokenat e kthyer, e ruajtur për përdoruesin dhe muajin.
  const cost = state ? costOf(state) : { usd: 0, eur: 0 }
  if (state && (state.inputTokens > 0 || state.outputTokens > 0)) {
    const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.from('ai_usage').insert({
      user_id: userId,
      month,
      feature: 'program_pdf',
      model: MODEL,
      input_tokens: state.inputTokens,
      output_tokens: state.outputTokens,
      cost_usd: cost.usd,
      cost_eur: cost.eur,
    })
    if (error) console.error(`program-import: kostoja nuk u ruajt (${error.code ?? 'pa kod'})`)
  }
  const spent = monthInfo(spentBefore + cost.eur)

  if (timedOut || !state) return json({ error: 'timeout', month: spent, costEur: cost.eur }, 502)
  const outcome = interpret(state)
  if (!outcome.ok) return json({ error: outcome.error, month: spent, costEur: cost.eur }, 502)
  return json({
    draft: outcome.draft,
    uncertain: outcome.uncertain,
    usage: { inputTokens: state.inputTokens, outputTokens: state.outputTokens, costEur: cost.eur, ms },
    month: spent,
  })
})
