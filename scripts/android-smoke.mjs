// Prova e APK-së në një Android virtual (emulator), përmes adb dhe Chrome DevTools Protocol (V2-E1-16).
// Përdorimi: node scripts/android-smoke.mjs <dosja> <v1.apk> <v2.apk> <v3.apk> [muzika.apk]
// - v1: 0.16.0 nga tag-u (UI e v1), v2 dhe v3: kjo degë me dy versione më të larta. Të gjitha build-e debug me
//   të njëjtin çelës, të drejtuara te https://smoke.invalid (VITE_SUPABASE_URL): çdo kërkesë drejt Supabase
//   kapet këtu me CDP (Fetch) dhe merr një përgjigje të imituar; asnjë kërkesë nuk arrin te projekti i vërtetë.
// - muzika.apk: app-i i provës android-test/music-player (sesion medie pa zë); pa të, prova e muzikës
//   kontrollon vetëm kartën "Lidh muzikën tënde" dhe lejen.
//
// Rrjedha: v1 me të dhënat e veta (seanca me një set, ushqimi, matja, fotoja) → përditësimi nga app-i te v2
// ("Vrull u përditësua" shqip, pa gjuhë të dërguar) → v2 i gjen të dhënat → seanca: "Ruaj setin", pushimi me
// ekran të kyçur, seti nga njoftimi (prekja e dyfishtë, ekrani i kyçur, procesi i vrarë), videot e formës,
// muzika, anglishtja, mbyllja → butoni mbrapa, tema → instalim i ri: hyrja dhe hapat e parë me gjuhën →
// përditësimi v2 → v3 në anglisht → hapja pa internet.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PKG = 'al.traininghub.app'
const PLAYER = 'al.traininghub.musictest'
const SUPABASE = 'smoke.invalid'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const EMAIL = 'prove@example.com'
const PASSWORD = 'fjalekalim-prove'
const PIN = '1234'
const [outDir = 'smoke-out', apkV1, apkV2, apkV3, apkPlayer] = process.argv.slice(2)
if (!apkV1 || !apkV2 || !apkV3) {
  console.error('Përdorimi: node scripts/android-smoke.mjs <dosja> <v1.apk> <v2.apk> <v3.apk> [muzika.apk]')
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

const report = { checks: [], info: [], errors: [], requests: [], posts: [] }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const shell = (command) => execFileSync('adb', ['shell', command], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK ' : 'GABIM'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) throw new Error(`Prova dështoi: ${name} ${detail}`)
}

/** Një fakt për raportin, pa kusht (p.sh. çfarë mbështet WebView-i i emulatorit). */
function info(name, detail) {
  report.info.push({ name, detail })
  console.log(`INFO ${name}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
}

async function waitFor(fn, label, timeout = 60_000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeout) {
    try {
      const value = await fn()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await sleep(500)
  }
  throw new Error(`Koha mbaroi duke pritur: ${label}${lastError ? ` (${lastError.message})` : ''}`)
}

let shot = 0
function screenshot(name) {
  shot += 1
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })
  writeFileSync(join(outDir, `${String(shot).padStart(2, '0')}-${name}.png`), png)
}

/** Pamja e papërpunuar e ekranit: gjerësia, lartësia dhe pikselat RGBA pas kokës. */
function rawScreen() {
  const raw = execFileSync('adb', ['exec-out', 'screencap'], { maxBuffer: 64 * 1024 * 1024 })
  const width = raw.readUInt32LE(0)
  const height = raw.readUInt32LE(4)
  return { raw, width, height, header: raw.length - width * height * 4 }
}

// Ngjyra e rripit të orës (lart, larg orës, ikonave dhe kamerës në mes).
function statusBandColor() {
  const { raw, width, header } = rawScreen()
  const offset = header + (12 * width + Math.round(width * 0.35)) * 4
  return [raw[offset], raw[offset + 1], raw[offset + 2]]
}

async function waitForBand(hex, timeout = 5000) {
  const until = Date.now() + timeout
  let color = statusBandColor()
  while (!sameColor(color, hex) && Date.now() < until) {
    await sleep(250)
    color = statusBandColor()
  }
  return color
}

function sameColor(actual, hex) {
  const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return actual.every((value, i) => Math.abs(value - expected[i]) <= 4)
}

/**
 * Butoni "Ruaj setin" i njoftimit gjendet nga ngjyra: prushi (#FF5B2E, notification_save.xml) është i vetmi
 * drejtkëndësh i madh me këtë ngjyrë te njoftimet (ikona e vogël e kreut ka të njëjtën ngjyrë, por është
 * katror i vogël). Pa uiautomator: kronometri i njoftimit nuk e lë ekranin "të qetë" për të.
 */
function emberButton() {
  const { raw, width, height, header } = rawScreen()
  const step = 4
  const columns = Math.floor(width / step)
  const rows = Math.floor(height / step)
  const hit = new Uint8Array(columns * rows)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const offset = header + (y * step * width + x * step) * 4
      const [r, g, b] = [raw[offset], raw[offset + 1], raw[offset + 2]]
      if (Math.abs(r - 0xff) <= 24 && Math.abs(g - 0x5b) <= 28 && Math.abs(b - 0x2e) <= 28) hit[y * columns + x] = 1
    }
  }
  let best = null
  const seen = new Uint8Array(hit.length)
  for (let start = 0; start < hit.length; start++) {
    if (!hit[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    let [minX, minY, maxX, maxY, count] = [Infinity, Infinity, -1, -1, 0]
    while (queue.length) {
      const cell = queue.pop()
      const x = cell % columns
      const y = Math.floor(cell / columns)
      count += 1
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= columns || ny >= rows) continue
        const next = ny * columns + nx
        if (hit[next] && !seen[next]) {
          seen[next] = 1
          queue.push(next)
        }
      }
    }
    const w = (maxX - minX + 1) * step
    const h = (maxY - minY + 1) * step
    if (w < 60 || h < 40 || w / h < 1.3) continue
    if (!best || count > best.count) best = { count, x: Math.round((minX * step + maxX * step) / 2), y: Math.round((minY * step + maxY * step) / 2), w, h }
  }
  return best
}

function deviceNow() {
  return Number(shell('date +%s%3N'))
}

function versionCode() {
  const match = adb('shell', 'dumpsys', 'package', PKG).match(/versionCode=(\d+)/)
  return match ? Number(match[1]) : null
}

function isForeground() {
  return adb('shell', 'dumpsys', 'activity', 'activities')
    .split('\n')
    .some((line) => /topResumedActivity|mResumedActivity/.test(line) && line.includes(PKG))
}

function focusedWindow() {
  return (adb('shell', 'dumpsys', 'window').split('\n').find((line) => line.includes('mCurrentFocus')) ?? '').trim()
}

function pidOf(pkg = PKG) {
  try {
    return adb('shell', 'pidof', pkg)
  } catch {
    return ''
  }
}

function launch() {
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`)
}

/** true/false sipas KeyguardController (dumpsys activity) ose dritareve; null kur sistemi nuk e thotë. */
function keyguardShowing() {
  const dump = `${adb('shell', 'dumpsys', 'activity', 'activities')}\n${adb('shell', 'dumpsys', 'window')}`
  const match = dump.match(/mKeyguardShowing=(true|false)/) ?? dump.match(/KeyguardShowing=(true|false)/i)
  return match ? match[1] === 'true' : null
}

async function sleepScreen() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_SLEEP')
  await waitFor(() => /mWakefulness=(Asleep|Dozing)/.test(adb('shell', 'dumpsys', 'power')), 'ekrani i fikur', 15_000)
}

async function wakeScreen() {
  adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
  await waitFor(() => /mWakefulness=Awake/.test(adb('shell', 'dumpsys', 'power')), 'ekrani i ndezur', 15_000)
  await sleep(800)
}

/** Shkyçja me PIN-in: ngjitet bouncer-i, shkruhet PIN-i dhe pritet që ekrani i kyçur të ikë. */
async function unlock() {
  await wakeScreen()
  for (let attempt = 0; attempt < 3; attempt++) {
    adb('shell', 'wm', 'dismiss-keyguard')
    await sleep(1200)
    adb('shell', 'input', 'text', PIN)
    adb('shell', 'input', 'keyevent', 'KEYCODE_ENTER')
    await sleep(1500)
    const showing = keyguardShowing()
    if (showing === false) return
    if (showing === null && focusedWindow().includes(PKG)) return
  }
  throw new Error('Ekrani nuk u shkyç me PIN-in')
}

function collapseShade() {
  adb('shell', 'cmd', 'statusbar', 'collapse')
}

async function expandShade() {
  adb('shell', 'cmd', 'statusbar', 'expand-notifications')
  await sleep(1500)
}

