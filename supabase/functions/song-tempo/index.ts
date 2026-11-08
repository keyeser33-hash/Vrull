// Tempo e këngës nga GetSongBPM (SPEC V29, V2-E1-12, docs/research/muzika.md §3). Çelësi
// GETSONGBPM_API_KEY rri si secret i funksionit (Edge Functions › Secrets) dhe nuk shkon kurrë te
// telefoni. verify_jwt mbetet aktiv: platforma pranon vetëm kërkesa me sesion të vlefshëm.
// Kushti i GetSongBPM: lidhja te GetSongBPM.com në app, nën tempon që vjen prej tij.
//
// POST { title, artist? } → { bpm, url, configured }: bpm null kur kënga nuk u gjet ose çelësi mungon
// (configured: false). Kufiri i GetSongBPM-it kthehet si 429, çdo gabim tjetër si 502: app-i kalon te
// AcousticBrainz dhe nuk e ruan si "nuk u gjet".
import { bestMatch, parseRequest, searchUrl } from './getsongbpm.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Metoda nuk lejohet.' }, 405)
  let body: unknown = null
  try {
    body = await req.json()
  } catch {
    // Trupi mungon ose nuk është JSON.
  }
  const request = parseRequest(body)
  if (!request) return json({ error: 'Titulli duhet të ketë 1 deri në 200 shkronja.' }, 400)

  const key = Deno.env.get('GETSONGBPM_API_KEY')
  if (!key) return json({ bpm: null, url: null, configured: false })

  let response: Response
  try {
    response = await fetch(searchUrl(request.title, request.artist), {
      headers: { 'X-API-KEY': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
  } catch {
    return json({ error: 'GetSongBPM nuk po përgjigjet.' }, 502)
  }
  if (response.status === 404) return json({ bpm: null, url: null, configured: true })
  if (!response.ok) return json({ error: `GetSongBPM: ${response.status}` }, response.status === 429 ? 429 : 502)
  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    return json({ error: 'GetSongBPM ktheu një përgjigje të palexueshme.' }, 502)
  }
  const match = bestMatch(data, request.title, request.artist)
  return json({ bpm: match?.bpm ?? null, url: match?.url ?? null, configured: true })
})
