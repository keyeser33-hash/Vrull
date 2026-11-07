// Prova e APK-së në një Android virtual (emulator), përmes adb dhe Chrome DevTools Protocol.
// Përdorimi: node scripts/android-smoke.mjs <dosja-e-rezultateve> <v1.apk> <v2.apk>
// v1 dhe v2 janë build-e debug me të njëjtin çelës, v2 me version më të lartë. Build-et e provës
// drejtohen te https://smoke.invalid (VITE_SUPABASE_URL): çdo kërkesë drejt Supabase kapet këtu
// me CDP (Fetch) dhe merr një përgjigje të imituar; asnjë kërkesë nuk arrin te projekti i vërtetë.
//
// Kontrollon: hyrja (edhe me fjalëkalim të gabuar), katër hapat e hyrjes së parë, Sot me
// "Java 0 · Stërvitja 1", pa shirit veprimesh, rripi i orës sipas temës, rifreskimi në një rrugë
// të brendshme, butoni mbrapa, tema, përditësimi v1 -> v2 pa humbur sesionin dhe të dhënat,
// dhe hapja pa internet direkt te Sot.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PKG = 'al.traininghub.app'
const SUPABASE = 'smoke.invalid'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const EMAIL = 'prove@example.com'
const PASSWORD = 'fjalekalim-prove'
const [outDir = 'smoke-out', apkV1, apkV2] = process.argv.slice(2)
if (!apkV1 || !apkV2) {
  console.error('Përdorimi: node scripts/android-smoke.mjs <dosja> <v1.apk> <v2.apk>')
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

const report = { checks: [], errors: [], requests: [] }
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8' }).trim()

function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK ' : 'GABIM'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) throw new Error(`Prova dështoi: ${name} ${detail}`)
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

function screenshot(name) {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 })
  writeFileSync(join(outDir, `${name}.png`), png)
}

// Ngjyra e rripit të orës (lart, larg orës, ikonave dhe kamerës në mes), nga screencap i papërpunuar:
// kokë me gjerësinë dhe lartësinë, pastaj piksela RGBA.
function statusBandColor() {
  const raw = execFileSync('adb', ['exec-out', 'screencap'], { maxBuffer: 64 * 1024 * 1024 })
  const width = raw.readUInt32LE(0)
  const height = raw.readUInt32LE(4)
  const header = raw.length - width * height * 4
  const x = Math.round(width * 0.35)
  const y = 12
  const offset = header + (y * width + x) * 4
  return [raw[offset], raw[offset + 1], raw[offset + 2]]
}

function sameColor(actual, hex) {
  const expected = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return actual.every((value, i) => Math.abs(value - expected[i]) <= 4)
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

function pidOf() {
  try {
    return adb('shell', 'pidof', PKG)
  } catch {
    return ''
  }
}

function launch() {
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`)
}

function setNetwork(enabled) {
  for (const service of ['wifi', 'data']) adb('shell', 'svc', service, enabled ? 'enable' : 'disable')
}

// Emulatori në CI shfaq ndonjëherë "Process system isn't responding" pas nisjes. Dritaret e
// sistemit mbyllen para çdo shtypjeje butoni, që butoni të arrijë te app-i dhe jo te dritarja.
async function pressBack() {
  await waitFor(() => {
    adb('shell', 'am', 'broadcast', '-a', 'android.intent.action.CLOSE_SYSTEM_DIALOGS')
    return adb('shell', 'dumpsys', 'window').split('\n').some(
      (line) => line.includes('mCurrentFocus') && line.includes(PKG),
    )
  }, 'app-i në fokus para butonit mbrapa', 20_000)
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK')
}

// Shiriti i veprimeve të Android-it nuk duhet të shfaqet mbi faqe. `action_bar_root` është
// korniza bazë e çdo dritareje AppCompat, jo shiriti, prandaj kërkohen vetëm id-të e shiritit.
function hasActionBar() {
  adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
  const ui = adb('shell', 'cat', '/sdcard/ui.xml')
  return /resource-id="[^"]*:id\/(action_bar|action_bar_container|toolbar)"/.test(ui)
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

/** Përgjigja e imituar për një kërkesë drejt Supabase: [status, trupi]. */
function fakeResponse(request) {
  const url = new URL(request.url)
  const body = request.postData ? JSON.parse(request.postData) : null
  if (url.pathname === '/auth/v1/token') {
    if (body?.email !== EMAIL || body?.password !== PASSWORD) {
      return [400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }]
    }
    return [200, fakeSession()]
  }
  if (url.pathname.startsWith('/rest/v1/')) {
    if (request.method === 'GET') return [200, []]
    // upsert me return=representation: serveri kthen rreshtat me kursorin e tij.
    const rows = (Array.isArray(body) ? body : [body]).map((row) => {
      serverClock += 1
      return { ...row, server_updated_at: new Date(serverClock).toISOString().replace('Z', '+00:00') }
    })
    return [201, rows]
  }
  return [404, { message: 'not found' }]
}

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
    { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, DELETE, OPTIONS' },
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
      }, 10_000)
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
    if (response.result?.exceptionDetails) throw new Error(response.result.exceptionDetails.text)
    return response.result?.result?.value
  }
  await send('Fetch.enable', { patterns: [{ urlPattern: `*${SUPABASE}*`, requestStage: 'Request' }] })
  await send('Runtime.enable')
  await send('Log.enable')
  return { send, evaluate, close: () => ws.close() }
}

const heading = (page) => page.evaluate(`document.querySelector('h1')?.textContent ?? ''`)
const waitForHeading = (page, text) => waitFor(async () => (await heading(page)) === text, `titulli "${text}"`)
const waitForText = (page, text) =>
  waitFor(() => page.evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), `teksti "${text}"`)
const click = (page, selector) => page.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
const clickButton = (page, label) =>
  page.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click()`)

// Vendos vlerën si tastiera, që React ta marrë (setter-i native dhe ngjarja input).
const type = (page, selector, value) =>
  page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)

