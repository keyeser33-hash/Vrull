// Kufiri i AI-së te Admini (V42, V2-E2-17; SPEC §9 "Kufiri i AI-së"). Vetëm admini (app_metadata.vrull_admin,
// që përdoruesi nuk e ndryshon dot vetë) e thërret: lista e personave me koston e muajit sipas veçorisë dhe
// kufirin, ose një kufi i ri për një person. ai_limits e shkruan vetëm ky funksion, me çelësin sekret.
//
// - verify_jwt aktiv; thirrësi lexohet nga i njëjti token.
// - Kërkesa: JSON { action: 'list' } ose { action: 'set', userId, limitEur }.
// - Përgjigja 200: { month, people: AdminPerson[] }. Gabimet: 400 bad_request, 401 unauthorized,
//   403 forbidden (jo admin), 502 failed, 503 not_configured.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { AI_MONTHLY_LIMIT_EUR, monthStart } from '../_shared/ai.ts'
import { parseAdminRequest, summarize } from './logic.ts'

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

  const url = Deno.env.get('SUPABASE_URL')
  const publishable = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const secret = secretKey()
  if (!url || !secret) return json({ error: 'not_configured' }, 503)

  const authorization = req.headers.get('Authorization') ?? ''
  const userClient = createClient(url, req.headers.get('apikey') ?? publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const caller = userData?.user
  if (userError || !caller) return json({ error: 'unauthorized' }, 401)
  // app_metadata vjen nga serveri (getUser), jo nga token-i: përdoruesi nuk e shkruan dot.
  if (caller.app_metadata?.vrull_admin !== true) return json({ error: 'forbidden' }, 403)

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const request = parseAdminRequest(raw)
  if (!request) return json({ error: 'bad_request' }, 400)

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
  const now = () => new Date().toISOString()
  if (request.action === 'set') {
    const { data: existing, error: readError } = await admin.from('ai_limits').select('id').eq('user_id', request.userId).is('deleted_at', null).limit(1)
    if (readError) return json({ error: 'failed' }, 502)
    const { error } = existing?.length
      ? await admin.from('ai_limits').update({ monthly_eur: request.limitEur, updated_at: now() }).eq('id', existing[0].id)
      : await admin.from('ai_limits').insert({ user_id: request.userId, monthly_eur: request.limitEur })
    if (error) return json({ error: 'failed' }, 502)
  }

  const month = monthStart(new Date())
  const [{ data: list, error: listError }, { data: usage, error: usageError }, { data: limits, error: limitsError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin.from('ai_usage').select('user_id, feature, cost_eur, input_tokens, output_tokens').eq('month', month).is('deleted_at', null),
    admin.from('ai_limits').select('user_id, monthly_eur').is('deleted_at', null),
  ])
  if (listError || usageError || limitsError) return json({ error: 'failed' }, 502)
  const people = summarize({
    people: (list?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? null,
      name: (user.user_metadata?.name as string | undefined) ?? (user.user_metadata?.full_name as string | undefined) ?? null,
      isAdmin: user.app_metadata?.vrull_admin === true,
    })),
    usage: usage ?? [],
    limits: limits ?? [],
    defaultLimitEur: AI_MONTHLY_LIMIT_EUR,
  })
  return json({ month, people })
})