// Mënyra e aeroplanit: e vetmja që fik edhe rrjetin virtual të emulatorit (svc wifi/data nuk mjafton).
async function setNetwork(enabled) {
  adb('shell', 'cmd', 'connectivity', 'airplane-mode', enabled ? 'disable' : 'enable')
  await waitFor(
    () => adb('shell', 'settings', 'get', 'global', 'airplane_mode_on') === (enabled ? '0' : '1'),
    enabled ? 'rrjeti i rikthyer' : 'mënyra e aeroplanit',
    20_000,
  )
}

// Emulatori në CI shfaq ndonjëherë "Process system isn't responding" pas nisjes. Dritaret e
// sistemit mbyllen para çdo shtypjeje butoni, që butoni të arrijë te app-i dhe jo te dritarja.
async function pressBack() {
  await waitFor(() => {
    adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS')
    return focusedWindow().includes(PKG)
  }, 'app-i në fokus para butonit mbrapa', 20_000)
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
}

/** Pema e pamjeve nga uiautomator; null kur ekrani nuk qetësohet (p.sh. një kronometër që ecën). */
function uiNodes() {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const out = adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
      if (!out.includes('dumped to')) continue
      const xml = adb('shell', 'cat', '/sdcard/ui.xml')
      return [...xml.matchAll(/<node [^>]*>/g)].map(([node]) => {
        const attr = (name) => node.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? ''
        const [x1, y1, x2, y2] = (attr('bounds').match(/\d+/g) ?? [0, 0, 0, 0]).map(Number)
        return { text: attr('text'), id: attr('resource-id'), desc: attr('content-desc'), x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2), x1, y1, x2, y2 }
      })
    } catch {
      // Provohet përsëri.
    }
  }
  return null
}

// Shiriti i veprimeve të Android-it nuk duhet të shfaqet mbi faqe.
function hasActionBar() {
  const nodes = uiNodes() ?? []
  return nodes.some((node) => /:id\/(action_bar|action_bar_container|toolbar)$/.test(node.id))
}

// ---- Njoftimet ----------------------------------------------------------------------------

/** Njoftimet e tanishme të app-it (vetëm "Notification List"), me id, titullin dhe tekstin. */
function notifications(pkg = PKG) {
  const dump = adb('shell', 'dumpsys', 'notification', '--noredact')
  const start = dump.indexOf('Notification List:')
  const list = start >= 0 ? dump.slice(start) : dump
  const end = list.search(/\n\s*(Snoozed notifications|mSnoozedNotifications|Pending snoozed|  Notification history)/)
  const body = end > 0 ? list.slice(0, end) : list
  return body
    .split('NotificationRecord(')
    .slice(1)
    .filter((block) => block.includes(`pkg=${pkg} `))
    .map((block) => ({
      id: Number(block.match(/ id=(\d+)/)?.[1]),
      title: block.match(/android\.title=\w+ \((.*)\)/)?.[1] ?? '',
      text: block.match(/android\.text=\w+ \((.*)\)/)?.[1] ?? '',
      created: Number(block.match(/mCreationTimeMs=(\d+)/)?.[1] ?? 0),
      block,
    }))
}

const notification = (id) => notifications().find((entry) => entry.id === id) ?? null

async function waitForNotificationTitle(id, title, timeout = 20_000) {
  return waitFor(() => notification(id)?.title === title, `njoftimi ${id}: "${title}" (tani "${notification(id)?.title ?? 'asnjë'}")`, timeout)
}

/** SharedPreferences "vrull_session" e njoftimit të seancës (SessionNotifier.java). */
function sessionPrefs() {
  let xml = ''
  try {
    xml = adb('shell', 'run-as', PKG, 'cat', 'shared_prefs/vrull_session.xml')
  } catch {
    return { queue: [], rest: null }
  }
  const value = (name) => {
    const raw = xml.match(new RegExp(`<string name="${name}">([\\s\\S]*?)</string>`))?.[1]
    if (!raw) return null
    const text = raw.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  }
  return { queue: value('queue') ?? [], rest: value('rest') }
}

/** Prekja e "Ruaj setin" te njoftimi i dukshëm (ekrani i kyçur ose paneli). `times` 2 = prekja e dyfishtë. */
function tapSave(label, times = 1) {
  const button = emberButton()
  if (!button) {
    screenshot(`gabim-${label}`)
    throw new Error(`"Ruaj setin" nuk u gjet te njoftimi (${label})`)
  }
  const at = deviceNow()
  const tap = `input tap ${button.x} ${button.y}`
  // Dy prekje njëherësh: dy procese `input` që nisin bashkë, para se njoftimi të vizatohet sërish.
  shell(times === 2 ? `${tap} & ${tap} & wait` : tap)
  return { at, button }
}

// ---- Supabase i imituar -------------------------------------------------------------------

const b64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
let serverClock = Date.parse('2026-12-01T10:00:00.000Z')

function fakeSession() {
  const now = Math.floor(Date.now() / 1000)
  const claims = { sub: USER_ID, exp: now + 24 * 3600, iat: now, role: 'authenticated', aud: 'authenticated', email: EMAIL }
  return {
    access_token: `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(claims)}.prove`,
    token_type: 'bearer',
    expires_in: 24 * 3600,
    expires_at: now + 24 * 3600,
    refresh_token: 'prove',
    user: { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL, app_metadata: { provider: 'email' }, user_metadata: {} },
  }
}

const parseBody = (request) => {
  try {
    return request.postData ? JSON.parse(request.postData) : null
  } catch {
    return null
  }
}

/** Përgjigja e imituar për një kërkesë drejt Supabase: [status, trupi]. */
function fakeResponse(request) {
  const url = new URL(request.url)
  const body = parseBody(request)
  if (url.pathname === '/auth/v1/token') {
    if (body?.email !== EMAIL || body?.password !== PASSWORD) {
      return [400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }]
    }
    return [200, fakeSession()]
  }
  // Përditësimi brenda app-it: një version më i vjetër se ai i instaluar, pra "i fundit".
  if (url.pathname.endsWith('/app-releases/latest.json')) {
    return [200, { version: '0.0.1', apk: 'TrainingHub-0.0.1.apk', sha256: '0'.repeat(64), bytes: 1, notes: [], publishedAt: '2026-01-01T00:00:00Z' }]
  }
  // Storage: fotot e progresit dhe videot e formës ngarkohen dhe fshihen.
  if (url.pathname.startsWith('/storage/v1/object/')) {
    const key = url.pathname.replace('/storage/v1/object/', '')
    return request.method === 'DELETE' ? [200, []] : [200, { Key: key, Id: 'prove' }]
  }
  // Tempo e këngës (GetSongBPM përmes Edge Function): kënga e parë e app-it të provës ka 128 BPM; për të
  // tjerat "nuk u gjet", që app-i të provojë MusicBrainz (CapacitorHttp) dhe AcousticBrainz.
  if (url.pathname === '/functions/v1/song-tempo') {
    return [200, body?.title === 'Prova e ritmit' ? { configured: true, bpm: 128, url: 'https://getsongbpm.com/' } : { configured: true, bpm: null }]
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    if (request.method === 'GET') return [200, []]
    // upsert me return=representation: serveri kthen rreshtat me kursorin e tij.
    const rows = (Array.isArray(body) ? body : [body]).filter(Boolean).map((row) => {
      serverClock += 1
      return { ...row, server_updated_at: new Date(serverClock).toISOString().replace('Z', '+00:00') }
    })
    report.posts.push({ table: url.pathname.replace('/rest/v1/', ''), rows })
    return [201, rows]
  }
  return [404, { message: 'not found' }]
}

const posted = (table) => report.posts.filter((post) => post.table === table).flatMap((post) => post.rows)

// CORS si një server i vërtetë: "*" nuk mbulon Authorization, ndaj header-at e kërkuar kthehen me emër.
function cors(request) {
  const header = (name) =>
    Object.entries(request.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1]
  return [
    { name: 'Access-Control-Allow-Origin', value: header('origin') ?? '*' },
    {
      name: 'Access-Control-Allow-Headers',
      value: header('access-control-request-headers') ?? 'apikey, authorization, content-type, prefer, x-client-info',
    },
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
    { name: 'Access-Control-Expose-Headers', value: 'content-range, content-type' },
  ]
}

