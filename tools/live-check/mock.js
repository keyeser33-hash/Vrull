// Supabase i imituar për demon e Vrull-it (si te scripts/android-smoke.mjs): asnjë kërkesë nuk del nga shfletuesi.
// Sesioni i provës vendoset në localStorage, ndaj nuk shkruhet asnjë fjalëkalim.
;(function () {
  var HOST = 'smoke.invalid'
  var USER_ID = '22222222-2222-4222-8222-222222222222'
  var EMAIL = 'prove@example.com'
  var KEY = 'sb-smoke-auth-token'
  function b64url(value) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
  function session() {
    var now = Math.floor(Date.now() / 1000)
    var claims = { sub: USER_ID, exp: now + 30 * 24 * 3600, iat: now, role: 'authenticated', aud: 'authenticated', email: EMAIL }
    return {
      access_token: b64url({ alg: 'HS256', typ: 'JWT' }) + '.' + b64url(claims) + '.prove',
      token_type: 'bearer',
      expires_in: 30 * 24 * 3600,
      expires_at: now + 30 * 24 * 3600,
      refresh_token: 'prove',
      user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: { provider: 'email' }, user_metadata: {} },
    }
  }
  try {
    var stored = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (!stored || !stored.expires_at || stored.expires_at * 1000 < Date.now() + 3600 * 1000) localStorage.setItem(KEY, JSON.stringify(session()))
  } catch (e) {}
  if (/index\.html$/.test(location.pathname)) history.replaceState(null, '', location.pathname.replace(/index\.html$/, ''))

  var clock = Date.parse('2026-11-15T06:00:00.000Z')
  window.__mockLog = []
  function json(status, body) {
    return new Response(status === 204 ? null : JSON.stringify(body), { status: status, headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/0' } })
  }
  function parse(body) {
    try {
      return typeof body === 'string' ? JSON.parse(body) : null
    } catch (e) {
      return null
    }
  }
  function reply(url, method, body) {
    var path = url.pathname
    var data = parse(body)
    if (path.indexOf('/auth/v1/token') === 0) return json(200, session())
    if (path.indexOf('/auth/v1/user') === 0) return json(200, session().user)
    if (path.indexOf('/auth/v1/logout') === 0) return json(204, null)
    if (/app-releases\/latest\.json$/.test(path)) return json(200, { version: '0.0.1', apk: 'x.apk', sha256: '0'.repeat(64), bytes: 1, notes: [], publishedAt: '2026-01-01T00:00:00Z' })
    if (path.indexOf('/storage/v1/object/') === 0) return json(200, method === 'DELETE' ? [] : { Key: path.replace('/storage/v1/object/', ''), Id: 'prove' })
    if (path === '/functions/v1/log-parse') {
      var usage = { inputTokens: 2500, outputTokens: 170, cacheWriteTokens: 0, cacheReadTokens: 6200, costEur: 0.0004, ms: 1500 }
      var month = { month: '2026-11-01', spentEur: 0.01, limitEur: 40 }
      var food = { said: 'pulë e pjekur', ref: null, name: 'Pulë e pjekur', grams: 200, portion: '', estimated: true, per100: { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 }, options: [], meal: 'lunch', time: null, day: 0 }
      return json(200, { draft: { foods: [food], water: [{ ml: 500, time: null, day: 0 }], supplements: [], sets: [], answer: null, notUnderstood: [] }, usage: usage, month: month })
    }
    if (path === '/functions/v1/exercise-explain') {
      if (window.__explainStatus) return json(window.__explainStatus, { error: window.__explainError || 'ai_failed' })
      var en = data && data.language === 'en'
      var paras = en
        ? ['The bench press works because the chest, front shoulders and triceps push together against a fixed path.', 'It should feel like a steady push from the chest, with your shoulder blades pulled back and your feet planted.', 'Beginners often bounce the bar or flare the elbows wide; slow down and keep the elbows a little tucked.']
        : ['Shtytja në stol funksionon sepse gjoksi, supet e para dhe tricepsi shtyjnë bashkë në një rrugë të qëndrueshme.', 'Duhet ta ndiesh si një shtytje të qetë nga gjoksi, me shpatullat të mbledhura pas dhe këmbët të ngulura.', 'Fillestarët shpesh e kërcejnë shufrën te gjoksi ose i hapin bërrylat shumë; ngadalëso dhe mbaji bërrylat pak afër trupit.']
      return json(200, { paragraphs: paras, usage: { costEur: 0.0011 }, month: { month: '2026-11-01', spentEur: 0.02, limitEur: 40 } })
    }
    if (path.indexOf('/functions/v1/') === 0) return json(200, {})
    if (path.indexOf('/rest/v1/rpc/') === 0) return json(200, null)
    if (path.indexOf('/rest/v1/') === 0) {
      if (method === 'GET' || method === 'HEAD') return json(200, [])
      if (method === 'DELETE') return json(200, [])
      var rows = (Array.isArray(data) ? data : [data]).filter(Boolean).map(function (row) {
        clock += 1000
        var copy = {}
        for (var k in row) copy[k] = row[k]
        copy.server_updated_at = new Date(clock).toISOString().replace('Z', '+00:00')
        return copy
      })
      window.__mockLog.push(method + ' ' + path + ' ' + rows.length)
      return json(201, rows)
    }
    return json(404, { message: 'not found' })
  }
  var realFetch = window.fetch.bind(window)
  window.fetch = function (input, init) {
    var url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    if (url.hostname !== HOST) return realFetch(input, init)
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase()
    var body = init && init.body
    return Promise.resolve(body instanceof Blob ? body.text() : body).then(function (text) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          resolve(reply(url, method, text))
        }, 60)
      })
    })
  }
})()