try {
  // Nis nga një pajisje pa app-in; çinstalimi dështon kur s'ka çfarë të heqë.
  try {
    adb('uninstall', PKG)
  } catch {
    // App-i nuk ishte i instaluar.
  }

  // 1. Instalimi dhe hapja e v1: pa sesion, app-i hap hyrjen.
  adb('install', apkV1)
  const codeV1 = versionCode()
  check('v1 instalohet', codeV1 !== null, `versionCode ${codeV1}`)
  launch()
  let page = await connect()
  // Rifreskim pasi dëgjuesit janë gati, që të kapet çdo gabim i ngarkimit.
  await page.send('Page.reload')
  await waitForHeading(page, 'Training Hub')
  check('pa sesion hapet hyrja', (await page.evaluate('location.pathname')) === '/hyrja')
  check('tema OLED si parazgjedhje', (await page.evaluate('document.documentElement.className')) === 'dark oled')
  check('pa shirit veprimesh mbi faqe', !hasActionBar())
  const bandOled = statusBandColor()
  check('rripi i orës në OLED është i zi', sameColor(bandOled, '#000000'), bandOled.join(','))
  screenshot('1-hyrja')

  // 2. Hyrja: fjalëkalimi i gabuar thuhet me fjalë; pastaj hyrja e saktë.
  const started = Date.now()
  await type(page, 'input[type="email"]', EMAIL)
  await type(page, 'input[autocomplete="current-password"]', 'i-gabuar')
  await clickButton(page, 'Hyr')
  await waitForText(page, 'Email-i ose fjalëkalimi nuk është i saktë.')
  check('fjalëkalimi i gabuar thuhet me fjalë', true)
  await type(page, 'input[autocomplete="current-password"]', PASSWORD)
  await clickButton(page, 'Hyr')

  // 3. Hapat e hyrjes së parë.
  await waitForHeading(page, 'Sa peshon sot?')
  screenshot('2-pesha')
  await type(page, 'input[inputmode="decimal"]', '80,5')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Kur stërvitesh?')
  screenshot('3-stervitja')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Kur zgjohesh dhe kur fle?')
  await clickButton(page, 'Vazhdo')
  await waitForHeading(page, 'Programi yt')
  await clickButton(page, 'Fillo programin')
  await waitForHeading(page, 'Sot')
  await waitForText(page, 'Java 0 · Stërvitja 1')
  check('hyrja e parë përfundon te Sot me "Java 0 · Stërvitja 1"', true, `${Math.round((Date.now() - started) / 1000)} s`)
  // Sinkronizimi pret 2 s qetësi pas shkrimit të fundit, pastaj dërgon.
  await waitFor(() => report.requests.some((line) => line.startsWith('POST /rest/v1/user_settings')), 'dërgimi i profilit', 20_000)
  check('shkrimet arrijnë te serveri i imituar', true)
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
  const navInside = await page.evaluate(`(() => {
    const nav = document.querySelector('nav[aria-label="Kryesore"]').getBoundingClientRect()
    return nav.bottom <= innerHeight + 0.5 && nav.height >= 56
  })()`)
  check('navigimi poshtë brenda ekranit', navInside, JSON.stringify(report.insets))
  check('pa scroll anësor', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
  check('titulli "Sot" brenda ekranit', await page.evaluate(`document.querySelector('h1').getBoundingClientRect().top >= 0`))
  screenshot('4-sot-oled')

  // 4. Rifreskimi në një rrugë të brendshme (serveri lokal i Capacitor-it kthen index.html).
  await click(page, 'a[aria-label="Cilësimet"]')
  await waitForHeading(page, 'Cilësimet')
  await page.send('Page.reload')
  await waitForHeading(page, 'Cilësimet')
  check('rifreskimi te /cilesimet mban faqen', true)

  // 5. Butoni mbrapa: kthehet te faqja e mëparshme.
  await click(page, 'a[href="/programi"]')
  await waitForHeading(page, 'Programi')
  await pressBack()
  await waitForHeading(page, 'Cilësimet')
  check('mbrapa kthen te faqja e mëparshme', true)
  page.close()

  // 6. Tema e çelët zgjidhet nga cilësimet dhe ruhet; mbrapa në fillim e çon app-in në sfond.
  adb('shell', 'am', 'force-stop', PKG)
  launch()
  page = await connect()
  await page.send('Page.reload')
  await waitForHeading(page, 'Sot')
  await click(page, 'a[aria-label="Cilësimet"]')
  await waitForHeading(page, 'Cilësimet')
  await page.evaluate(`document.querySelector('input[type="radio"][value="light"]').click()`)
  await waitFor(async () => (await page.evaluate(`localStorage.getItem('th-theme')`)) === 'light', 'ruajtja e temës')
  check('tema e çelët ruhet', (await page.evaluate('document.documentElement.className')) === '')
  await sleep(500)
  screenshot('5-cilesimet-light-v1')
  const bandLight = statusBandColor()
  check('rripi i orës merr sfondin e temës së çelët', sameColor(bandLight, '#FAFAFA'), bandLight.join(','))
  await pressBack()
  await waitForHeading(page, 'Sot')
  await pressBack()
  await waitFor(() => !isForeground(), 'app-i në sfond me butonin mbrapa', 15_000)
  check('mbrapa në fillim të historisë e çon app-in në sfond', true)
  check('app-i mbetet gjallë në sfond', pidOf() !== '')
  page.close()

  // 7. Përditësimi v1 -> v2: sesioni, profili dhe tema mbeten; app-i hapet direkt te Sot.
  adb('install', '-r', apkV2)
  const codeV2 = versionCode()
  check('v2 instalohet mbi v1', codeV2 !== null && codeV2 > codeV1, `${codeV1} -> ${codeV2}`)
  launch()
  page = await connect()
  await page.send('Page.reload')
  await waitForHeading(page, 'Sot')
  await waitForText(page, 'Java 0 · Stërvitja 1')
  check('pas përditësimit: pa hyrje të re, direkt te Sot me programin', true)
  check('tema e çelët mbetet pas përditësimit', (await page.evaluate(`localStorage.getItem('th-theme')`)) === 'light')
  check('tema aplikohet para vizatimit', (await page.evaluate('document.documentElement.className')) === '')
  await sleep(500)
  screenshot('6-sot-light-v2')
  const bandAfterUpdate = statusBandColor()
  check('rripi i orës mbetet i çelët pas përditësimit', sameColor(bandAfterUpdate, '#FAFAFA'), bandAfterUpdate.join(','))
  page.close()

  // 8. Pa internet: app-i hapet direkt te Sot.
  setNetwork(false)
  adb('shell', 'am', 'force-stop', PKG)
  launch()
  page = await connect()
  await waitForHeading(page, 'Sot')
  await waitForText(page, 'Java 0 · Stërvitja 1')
  check('pa internet pas hyrjes, hapet direkt te Sot', (await page.evaluate('navigator.onLine')) === false)
  screenshot('7-sot-pa-internet')
  page.close()
  setNetwork(true)

  check('asnjë gabim JavaScript', report.errors.length === 0, report.errors.join(' | '))
  report.ok = true
} catch (error) {
  report.ok = false
  report.failure = String(error?.stack ?? error)
  console.error(report.failure)
  try {
    screenshot('gabim')
  } catch {
    // Ekrani mund të mos jetë i disponueshëm nëse emulatori ka rënë.
  }
  try {
    setNetwork(true)
  } catch {
    // Rrjeti rikthehet me emulatorin e ri.
  }
} finally {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