// Lidhet me WebView-në e app-it (vetëm build-et debug e lejojnë) dhe kthen një evaluate().
async function connect() {
  const socket = await waitFor(() => {
    const pid = pidOf()
    const name = `webview_devtools_remote_${pid}`
    return pid && adb('shell', 'cat', '/proc/net/unix').includes(name) ? name : null
  }, 'socket-i i WebView-së')
  adb('forward', '--remove-all')
  adb('forward', 'tcp:9222', `localabstract:${socket}`)
  const target = await waitFor(async () => {
    const list = await (await fetch('http://127.0.0.1:9222/json')).json()
    return list.find((entry) => entry.type === 'page')
  }, 'faqja në WebView')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let nextId = 0
  const pending = new Map()
  // Çdo thirrje ka afat; kur lidhja mbyllet, thirrjet në pritje dështojnë në vend që të presin pa fund.
  ws.onclose = () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer)
      reject(new Error('Lidhja me WebView u mbyll'))
    }
    pending.clear()
  }
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${method} pa përgjigje`))
      }, 15_000)
      pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ id, method, params }))
    })
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, timer } = pending.get(message.id)
      clearTimeout(timer)
      pending.delete(message.id)
      resolve(message)
      return
    }
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params
      if (request.method === 'OPTIONS') {
        // Pa pritur: nëse app-i mbyllet ndërkohë, përgjigja thjesht nuk nevojitet më.
        send('Fetch.fulfillRequest', { requestId, responseCode: 204, responseHeaders: cors(request) }).catch(() => {})
        return
      }
      const [status, body] = fakeResponse(request)
      report.requests.push(`${request.method} ${new URL(request.url).pathname} ${status}`)
      send('Fetch.fulfillRequest', {
        requestId,
        responseCode: status,
        responseHeaders: [...cors(request), { name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify(body)).toString('base64'),
      }).catch(() => {})
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      report.errors.push(message.params.exceptionDetails.exception?.description ?? 'exception')
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      report.errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      // 400 i hyrjes me fjalëkalim të gabuar është pjesë e provës, jo gabim.
      if (!/status of 400/.test(message.params.entry.text)) report.errors.push(message.params.entry.text)
    }
  }
  const evaluate = async (expression) => {
    // userGesture: Chromium nuk i lejon "mbrapa" faqet e hapura pa veprim të përdoruesit
    // (canGoBack del false), ndaj klikimet e provës shënohen si prekje të vërteta.
    const response = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.exception?.description ?? response.result.exceptionDetails.text)
    return response.result?.result?.value
  }
  await send('Fetch.enable', { patterns: [{ urlPattern: `*${SUPABASE}*`, requestStage: 'Request' }] })
  await send('Runtime.enable')
  await send('Log.enable')
  return { send, evaluate, close: () => ws.close() }
}

/** Hap app-in (ose e sjell përpara) dhe lidhet me WebView-në e tij. */
async function open() {
  launch()
  return connect()
}

const heading = (page) => page.evaluate(`document.querySelector('h1')?.textContent ?? ''`)
const waitForHeading = (page, text, timeout) => waitFor(async () => (await heading(page)) === text, `titulli "${text}"`, timeout)
// Teksti i faqes: innerText e jep me shkronjat e mëdha të stileve ("VAZHDO STËRVITJEN"), textContent siç shkruhet.
// Hapësirat që nuk thyhen (fmt.unit: "85 cm") krahasohen si hapësira të zakonshme.
const PAGE_TEXT = `(document.body.innerText + '\\n' + document.body.textContent).replace(/[\\u00A0\\u202F]/g, ' ')`
const hasText = (page, text) => page.evaluate(`${PAGE_TEXT}.includes(${JSON.stringify(text)})`)
const waitForText = (page, text, timeout) => waitFor(() => hasText(page, text), `teksti "${text}"`, timeout)
const waitForPath = (page, path, timeout) => waitFor(async () => (await page.evaluate('location.pathname')) === path, `adresa ${path}`, timeout)
// Pret elementin (ekrani mund të jetë ende duke lexuar të dhënat), pastaj e prek.
const click = async (page, selector) => {
  const query = `document.querySelector(${JSON.stringify(selector)})`
  await waitFor(() => page.evaluate(`!!${query}`), selector, 20_000)
  await page.evaluate(`${query}.click()`)
}
// Emrat krahasohen me hapësirat që nuk thyhen si hapësira ("Rrit peshën me 2,5 kg").
const NORMALIZE = `((text) => (text ?? '').replace(/[\\u00A0\\u202F]/g, ' ').trim())`
const buttonExpression = (label) =>
  `[...document.querySelectorAll('button')].find((b) => ${NORMALIZE}(b.textContent) === ${JSON.stringify(label)} || ${NORMALIZE}(b.getAttribute('aria-label')) === ${JSON.stringify(label)})`
const hasButton = (page, label) => page.evaluate(`!!${buttonExpression(label)}`)
const clickButton = async (page, label) => {
  await waitFor(() => hasButton(page, label), `butoni "${label}"`, 20_000)
  await page.evaluate(`${buttonExpression(label)}.click()`)
}
const clickButtonStarting = async (page, prefix) => {
  const find = `[...document.querySelectorAll('button')].find((b) => ${NORMALIZE}(b.getAttribute('aria-label') ?? b.textContent).startsWith(${JSON.stringify(prefix)}))`
  await waitFor(() => page.evaluate(`!!${find}`), `butoni "${prefix}…"`, 20_000)
  await page.evaluate(`${find}.click()`)
}

// Vendos vlerën si tastiera, që React ta marrë (setter-i native dhe ngjarja input).
const type = (page, selector, value) =>
  page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

/** Rreshtat e bazës lokale (IndexedDB "training-hub") drejtpërdrejt, pa kodin e app-it; ArrayBuffer → madhësia. */
const readDb = (page, stores) =>
  page.evaluate(`new Promise((resolve, reject) => {
    const stores = ${JSON.stringify(stores)}
    const request = indexedDB.open('training-hub')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const out = Object.fromEntries(stores.map((name) => [name, []]))
      const names = stores.filter((name) => db.objectStoreNames.contains(name))
      if (names.length === 0) { db.close(); resolve(out); return }
      const tx = db.transaction(names, 'readonly')
      for (const name of names) {
        const query = tx.objectStore(name).getAll()
        query.onsuccess = () => {
          out[name] = query.result.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof ArrayBuffer ? { bytes: value.byteLength } : value])))
        }
      }
      tx.oncomplete = () => { db.close(); resolve(out) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })`)

/** Setet e seancës për një ushtrim (sipas exercise_id), të renditura. */
async function setsOf(page, sessionId, exerciseId) {
  const { set_logs: sets } = await readDb(page, ['set_logs'])
  return sets.filter((set) => set.session_id === sessionId && set.exercise_id === exerciseId && !set.deleted_at).sort((a, b) => a.set_number - b.set_number)
}

/** Ushtrimet e programit sipas emrit (tabela exercises). */
async function exerciseIds(page) {
  const { exercises } = await readDb(page, ['exercises'])
  return Object.fromEntries(exercises.map((exercise) => [exercise.name, exercise.id]))
}

/** Seanca te ekrani i seancës, pa pushimin përpara (pushimi kapërcehet kur del). */
async function openSession(page) {
  if ((await page.evaluate('location.pathname')) !== '/seanca') {
    await waitForPath(page, '/')
    await clickButton(page, 'Vazhdo stërvitjen')
    await waitForPath(page, '/seanca')
  }
  await sleep(800)
  if (await hasButton(page, 'Kapërce')) await clickButton(page, 'Kapërce')
  await waitFor(async () => (await heading(page)) !== 'Pushimi' && (await heading(page)) !== '', 'ushtrimi te seanca')
}

/** Ushtrimi dhe seti në ekran: "Bench Press", "Seti 2 nga 3 · …". */
async function sessionStep(page) {
  return page.evaluate(`({ exercise: document.querySelector('h1')?.textContent ?? '', set: (document.body.innerText.match(/Seti \\d+ nga \\d+/) ?? [''])[0] })`)
}

const restEndsAt = (page) =>
  page.evaluate(`(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('th:rest:'))
    return key ? JSON.parse(localStorage.getItem(key)).endsAt : null
  })()`)

/** "Pushimi mbaroi" (4201) vjen brenda 2 s nga fundi i pushimit, me ekran të fikur. */
async function expectRestDone(label, endsAt) {
  await sleep(Math.max(0, endsAt - deviceNow()) + 4000)
  const done = notification(4201)
  const delta = done ? done.created - endsAt : null
  report[label] = { endsAt, posted: done?.created ?? null, deltaMs: delta, title: done?.title ?? null }
  check(`${label}: "Pushimi mbaroi" vjen me ekran të kyçur, brenda 2 s`, done !== null && done.title === 'Pushimi mbaroi' && Math.abs(delta) <= 2000, JSON.stringify(report[label]))
}

async function choosePhoto(page, selector) {
  // Një JPEG nga canvas, si nga kamera: input-i i skedarit merr skedarin dhe ngjarjen "change".
  await page.evaluate(`(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 800
    const context = canvas.getContext('2d')
    context.fillStyle = '#7a5c48'
    context.fillRect(0, 0, 600, 800)
    context.fillStyle = '#e8d3c0'
    context.fillRect(200, 120, 200, 560)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    const transfer = new DataTransfer()
    transfer.items.add(new File([blob], 'para.jpg', { type: 'image/jpeg', lastModified: Date.now() }))
    const input = document.querySelector(${JSON.stringify(selector)})
    input.files = transfer.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })()`)
}

/** Gjuha zgjidhet te Cilësimet › Pamja (faqja hapet drejt, si pas një rifreskimi). */
async function chooseLanguage(page, language) {
  await page.evaluate(`location.assign('/cilesimet/pamja')`)
  await waitFor(async () => ['Pamja', 'Appearance'].includes(await heading(page)), 'Pamja')
  await clickButton(page, language === 'en' ? 'English' : 'Shqip')
  await waitForHeading(page, language === 'en' ? 'Appearance' : 'Pamja')
}

async function goHome(page) {
  await page.evaluate(`location.assign('/')`)
  await waitForPath(page, '/')
}

// Ndryshimet që app-i bën vetë në sfond nuk duhet të bëjnë zhurmë: një kërkesë e dështuar e Supabase
// kur procesi rinis pa CDP (smoke.invalid nuk ekziston) nuk është gabim i app-it.
const ignoredError = (text) => /smoke\.invalid.*(ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED)/.test(text)

try {
  // Nis nga një pajisje pa app-in; çinstalimi dështon kur s'ka çfarë të heqë.
  for (const pkg of [PKG, PLAYER]) {
    try {
      adb('uninstall', pkg)
    } catch {
      // App-i nuk ishte i instaluar.
    }
  }
  try {
    adb('shell', 'locksettings', 'clear', '--old', PIN)
  } catch {
    // Pa PIN.
  }

  // ==== A. v1 0.16.0: hyrja, hapat e parë dhe të dhënat që duhet të kalojnë te v2 ====
  adb('install', apkV1)
  const codeV1 = versionCode()
  check('v1 0.16.0 instalohet', codeV1 === 1600, `versionCode ${codeV1}`)
  let page = await open()
  await page.send('Page.reload')
  await waitForHeading(page, 'Hyr')
  check('v1: pa sesion hapet hyrja', (await page.evaluate('location.pathname')) === '/hyrja')
  check('v1: tema OLED si parazgjedhje', (await page.evaluate('document.documentElement.className')) === 'dark oled')
  screenshot('v1-hyrja')
  await type(page, 'input[type="email"]', EMAIL)
  await type(page, 'input[autocomplete="current-password"]', PASSWORD)
  await clickButton(page, 'Hyr')
  await waitForHeading(page, 'Sa peshon sot?')
  await type(page, 'input[inputmode="decimal"]', '80,5')
  await page.evaluate(`document.querySelector('input[inputmode="decimal"]').blur()`)
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Kur stërvitesh?')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Kur zgjohesh dhe kur fle?')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Programi yt')
  await clickButton(page, 'Fillo programin')
  await waitForHeading(page, 'Stërvitja 1')
  await waitForText(page, 'Java 0')
  check('v1: hapat e parë mbarojnë te Sot me Java 0 · Stërvitja 1', true)

  // Seanca e v1: Bench Press, seti 1 me 60 kg; seanca mbetet e hapur, si te një përdorues që përditëson në palestër.
  adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
  await clickButton(page, 'Fillo stërvitjen')
  await waitForHeading(page, 'Bench Press')
  await type(page, 'form input[inputmode="decimal"]', '60')
  await page.evaluate(`document.querySelector('form input[inputmode="decimal"]').blur()`)
  await clickButton(page, 'Ruaj setin 1')
  await waitFor(() => hasButton(page, 'Kapërce'), 'pushimi i v1')
  await clickButton(page, 'Kapërce')
  await waitForText(page, 'Seti 2 nga 3')
  screenshot('v1-seanca')
  await clickButton(page, 'Minimizo stërvitjen')
  await waitForHeading(page, 'Stërvitja 1')

  // Ushqimi: vakti i radhës nga shablloni.
  await click(page, 'a[href="/ushqimi"]')
  await waitForHeading(page, 'Ushqimi')
  await clickButtonStarting(page, 'Regjistro ')
  await waitForText(page, 'Regjistruar')
  // Matja: beli 85 cm.
  await click(page, 'a[href="/progresi"]')
  await waitForHeading(page, 'Progresi')
  await click(page, 'a[href="/progresi/matja"]')
  await waitForHeading(page, 'Matja')
  const waistLabel = `[...document.querySelectorAll('label')].find((label) => label.textContent.trim() === 'Beli, cm')`
  await waitFor(() => page.evaluate(`!!${waistLabel}`), 'fusha "Beli, cm"')
  const waist = await page.evaluate(`${waistLabel}.htmlFor`)
  await type(page, `[id="${waist}"]`, '85')
  await clickButton(page, 'Ruaj matjen')
  await waitForHeading(page, 'Progresi')
  // Fotoja "Para" nga kamera (input-i i skedarit i v1).
  await waitFor(() => page.evaluate(`!!document.querySelector('section[aria-labelledby="photos-title"] input[type="file"]')`), 'fotot te Progresi')
  await choosePhoto(page, 'section[aria-labelledby="photos-title"] input[type="file"]')
  await waitFor(async () => (await readDb(page, ['_photo_files']))._photo_files.some((file) => file.uploaded === 1), 'fotoja e ngarkuar', 30_000)
  screenshot('v1-progresi')
  await waitFor(
    () => ['set_logs', 'body_measurements', 'diary_entries'].every((table) => posted(table).length > 0),
    'sinkronizimi i të dhënave të v1',
    60_000,
  )
  // Rreshti i fotos dërgohet pas ngarkimit të skedarit, në sinkronizimin e radhës; kur v1 nuk arrin, e dërgon v2.
  const photoSyncedByV1 = await waitFor(() => posted('progress_photos').length > 0, 'rreshti i fotos nga v1', 30_000).catch(() => false)
  info('fotoja e v1', photoSyncedByV1 ? 'rreshti u sinkronizua nga v1' : 'rreshti pret sinkronizimin te v2')
  const v1Data = await readDb(page, ['workout_sessions', 'set_logs', 'body_measurements', 'diary_entries', 'progress_photos', '_photo_files'])
  const v1Session = v1Data.workout_sessions.find((row) => !row.finished_at)
  const v1Set = v1Data.set_logs[0]
  check(
    'v1: seanca, seti, matja, ushqimi dhe fotoja ruhen dhe sinkronizohen',
    v1Session && v1Set?.weight_kg === 60 && v1Data.body_measurements.some((row) => row.waist_cm === 85) && v1Data.diary_entries.length > 0 && v1Data.progress_photos.length === 1,
    `${v1Data.set_logs.length} set, ${v1Data.diary_entries.length} ushqime, ${v1Data.progress_photos.length} foto`,
  )
  report.v1 = { session: v1Session?.id, set: v1Set?.id, diary: v1Data.diary_entries.length, photo: v1Data.progress_photos[0]?.id }

  // ==== B. Përditësimi v1 → v2 nga vetë app-i i v1 (TH-23) ====
  // APK-ja e re vendoset në cache të app-it, si pas shkarkimit; leja "Instalo app të panjohura" jepet si nga
  // përdoruesi; AppUpdater.install e instalon pa dritare konfirmimi (Android 12+).
  const shaV2 = createHash('sha256').update(readFileSync(apkV2)).digest('hex')
  adb('shell', 'appops', 'set', PKG, 'REQUEST_INSTALL_PACKAGES', 'allow')
  const appDir = adb('shell', 'run-as', PKG, 'pwd')
  check('përditësimi: app-i i v1 e sheh lejen e instalimit', (await page.evaluate(`Capacitor.Plugins.AppUpdater.canInstall().then((r) => r.value)`)) === true)
  adb('push', apkV2, '/data/local/tmp/th-v2.apk')
  adb('shell', 'run-as', PKG, 'cp', '/data/local/tmp/th-v2.apk', 'cache/perditesimi.apk')
  const installStart = await page
    .evaluate(`Capacitor.Plugins.AppUpdater.install({ path: '${appDir}/cache/perditesimi.apk', sha256: '${shaV2}' }).then(() => 'nisi', (e) => e.message)`)
    .catch(() => 'nisi')
  let codeV2 = versionCode()
  for (let waited = 0; waited < 90_000 && !(codeV2 > codeV1); waited += 1000) {
    await sleep(1000)
    codeV2 = versionCode()
  }
  if (!(codeV2 > codeV1)) screenshot('gabim-perditesimi')
  check('v1 → v2: instalohet nga app-i, pa dritare konfirmimi', codeV2 !== null && codeV2 > codeV1, `${installStart}; ${codeV1} -> ${codeV2}`)
  page.close()
  // MY_PACKAGE_REPLACED vjen kur sistemi e nis sërish procesin; në emulatorin e ngarkuar mund të vonojë.
  const updated = await waitFor(() => notifications().find((entry) => entry.title.startsWith('Vrull')), 'njoftimi i përditësimit', 45_000).catch(() => null)
  if (!updated) {
    const lines = adb('logcat', '-d', '-t', '4000').split('\n').filter((line) => /traininghub|MY_PACKAGE_REPLACED|AppReplaced|BroadcastQueue|AndroidRuntime/i.test(line))
    writeFileSync(join(outDir, 'logcat-perditesimi.txt'), lines.join('\n'))
  }
  // v1 nuk i dërgonte gjuhën plugin-it: njoftimi del shqip.
  check('v1 → v2: njoftimi "Vrull u përditësua", shqip pa gjuhë të dërguar', updated?.title === 'Vrull u përditësua', updated ? `${updated.title} · ${updated.text}` : 'asnjë')
  check('v1 → v2: APK-ja e shkarkuar fshihet', adb('shell', 'run-as', PKG, 'ls', 'cache').split(/\s+/).includes('perditesimi.apk') === false)

  // ==== C. v2 me të dhënat e v1 ====
  page = await open()
  await page.send('Page.reload')
  await waitForPath(page, '/')
  await waitForText(page, 'Vazhdo stërvitjen')
  await waitForText(page, 'Java 0')
  check('v2: pa hyrje të re, direkt te Sot me seancën e hapur të v1', await hasText(page, '1 nga 21 sete'))
  check('v2: tema OLED mbetet', (await page.evaluate('document.documentElement.className')) === 'dark oled')
  const bandOled = await waitForBand('#000000')
  check('v2: rripi i orës i zi në OLED', sameColor(bandOled, '#000000'), bandOled.join(','))
  check('v2: pa shirit veprimesh mbi faqe', !hasActionBar())
  screenshot('v2-sot-pas-perditesimit')
  const v2Data = await readDb(page, ['workout_sessions', 'set_logs', 'body_measurements', 'diary_entries', 'progress_photos', '_photo_files'])
  check('v2: seanca dhe seti i v1 mbeten', v2Data.workout_sessions.some((row) => row.id === report.v1.session) && v2Data.set_logs.some((row) => row.id === report.v1.set && row.weight_kg === 60 && row.reps === 12))
  check('v2: matja e v1 mbetet', v2Data.body_measurements.some((row) => row.waist_cm === 85))
  check('v2: ushqimi i v1 mbetet', v2Data.diary_entries.length === report.v1.diary, `${v2Data.diary_entries.length} rreshta`)
  check(
    'v2: fotoja e v1 mbetet, me skedarin në telefon',
    v2Data.progress_photos.some((row) => row.id === report.v1.photo) && v2Data._photo_files.some((file) => file.id === report.v1.photo && file.data?.bytes > 0),
  )
  await waitFor(() => posted('progress_photos').some((row) => row.id === report.v1.photo), 'rreshti i fotos së v1 te serveri', 60_000)
  check('v2: fotoja e v1 arrin te serveri', true)
  report.insets = await page.evaluate(`(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)'
    document.body.append(probe)
    const style = getComputedStyle(probe)
    const value = { top: style.paddingTop, bottom: style.paddingBottom, width: innerWidth, height: innerHeight }
    probe.remove()
    return value
  })()`)
  report.userAgent = await page.evaluate('navigator.userAgent')
  check('v2: navigimi poshtë brenda ekranit', await page.evaluate(`(() => { const nav = document.querySelector('nav[aria-label="Kryesore"]').getBoundingClientRect(); return nav.bottom <= innerHeight + 0.5 && nav.height >= 56 })()`), JSON.stringify(report.insets))
  check('v2: pa scroll anësor', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
  await click(page, 'a[href="/progresi"]')
  await waitForText(page, '85 cm')
  check('v2: Progresi tregon matjen dhe foton e v1', await page.evaluate(`!!document.querySelector('button[aria-label^="Para, "]')`))
  screenshot('v2-progresi')
  await click(page, 'a[href="/ushqimi"]')
  await waitForText(page, 'Regjistruar ·')
  check('v2: Ushqimi tregon vaktin e regjistruar te v1', true)
  screenshot('v2-ushqimi')
  await click(page, 'a[href="/"]')

  // ==== D. Seanca dhe seti nga njoftimi (V2-E1-07, V2-E1-08) ====
  await openSession(page)
  const ids = await exerciseIds(page)
  const sessionId = report.v1.session
  check('seanca e v1 vazhdon te v2: Bench Press, seti 2 nga 3', JSON.stringify(await sessionStep(page)) === JSON.stringify({ exercise: 'Bench Press', set: 'Seti 2 nga 3' }))
  await waitForNotificationTitle(4200, 'Bench Press · Seti 2 nga 3')
  check('njoftimi i seancës: Bench Press · Seti 2 nga 3, me peshën e setit 1', notification(4200).text.startsWith('60 kg × 12'), notification(4200).text)
  // Muzika pa leje: karta "Lidh muzikën tënde" (V2-E1-12).
  check('muzika pa leje: karta "Lidh muzikën tënde" te seanca', await hasText(page, 'Lidh muzikën tënde'))
  screenshot('seanca-v2')

  // D1. Prekja e dyfishtë te paneli i njoftimeve ruan një set (Bench Press seti 2), jo dy.
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await sleep(1000)
  await expandShade()
  screenshot('njoftimi-paneli')
  const doubleTap = tapSave('prekja-e-dyfishte', 2)
  await waitForNotificationTitle(4200, 'Bench Press · Seti 3 nga 3')
  await sleep(2500)
  collapseShade()
  page.close()
  page = await open()
  await openSession(page)
  let bench = await setsOf(page, sessionId, ids['Bench Press'])
  check('njoftimi: prekja e dyfishtë ruan një set', bench.map((set) => set.set_number).join(',') === '1,2', `setet ${bench.map((set) => set.set_number).join(',')}, prekja ${doubleTap.at}`)
  check('njoftimi: seti i ruajtur del te seanca', JSON.stringify(await sessionStep(page)) === JSON.stringify({ exercise: 'Bench Press', set: 'Seti 3 nga 3' }))

  // D2. Ekrani i kyçur me PIN: "Ruaj setin" pa e shkyçur telefonin; pushimi nis nga njoftimi dhe
  // "Pushimi mbaroi" vjen me ekran të fikur.
  adb('shell', 'locksettings', 'set-pin', PIN)
  await sleepScreen()
  await wakeScreen()
  await sleep(1500)
  check('ekrani i kyçur me PIN', keyguardShowing() !== false)
  screenshot('ekrani-kycur')
  const lockTap = tapSave('ekrani-kycur')
  await waitForNotificationTitle(4200, 'Incline Bench Press · Seti 1 nga 2')
  await waitFor(() => notification(4202), 'njoftimi i pushimit (4202)', 10_000)
  check('ekrani i kyçur: "Ruaj setin" kalon te seti tjetër dhe nis pushimin, pa shkyçur', keyguardShowing() !== false, notification(4202)?.title)
  screenshot('ekrani-kycur-pas')
  const lockRest = sessionPrefs().rest
  await sleepScreen()
  await expectRestDone('pushimi nga njoftimi', lockRest?.endsAt ?? lockTap.at + 90_000)
  await unlock()
  page.close()
  page = await open()
  await openSession(page)
  bench = await setsOf(page, sessionId, ids['Bench Press'])
  const lockSet = bench.find((set) => set.set_number === 3)
  check('ekrani i kyçur: seti 3 ruhet me kohën e prekjes', lockSet && Math.abs(Date.parse(lockSet.logged_at) - lockTap.at) <= 3000, `${lockSet?.logged_at} vs ${new Date(lockTap.at).toISOString()}`)
  await waitFor(() => posted('set_logs').some((row) => row.id === lockSet.id), 'sinkronizimi i setit nga ekrani i kyçur', 30_000)

  // D3. Seanca: "Ruaj setin" te app-i (Incline Bench Press seti 1, 40 kg) dhe pushimi me ekran të kyçur.
  check('pas Bench Press seanca kalon te Incline Bench Press', JSON.stringify(await sessionStep(page)) === JSON.stringify({ exercise: 'Incline Bench Press', set: 'Seti 1 nga 2' }))
  for (let i = 0; i < 16; i++) await clickButton(page, 'Rrit peshën me 2,5 kg')
  await waitFor(() => hasButton(page, 'Shkruaj peshën, 40 kg'), 'pesha 40 kg')
  await clickButton(page, 'Ruaj setin')
  await waitFor(() => hasButton(page, 'Hiq 15 sekonda nga pushimi'), 'pushimi te seanca')
  for (let i = 0; i < 5; i++) await clickButton(page, 'Hiq 15 sekonda nga pushimi')
  screenshot('seanca-pushimi')
  const inAppRest = await restEndsAt(page)
  await sleepScreen()
  await expectRestDone('pushimi te seanca', inAppRest)
  await unlock()
  await waitForText(page, 'Seti 2 nga 2')
  check('pas pushimit seanca vazhdon te seti 2', true)

  // D4. Procesi i vrarë: "Ruaj setin" e nis procesin, njoftimi kalon te seti tjetër, radha mbetet derisa hapet app-i.
  await waitForNotificationTitle(4200, 'Incline Bench Press · Seti 2 nga 2')
  page.close()
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await sleep(1500)
  await waitFor(() => {
    adb('shell', 'am', 'kill', PKG)
    return pidOf() === ''
  }, 'procesi i vrarë me am kill', 10_000).catch(() => {
    // `am kill` vret vetëm procesin "në cache"; përndryshe si sistemi kur i duhet kujtesa.
    info('procesi', 'am kill nuk e vrau; vritet me kill nga vetë përdoruesi i app-it')
    adb('shell', 'run-as', PKG, 'kill', '-9', pidOf())
  })
  await waitFor(() => pidOf() === '', 'procesi i vrarë', 10_000)
  check('procesi i app-it është vrarë, njoftimi mbetet', notification(4200)?.title === 'Incline Bench Press · Seti 2 nga 2')
  await expandShade()
  const killedTap = tapSave('procesi-i-vrare')
  await waitFor(() => pidOf() !== '', 'procesi nis nga prekja', 15_000)
  await waitForNotificationTitle(4200, 'Incline Dumbbell Flye · Seti 1 nga 2')
  const queued = sessionPrefs().queue.filter((action) => action.type === 'save')
  check('procesi i vrarë: prekja e nis procesin dhe njoftimi kalon te seti tjetër', queued.length === 1, `radha ${JSON.stringify(queued.map((action) => [action.setNumber, action.reps, action.at]))}`)
  check('procesi i vrarë: radha mban setin me kohën e prekjes', Math.abs(queued[0].at - killedTap.at) <= 3000 && queued[0].setNumber === 2 && queued[0].weightKg === 40)
  screenshot('njoftimi-pas-procesit')
  collapseShade()
  page = await open()
  await waitFor(async () => ['/', '/seanca'].includes(await page.evaluate('location.pathname')), 'Sot ose seanca')
  if ((await page.evaluate('location.pathname')) === '/') {
    await clickButton(page, 'Vazhdo stërvitjen')
    await waitForPath(page, '/seanca')
  }
  await waitForText(page, 'Seti 2 u ruajt: 40 × 12')
  check('procesi i vrarë: hapja e app-it tregon "Seti 2 u ruajt"', true)
  await waitFor(() => sessionPrefs().queue.length === 0, 'radha e zbrazur', 15_000)
  await waitFor(() => posted('set_logs').some((row) => row.set_number === 2 && row.exercise_id === ids['Incline Bench Press']), 'sinkronizimi i setit nga njoftimi', 30_000)
  const killedSet = posted('set_logs').find((row) => row.set_number === 2 && row.exercise_id === ids['Incline Bench Press'])
  check('procesi i vrarë: seti sinkronizohet me logged_at = koha e prekjes', Date.parse(killedSet.logged_at) === queued[0].at, `${killedSet.logged_at} = ${new Date(queued[0].at).toISOString()}`)
  screenshot('seanca-seti-nga-njoftimi')
  await openSession(page)

  // D5. Videot e formës (V2-E1-13): leja CAMERA te prekja e parë, kamera virtuale, regjistrimi pa internet.
  report.mp4 = await page.evaluate(`({ avc1: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1'), mp4: MediaRecorder.isTypeSupported('video/mp4'), webm: MediaRecorder.isTypeSupported('video/webm') })`)
  info("MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') në WebView-in e emulatorit", report.mp4)
  const cameraGranted = () => /android\.permission\.CAMERA: granted=true/.test(adb('shell', 'dumpsys', 'package', PKG))
  check('kamera: leja CAMERA ende pa dhënë', !cameraGranted())
  await clickButton(page, 'Video e formës')
  await waitFor(() => focusedWindow().includes('permissioncontroller'), 'dritarja e lejes së kamerës', 20_000)
  screenshot('kamera-leja')
  const allow = await waitFor(() => (uiNodes() ?? []).find((node) => /permission_allow_foreground_only_button|permission_allow_button/.test(node.id)), 'butoni "Lejo" i kamerës', 20_000)
  adb('shell', 'input', 'tap', String(allow.x), String(allow.y))
  await waitFor(cameraGranted, 'leja CAMERA', 15_000)
  check('kamera: leja CAMERA kërkohet te prekja e parë dhe jepet', true)
  const cameraLive = () => page.evaluate(`(document.querySelector('[role=dialog] video')?.readyState ?? 0) >= 2`)
  await waitFor(cameraLive, 'pamja e kamerës virtuale', 30_000)
  check('kamera: pamja e kamerës virtuale të emulatorit', true)
  screenshot('kamera')
  await setNetwork(false)
  const recordLabel = async () => ((await hasButton(page, 'Regjistro')) ? 'Regjistro' : 'Regjistro përsëri')
  await clickButton(page, await recordLabel())
  await sleep(5200)
  await clickButton(page, 'Ndalo regjistrimin')
  await waitFor(() => page.evaluate(`/Regjistruar 0:0[456]/.test(${PAGE_TEXT})`), 'regjistrimi 5 s')
  screenshot('kamera-regjistruar')
  await clickButtonStarting(page, 'Ruaj te seti ')
  await waitFor(() => page.evaluate(`!document.querySelector('[role=dialog] video')`), 'mbyllja e kamerës pas ruajtjes')
  const savedVideo = await waitFor(async () => {
    const data = await readDb(page, ['form_videos', '_video_files'])
    return data.form_videos.length === 1 && data._video_files.length === 1 ? data : null
  }, 'videoja në telefon')
  check('video: ruhet në telefon pa internet, pa u ngarkuar', savedVideo._video_files[0].uploaded === 0 && savedVideo.form_videos[0].duration_s >= 4, `${savedVideo.form_videos[0].mime_type}, ${savedVideo.form_videos[0].duration_s} s, ${savedVideo.form_videos[0].bytes} B`)
  report.video = savedVideo.form_videos[0]
  await setNetwork(true)
  await waitFor(() => report.requests.some((line) => line.startsWith('POST /storage/v1/object/form-videos/')), 'ngarkimi i videos kur kthehet rrjeti', 60_000)
  await waitFor(async () => (await readDb(page, ['_video_files']))._video_files[0].uploaded === 1, 'videoja e shënuar si e ngarkuar', 30_000)
  check('video: ngarkohet te form-videos kur kthehet rrjeti', true, report.requests.find((line) => line.startsWith('POST /storage/v1/object/form-videos/')))
  // Home gjatë regjistrimit: regjistrimi ndalet dhe mbahet, kamera rihapet kur app-i kthehet.
  await clickButton(page, 'Video e formës')
  await waitFor(cameraLive, 'kamera përsëri', 30_000)
  await clickButton(page, await recordLabel())
  await sleep(2500)
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await sleep(2000)
  launch()
  await waitFor(() => page.evaluate(`/Regjistruar 0:0\\d/.test(${PAGE_TEXT})`), 'regjistrimi i ndalur nga Home', 20_000)
  await waitFor(cameraLive, 'kamera e rihapur pas Home', 30_000)
  check('video: Home gjatë regjistrimit e ndal dhe e mban regjistrimin, kamera rihapet', true)
  screenshot('kamera-pas-home')
  await clickButton(page, 'Mbyll kamerën')
  await waitFor(() => page.evaluate(`!document.querySelector('[role=dialog] video')`), 'kamera e mbyllur')

  // D6. Muzika (V2-E1-12): leja "Qasja te njoftimet" dhe, me app-in e provës, mini-player-i dhe rreshti i
  // muzikës te njoftimi i seancës me kontrollet.
  adb('shell', 'cmd', 'notification', 'allow_listener', `${PKG}/${PKG}.MusicListenerService`)
  adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
  await sleep(1000)
  launch()
  await waitFor(async () => !(await hasText(page, 'Lidh muzikën tënde')), 'karta e lidhjes ikën pas lejes', 20_000)
  check('muzika: me lejen, pa app muzike del "Asnjë app muzike nuk luan"', await waitFor(() => hasText(page, 'Asnjë app muzike nuk luan'), 'muzika pa këngë', 15_000))
  if (apkPlayer) {
    adb('install', apkPlayer)
    adb('shell', 'pm', 'grant', PLAYER, 'android.permission.POST_NOTIFICATIONS')
    adb('logcat', '-c')
    adb('shell', 'am', 'start', '-W', '-n', `${PLAYER}/.MainActivity`)
    launch()
    await waitForText(page, 'Prova e ritmit', 20_000)
    await waitForText(page, '128 BPM', 20_000)
    check('muzika: mini-player-i tregon këngën dhe tempon', true)
    screenshot('muzika-seanca')
    const playerLog = () => adb('logcat', '-d', '-s', 'VrullProva').split('\n').filter((line) => line.includes('komanda'))
    // Kontrollet te seanca.
    await clickButton(page, 'Kënga tjetër')
    await waitFor(() => playerLog().some((line) => line.includes('komanda next -> Kënga e dytë')), 'kënga tjetër nga seanca', 15_000)
    await waitForText(page, 'Kënga e dytë', 15_000)
    check('muzika: "Kënga tjetër" te seanca ndërron këngën', true)
    // Rreshti i muzikës te njoftimi: titulli dhe kontrollet (uiautomator; ekrani me kronometër mund të mos qetësohet).
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await sleep(1000)
    await expandShade()
    screenshot('njoftimi-muzika')
    let nodes = uiNodes()
    if (nodes) {
      const title = nodes.find((node) => node.id.endsWith(':id/music_title'))
      check('njoftimi: rreshti i muzikës tregon këngën', title?.text === 'Kënga e dytë', title?.text ?? 'pa rresht')
      const pause = nodes.find((node) => node.id.endsWith(':id/music_play_pause') && node.desc === 'Pauzë')
      check('njoftimi: luaj/pauzë sipas gjendjes', Boolean(pause))
      adb('shell', 'input', 'tap', String(pause.x), String(pause.y))
      await waitFor(() => playerLog().some((line) => line.includes('komanda pause')), 'pauza nga njoftimi', 15_000)
      check('njoftimi: "Pauzë" ndal muzikën', true)
      await waitFor(() => (uiNodes() ?? []).some((node) => node.id.endsWith(':id/music_play_pause') && node.desc === 'Luaj'), 'butoni "Luaj" pas pauzës', 15_000)
      nodes = uiNodes() ?? []
      const play = nodes.find((node) => node.id.endsWith(':id/music_play_pause'))
      adb('shell', 'input', 'tap', String(play.x), String(play.y))
      await waitFor(() => playerLog().some((line) => line.includes('komanda play')), 'luaj nga njoftimi', 15_000)
      const next = (uiNodes() ?? []).find((node) => node.id.endsWith(':id/music_next'))
      adb('shell', 'input', 'tap', String(next.x), String(next.y))
      await waitFor(() => playerLog().some((line) => line.includes('komanda next -> Kënga e tretë')), 'kënga tjetër nga njoftimi', 15_000)
      await waitFor(() => (uiNodes() ?? []).some((node) => node.id.endsWith(':id/music_title') && node.text === 'Kënga e tretë'), 'titulli i ri te njoftimi', 15_000)
      const previous = (uiNodes() ?? []).find((node) => node.id.endsWith(':id/music_previous'))
      adb('shell', 'input', 'tap', String(previous.x), String(previous.y))
      await waitFor(() => playerLog().some((line) => line.includes('komanda previous -> Kënga e dytë')), 'kënga e mëparshme nga njoftimi', 15_000)
      check('njoftimi: luaj, para dhe mbrapa punojnë dhe titulli ndjek këngën', true)
      screenshot('njoftimi-muzika-pas')
    } else {
      info('njoftimi i muzikës', 'uiautomator nuk e kapi panelin (kronometri); kontrollet provohen te seanca')
    }
    collapseShade()
    launch()
    // MusicBrainz përmes CapacitorHttp (V2-E1-16a): për "Kënga e dytë" GetSongBPM i imituar s'ka tempo, ndaj
    // app-i pyet MusicBrainz. Kërkesa del nga telefoni (jo nga WebView), ndaj shihet vetëm te `_meta`.
    const tempoRecord = await waitFor(async () => {
      const { _meta: meta } = await readDb(page, ['_meta'])
      return meta.find((entry) => entry.key === 'tempo:vrull|kënga e dytë') ?? null
    }, 'tempo e "Kënga e dytë"', 30_000).catch(() => null)
    info('MusicBrainz përmes CapacitorHttp', tempoRecord ? tempoRecord.value : 'pa përgjigje (MusicBrainz ose rrjeti i runner-it)')
    adb('shell', 'am', 'force-stop', PLAYER)
  }

  // D7. Anglishtja: njoftimi ndjek gjuhën e app-it.
  await chooseLanguage(page, 'en')
  await waitForNotificationTitle(4200, 'Incline Dumbbell Flye · Set 1 of 2')
  check('anglisht: njoftimi i seancës në anglisht', true, notification(4200).title)
  screenshot('pamja-anglisht')
  await chooseLanguage(page, 'sq')
  await waitForNotificationTitle(4200, 'Incline Dumbbell Flye · Seti 1 nga 2')

  // D8. Butoni mbrapa mbyll fletën e ushtrimeve dhe mbetet te seanca; "Mbyll stërvitjen" heq njoftimin.
  await goHome(page)
  await openSession(page)
  await clickButtonStarting(page, 'Ushtrimet e seancës, ')
  await waitFor(() => page.evaluate(`!!document.querySelector('[role="dialog"]')`), 'fleta e ushtrimeve')
  await pressBack()
  await waitFor(() => page.evaluate(`!document.querySelector('[role="dialog"]')`), 'mbrapa mbyll fletën')
  check('seanca: mbrapa mbyll fletën e ushtrimeve dhe mbetet te seanca', (await page.evaluate('location.pathname')) === '/seanca')
  await clickButtonStarting(page, 'Ushtrimet e seancës, ')
  await clickButton(page, 'Mbyll stërvitjen')
  await clickButton(page, 'Po, mbyll')
  await waitFor(async () => (await page.evaluate('location.pathname')).startsWith('/seanca/mbyllja/'), 'mbyllja e seancës')
  screenshot('mbyllja')
  await waitFor(() => !notification(4200) && !notification(4202), 'njoftimi i seancës i hequr', 15_000)
  check('"Mbyll stërvitjen" heq njoftimin e seancës', true)
  await clickButton(page, 'Mbaro')
  await waitForPath(page, '/')

  // ==== E. Trupi 3D, butoni mbrapa dhe tema ====
  await click(page, 'a[href="/progresi"]')
  await waitFor(() => page.evaluate(`!!document.querySelector('a[href="/progresi/trupi"]')`), 'Trupi te Progresi')
  await click(page, 'a[href="/progresi/trupi"]')
  await waitFor(() => page.evaluate(`!!document.querySelector('section[aria-label="Harta e trupit"]')`), 'harta e trupit', 30_000)
  const webgl = await page.evaluate(`(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) })()`)
  if (!webgl) {
    info('Trupi 3D', 'WebView-i i emulatorit nuk ka WebGL; modeli kontrollohet në telefon')
  } else {
    await clickButton(page, '3D')
    await waitFor(
      () => page.evaluate(`!!document.querySelector('[role="img"] canvas') && !document.body.innerText.includes('Po ngarkohet modeli')`),
      'modeli 3D',
      60_000,
    )
    check('Trupi: modeli 3D vizatohet nga APK-ja', !(await hasText(page, 'Modeli 3D nuk u ngarkua')))
    screenshot('trupi-3d')
    await clickButton(page, '2D')
  }
  await click(page, 'a[href="/"]')
  await waitForPath(page, '/')
  // Butoni mbrapa: nga biblioteka te Programi, pastaj te Sot.
  await click(page, 'a[href="/programi"]')
  await waitForPath(page, '/programi')
  await click(page, 'a[href="/programi/biblioteka"]')
  await waitForPath(page, '/programi/biblioteka')
  await pressBack()
  await waitForPath(page, '/programi')
  check('mbrapa kthen te faqja e mëparshme', true)
  await click(page, 'a[href="/"]')
  await waitForPath(page, '/')
  await click(page, 'a[aria-label="Profili dhe cilësimet"]')
  await waitForHeading(page, 'Cilësimet')
  // Rifreskimi në një rrugë të brendshme (serveri lokal i Capacitor-it kthen index.html).
  await page.send('Page.reload')
  await waitForHeading(page, 'Cilësimet')
  check('rifreskimi te /cilesimet mban faqen', true)
  check('"Dil" te fundi i Cilësimeve', await page.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Dil'); b.scrollIntoView(); return b.getBoundingClientRect().bottom <= innerHeight })()`))
  await page.evaluate(`[...document.querySelectorAll('a')].find((a) => (a.getAttribute('aria-label') ?? '').startsWith('Tema')).click()`)
  await waitFor(() => page.evaluate(`!!document.querySelector('input[type="radio"][value="light"]')`), 'Pamja')
  await page.evaluate(`document.querySelector('input[type="radio"][value="light"]').click()`)
  await waitFor(async () => (await page.evaluate(`localStorage.getItem('th-theme')`)) === 'light', 'ruajtja e temës')
  check('tema e çelët ruhet', (await page.evaluate('document.documentElement.className')) === '')
  const bandLight = await waitForBand('#F4F4F5')
  screenshot('pamja-dite')
  check('rripi i orës merr sfondin e temës së çelët', sameColor(bandLight, '#F4F4F5'), bandLight.join(','))
  await pressBack()
  await waitForHeading(page, 'Cilësimet')
  check('mbrapa nga Pamja kthen te Cilësimet', (await page.evaluate('location.pathname')) === '/cilesimet')
  const pendingReminders = `Capacitor.Plugins.LocalNotifications.getPending().then((r) => r.notifications.filter((n) => n.id >= 5000 && n.id < 5200).length)`
  check('rikujtuesit planifikohen pas lejes së njoftimeve', (await page.evaluate(pendingReminders)) > 0, `${await page.evaluate(pendingReminders)} njoftime`)
  page.close()
  // Mbrapa në fillim të historisë (app-i i sapohapur te Sot) e çon app-in në sfond pa e mbyllur.
  adb('shell', 'am', 'force-stop', PKG)
  page = await open()
  await waitForPath(page, '/')
  await waitForText(page, 'Java 0')
  await pressBack()
  await waitFor(() => !isForeground(), 'app-i në sfond me butonin mbrapa', 15_000)
  check('mbrapa në fillim të historisë e çon app-in në sfond, gjallë', pidOf() !== '')
  page.close()
  adb('shell', 'locksettings', 'clear', '--old', PIN)

  // ==== F. Instalim i ri (një mik): hyrja në gjuhën e telefonit, hapat e parë me gjuhën ====
  adb('uninstall', PKG)
  adb('install', apkV2)
  page = await open()
  await page.send('Page.reload')
  const phoneLanguage = String(await page.evaluate('(navigator.languages[0] ?? navigator.language).toLowerCase()')).split('-')[0]
  const english = phoneLanguage === 'en'
  await waitForHeading(page, english ? 'Welcome' : 'Mirë se erdhe')
  check('instalim i ri: hyrja në gjuhën e telefonit', (await page.evaluate('location.pathname')) === '/hyrja', phoneLanguage)
  const bandLogin = await waitForBand('#000000')
  check('rripi i orës te hyrja merr sfondin e temës', sameColor(bandLogin, '#000000'), bandLogin.join(','))
  screenshot('hyrja-v2')
  await type(page, 'input[type="email"]', EMAIL)
  await type(page, 'input[autocomplete="current-password"]', 'i-gabuar')
  await clickButton(page, english ? 'Sign in' : 'Hyr')
  await waitForText(page, english ? 'The email or password is not correct.' : 'Emaili ose fjalëkalimi nuk është i saktë.')
  check('fjalëkalimi i gabuar thuhet me fjalë', true)
  await type(page, 'input[autocomplete="current-password"]', PASSWORD)
  await clickButton(page, english ? 'Sign in' : 'Hyr')
  await waitForHeading(page, english ? 'Language and weight' : 'Gjuha dhe pesha')
  screenshot('hapi-gjuha')
  await clickButton(page, english ? 'Shqip' : 'English')
  await waitForHeading(page, english ? 'Gjuha dhe pesha' : 'Language and weight')
  check('hapat e parë: gjuha ndërrohet menjëherë', true)
  if (!english) await clickButton(page, 'Shqip')
  await waitForHeading(page, 'Gjuha dhe pesha')
  await page.evaluate(`document.querySelector('input[inputmode="decimal"]')?.focus()`)
  await type(page, 'input[inputmode="decimal"]', '80,5')
  await page.evaluate(`document.querySelector('input[inputmode="decimal"]').blur()`)
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Ditët dhe oraret')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Zgjidh programin')
  await clickButton(page, 'Fillo programin')
  await waitForPath(page, '/')
  await waitForText(page, 'Java 0')
  check('hapat e parë mbarojnë te Sot me Java 0, shqip', await hasText(page, 'Stërvitja 1 ·'))
  await waitFor(() => posted('user_settings').some((row) => row.language === 'sq'), 'gjuha te user_settings', 20_000)
  screenshot('sot-instalim-i-ri')

  // Përditësimi v2 → v3 nga app-i i v2, pasi gjuha është anglisht: njoftimi në anglisht (AppUpdaterPlugin.setLanguage).
  await chooseLanguage(page, 'en')
  const codeBefore = versionCode()
  const shaV3 = createHash('sha256').update(readFileSync(apkV3)).digest('hex')
  adb('shell', 'appops', 'set', PKG, 'REQUEST_INSTALL_PACKAGES', 'allow')
  const appDirV2 = adb('shell', 'run-as', PKG, 'pwd')
  check('v2: app-i e sheh lejen e instalimit', (await page.evaluate(`Capacitor.Plugins.AppUpdater.canInstall().then((r) => r.value)`)) === true)
  // Shkarkimi native me SHA-256, nga një skedar HTTPS publik që nuk ndryshon kurrë (Maven Central).
  const PROBE = 'https://repo1.maven.org/maven2/junit/junit/4.13.2/junit-4.13.2.pom'
  const probe = await fetch(PROBE).then((response) => (response.ok ? response.arrayBuffer() : null)).catch(() => null)
  if (!probe) {
    info('përditësimi', 'runner-i nuk e mori skedarin e provës; shkarkimi native nuk provohet këtë herë')
  } else {
    const probeSha = createHash('sha256').update(Buffer.from(probe)).digest('hex')
    const downloaded = await page.evaluate(`Capacitor.Plugins.AppUpdater.download({ url: '${PROBE}', sha256: '${probeSha}' }).then((r) => r.path, (e) => 'GABIM ' + e.code + ' ' + e.message)`)
    check('v2: shkarkimi native me SHA-256 të saktë', downloaded.endsWith('/cache/perditesimi.apk'), downloaded)
    const before = report.errors.length
    const refused = await page.evaluate(`Capacitor.Plugins.AppUpdater.download({ url: '${PROBE}', sha256: '${'1'.repeat(64)}' }).then(() => 'pranoi', (e) => e.code)`)
    await sleep(500)
    // Capacitor e shkruan refuzimin e qëllimshëm si console.error në build-in debug.
    report.errors.splice(before, report.errors.length - before, ...report.errors.slice(before).filter((text) => text !== 'Object' && !/HASH_MISMATCH|nuk përputhet/.test(text)))
    check('v2: shkarkimi me SHA-256 të gabuar refuzohet', refused === 'HASH_MISMATCH', refused)
  }
  adb('push', apkV3, '/data/local/tmp/th-v3.apk')
  adb('shell', 'run-as', PKG, 'cp', '/data/local/tmp/th-v3.apk', 'cache/perditesimi.apk')
  const installV3 = await page
    .evaluate(`Capacitor.Plugins.AppUpdater.install({ path: '${appDirV2}/cache/perditesimi.apk', sha256: '${shaV3}' }).then(() => 'nisi', (e) => e.message)`)
    .catch(() => 'nisi')
  let codeV3 = versionCode()
  for (let waited = 0; waited < 90_000 && !(codeV3 > codeBefore); waited += 1000) {
    await sleep(1000)
    codeV3 = versionCode()
  }
  check('v2 → v3: instalohet nga app-i', codeV3 > codeBefore, `${installV3}; ${codeBefore} -> ${codeV3}`)
  page.close()
  const updatedEn = await waitFor(() => notifications().find((entry) => entry.title.startsWith('Vrull')), 'njoftimi i përditësimit', 45_000).catch(() => null)
  check('v2 → v3: njoftimi në anglisht pas setLanguage', updatedEn?.title === 'Vrull was updated', updatedEn ? `${updatedEn.title} · ${updatedEn.text}` : 'asnjë')

  // Pa internet: app-i hapet direkt te Sot.
  await setNetwork(false)
  adb('shell', 'am', 'force-stop', PKG)
  page = await open()
  await waitForPath(page, '/')
  await waitForText(page, 'Week 0')
  check('pa internet pas hyrjes, hapet direkt te Sot', (await page.evaluate('navigator.onLine')) === false)
  screenshot('sot-pa-internet')
  page.close()
  await setNetwork(true)

  const errors = report.errors.filter((text) => !ignoredError(text))
  check('asnjë gabim JavaScript', errors.length === 0, errors.join(' | '))
  report.ok = true
} catch (error) {
  report.ok = false
  report.failure = String(error?.stack ?? error)
  console.error(report.failure)
  try {
    screenshot('gabim')
    writeFileSync(join(outDir, 'njoftimet.txt'), adb('shell', 'dumpsys', 'notification', '--noredact'))
  } catch {
    // Ekrani mund të mos jetë i disponueshëm nëse emulatori ka rënë.
  }
  try {
    await setNetwork(true)
  } catch {
    // Rrjeti rikthehet me emulatorin e ri.
  }
} finally {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
