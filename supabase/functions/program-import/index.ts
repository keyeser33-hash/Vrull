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
import { runImport, type UsageStore } from './handler.ts'
import { API_VERSION, buildRequest, isLanguage, isPdf, MAX_PDF_BYTES, MODEL, monthStart, parseKnown, toBase64, USD_PER_EUR } from './logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

  // Kufiri i muajit me rezervim, thirrja dhe kostoja: handler.ts (provat: handler.test.ts). Rreshtat e
  // ai_usage shkruhen me çelësin sekret, vetëm për përdoruesin e hyrë; përdoruesi i lexon (RLS).
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const touched = () => new Date().toISOString()
  const usage: UsageStore = {
    async reserve(month, eur) {
      const { data, error } = await admin
        .from('ai_usage')
        .insert({ user_id: userId, month, feature: 'program_pdf', model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: Math.round(eur * USD_PER_EUR * 1e6) / 1e6, cost_eur: eur })
        .select('id')
        .single()
      if (error || !data) throw new Error(`rezervimi: ${error?.code ?? 'pa rresht'}`)
      return data.id as string
    },
    async spent(month, except) {
      const { data, error } = await admin.from('ai_usage').select('cost_eur').eq('user_id', userId).eq('month', month).is('deleted_at', null).neq('id', except)
      if (error) throw new Error(`shuma: ${error.code ?? 'pa kod'}`)
      return (data ?? []).reduce((sum: number, row: { cost_eur: number | string }) => sum + Number(row.cost_eur), 0)
    },
    async settle(id, cost) {
      const { error } = await admin
        .from('ai_usage')
        .update({ input_tokens: cost.inputTokens, output_tokens: cost.outputTokens, cost_usd: cost.usd, cost_eur: cost.eur, updated_at: touched() })
        .eq('id', id)
      if (error) throw new Error(`kostoja: ${error.code ?? 'pa kod'}`)
    },
    async cancel(id) {
      const now = touched()
      const { error } = await admin.from('ai_usage').update({ deleted_at: now, updated_at: now }).eq('id', id)
      if (error) throw new Error(`heqja: ${error.code ?? 'pa kod'}`)
    },
  }
  const reply = await runImport({
    month: monthStart(new Date()),
    request: buildRequest({ pdfBase64: toBase64(bytes), known, language }),
    usage,
    callClaude: (request, signal) =>
      fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': API_VERSION },
        body: JSON.stringify(request),
        signal,
      }),
  })
  return json(reply.body, reply.status)
})
