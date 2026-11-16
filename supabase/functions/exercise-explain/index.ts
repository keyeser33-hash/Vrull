// "Shpjegoje më shumë" te faqja e ushtrimit (V56, SPEC §0.3e). Merr ushtrimin (emri, muskujt, udhëzuesi i paketuar me
// app-in) dhe gjuhën, kontrollon kufirin e muajit (një për të gjitha veçoritë me AI) dhe kthen 3-6 paragrafë që
// telefoni i ruan për ushtrimin dhe gjuhën. Asnjë tekst personal nuk dërgohet e nuk ruhet; kostoja shkruhet te
// ai_usage (feature explain), edhe kur përgjigja nuk lexohet pasi AI-ja ka punuar.
//
// - Secrets: ANTHROPIC_API_KEY (i vetmi i ri; SUPABASE_URL, SUPABASE_ANON_KEY dhe SUPABASE_SECRET_KEYS vijnë vetë).
// - verify_jwt aktiv; përdoruesi lexohet nga i njëjti token. Kostoja shkruhet me çelësin sekret.
// - Kërkesa: JSON { language, exercise: { name, primary, secondary, equipment }, guide } (shared.ts).
// - Përgjigja 200: { paragraphs, usage: { inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, costEur, ms }, month }.
//   Gabimet: { error, month?, costEur? } me 400 (bad_request, too_long), 401, 429 (limit), 502 (ai_failed,
//   unreadable, timeout), 503 (not_configured).
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { limitFrom, monthStart, USD_PER_EUR, type UsageStore } from '../_shared/ai.ts'
import { runExplain } from './handler.ts'
import { API_VERSION, MODEL, parseRequest } from './logic.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

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

  const authorization = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, req.headers.get('apikey') ?? publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const userId = userData?.user?.id
  if (userError || !userId) return json({ error: 'unauthorized' }, 401)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const checked = parseRequest(raw)
  if (!checked.ok) return json({ error: checked.error }, 400)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const feature = 'explain'
  const touched = () => new Date().toISOString()
  const usage: UsageStore = {
    async reserve(month, eur) {
      const { data, error } = await admin
        .from('ai_usage')
        .insert({ user_id: userId, month, feature, model: MODEL, input_tokens: 0, output_tokens: 0, cost_usd: Math.round(eur * USD_PER_EUR * 1e6) / 1e6, cost_eur: eur })
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
  // Kufiri i personit (ai_limits, V42); pa rresht ose pa tabelë, 10 €.
  const { data: limits } = await admin.from('ai_limits').select('monthly_eur').eq('user_id', userId).is('deleted_at', null).limit(1)
  const reply = await runExplain({
    limitEur: limitFrom(limits),
    month: monthStart(new Date()),
    request: checked.request,
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
