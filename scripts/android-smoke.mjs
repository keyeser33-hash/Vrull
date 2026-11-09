// Prova e APK-së në një Android virtual (emulator), përmes adb dhe Chrome DevTools Protocol (V2-E1-16).
// Përdorimi: node scripts/android-smoke.mjs <dosja> <v1.apk> <v2.apk> <v3.apk> [muzika.apk]
// - v1: 0.16.0 nga tag-u (UI e v1), v2 dhe v3: kjo degë me dy versione më të larta. Të gjitha build-e debug me
//   të njëjtin çelës, të drejtuara te https://smoke.invalid (VITE_SUPABASE_URL): çdo kërkesë drejt Supabase
//   kapet këtu me CDP (Fetch) dhe merr një përgjigje të imituar; asnjë kërkesë nuk arrin te projekti i vërtetë.
// - muzika.apk: app-i i provës android-test/music-player (sesion medie pa zë); pa të, prova e muzikës
//   kontrollon vetëm ikonën "Lidh muzikën tënde" dhe lejen.
//
// Rrjedha: v1 me të dhënat e veta (seanca me një set, ushqimi, matja, fotoja) → përditësimi nga app-i te v2
// ("Vrull u përditësua" shqip, pa gjuhë të dërguar) → v2 i gjen të dhënat → seanca: "Ruaj setin", pushimi me
// ekran të kyçur, seti nga njoftimi (prekja e dyfishtë, ekrani i kyçur, procesi i vrarë), videot e formës,
// muzika, anglishtja, mbyllja → butoni mbrapa, tema → instalim i ri: hyrja dhe hapat e parë me gjuhën →
// përditësimi v2 → v3 në anglisht → hapja pa internet.
//
// Pjesët: A–C (v1, përditësimi, v2 me të dhënat) janë baza; kur dështojnë, prova ndalet. Pjesët e tjera
// (njoftimi, kamera, muzika, anglishtja, mbyllja, navigimi, instalimi) e shënojnë gabimin, e kthejnë app-in te
// Sot dhe vazhdojnë, që një nisje të tregojë të gjitha gabimet. SMOKE_SKIP=kamera,muzika i kapërcen
// (docs/MESIMET.md: pas një dështimi përsërit vetëm pjesën që dështoi).
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
/** Gabimet e konsolës me objekte, që lexohen me CDP pasi vijnë (Runtime.getProperties). */
const errorDetails = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
// Çdo thirrje e adb-së ka afat: një adb i bllokuar e ndal provën me gabim, jo deri te afati i punës.
const ADB_OPTIONS = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 }
const adb = (...args) => execFileSync('adb', args, ADB_OPTIONS).trim()
const shell = (command) => execFileSync('adb', ['shell', command], ADB_OPTIONS).trim()

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

const SKIP = new Set((process.env.SMOKE_SKIP ?? '').split(',').map((id) => id.trim()).filter(Boolean))
/** Pjesët që dështuan ose nuk u nisën, me arsyen. */
const sections = []
let page

/** Kthen app-in te Sot pas një pjese që dështoi: paneli i mbyllur, rrjeti, ekrani i shkyçur, faqja e re. */
async function recover() {
  const steps = [
    () => collapseShade(),
    () => setNetwork(true),
    async () => {
      if (keyguardShowing() !== false) await unlock()
    },
    () => adb('shell', 'am', 'force-stop', PLAYER),
  ]
  for (const step of steps) {
    try {
      await step()
    } catch {
      // Hapi nuk kishte çfarë të bënte.
    }
  }
  try {
    page?.close()
  } catch {
    // Faqja ishte mbyllur.
  }
  page = await open()
  await goHome(page)
}

/**
 * Një pjesë e provës: kapërcehet me SMOKE_SKIP ose kur pjesa nga e cila varet nuk kaloi; gabimi shënohet,
 * app-i kthehet te Sot dhe prova vazhdon me pjesën tjetër.
 */
async function section(id, title, run, { after } = {}) {
  if (SKIP.has(id)) {
    sections.push({ id, result: 'skipped', detail: 'SMOKE_SKIP' })
    console.log(`---- ${id} · ${title}: kapërcehet (SMOKE_SKIP)`)
    return
  }
  const before = after && sections.find((entry) => entry.id === after)
  if (before && before.result !== 'ok') {
    sections.push({ id, result: 'skipped', detail: `varet nga ${after}` })
    console.log(`---- ${id} · ${title}: nuk niset, varet nga ${after}`)
    return
  }
  console.log(`---- ${id} · ${title}`)
  const start = Date.now()
  try {
    await run()
    sections.push({ id, result: 'ok', seconds: Math.round((Date.now() - start) / 1000) })
  } catch (error) {
    const message = String(error?.message ?? error)
    sections.push({ id, result: 'failed', detail: message, stack: String(error?.stack ?? '') })
    console.error(`GABIM te pjesa ${id}: ${message}`)
    try {
      screenshot(`gabim-${id}`)
      writeFileSync(join(outDir, `njoftimet-${id}.txt`), adb('shell', 'dumpsys', 'notification', '--noredact'))
    } catch {
      // Emulatori mund të mos përgjigjet.
    }
    await recover()
  }
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

/** Vendos PIN-in kur mungon, që një pjesë me ekran të kyçur të mos varet nga pjesët para saj. */
function ensurePin() {
  try {
    adb('shell', 'locksettings', 'set-pin', PIN)
  } catch {
    // PIN-i ishte vendosur nga një pjesë më parë.
  }
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
      // Koha e builder-it (= kur u postua); mCreationTimeMs mbetet ajo e postimit të parë me të njëjtën id.
      when: Number(block.match(/\bwhen=(\d+)/)?.[1] ?? 0),
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

/** SharedPreferences "vrull_reminders" e rikujtuesve të zgjuar (ReminderNotifier.java). */
function reminderPrefs() {
  let xml = ''
  try {
    xml = adb('shell', 'run-as', PKG, 'cat', 'shared_prefs/vrull_reminders.xml')
  } catch {
    return { queue: [], snoozed: {}, log: [], list: [] }
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
  return { queue: value('queue') ?? [], snoozed: value('snoozed') ?? {}, log: value('log') ?? [], list: value('list') ?? [] }
}

/** Një buton i njoftimit me këtë tekst (paneli ose ekrani i kyçur), pa dallim shkronjash. */
function notificationButton(label) {
  const wanted = label.toLocaleLowerCase()
  return (uiNodes() ?? []).find((node) => node.text.toLocaleLowerCase() === wanted && node.x > 0) ?? null
}

/**
 * Prekja e një butoni të njoftimit. Ekrani i kyçur dhe paneli e tregojnë njoftimin të mbledhur, pa
 * butona: shigjeta "Zgjero" pranë titullit e hap, si përdoruesi.
 */
async function tapNotificationButton(label, title) {
  for (let attempt = 0; attempt < 3 && !notificationButton(label); attempt++) {
    const nodes = uiNodes() ?? []
    const heading = nodes.find((node) => node.text === title)
    const expand = nodes
      .filter((node) => /expand_button$/.test(node.id) || /^(Expand|Zgjero)/i.test(node.desc))
      .sort((a, b) => Math.abs(a.y - (heading?.y ?? a.y)) - Math.abs(b.y - (heading?.y ?? b.y)))[0]
    if (!expand) break
    shell(`input tap ${expand.x} ${expand.y}`)
    await sleep(1500)
  }
  const button = await waitFor(() => notificationButton(label), `butoni "${label}" te njoftimi`, 15_000)
  shell(`input tap ${button.x} ${button.y}`)
}

/** Prekja e "Ruaj setin" te njoftimi i dukshëm (ekrani i kyçur ose paneli). `times` 2 = prekja e dyfishtë. */
function tapSaveOnce(label, times) {
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

/**
 * Prekja e "Ruaj setin" derisa njoftimi të kalojë te `nextTitle`. Paneli ose ekrani i kyçur mund të lëvizë
 * nga një njoftim tjetër që sapo erdhi (prekja bie jashtë butonit dhe nuk ruan asgjë): butoni gjendet sërish
 * dhe prekja përsëritet, deri në 3 herë. Një prekje që nuk ruajti asgjë nuk ndikon te numri i seteve.
 */
async function tapSave(label, nextTitle, times = 1) {
  for (let attempt = 1; ; attempt++) {
    await sleep(800)
    // Ekrani i kyçur i sapozgjuar i vizaton njoftimet pak më vonë: butoni pritet, jo kërkohet një herë.
    await waitFor(() => emberButton(), `butoni "Ruaj setin" te njoftimi (${label})`, 10_000).catch(() => null)
    const result = tapSaveOnce(label, times)
    const moved = await waitFor(() => notification(4200)?.title === nextTitle, `njoftimi 4200: "${nextTitle}"`, 15_000).catch(() => false)
    if (moved) {
      if (attempt > 1) info(label, `prekja u përsërit ${attempt} herë (paneli lëvizi)`)
      return result
    }
    if (attempt === 3) throw new Error(`Prekja te njoftimi nuk e ruajti setin (${label}); njoftimi: "${notification(4200)?.title ?? 'asnjë'}"`)
  }
}

/**
 * Fsheh për 10 minuta (snooze) njoftimet e tjera të app-it ("Pushimi mbaroi", "Vrull u përditësua" dhe grupin e
 * tyre), që njoftimi i seancës të jetë i pari te paneli dhe Android-i ta tregojë të zgjeruar, me rreshtin e muzikës.
 */
function onlySessionNotification() {
  const dump = adb('shell', 'dumpsys', 'notification', '--noredact')
  const keys = [...new Set([...dump.matchAll(/key=(0\|al\.traininghub\.app\|[^\s:]+)/g)].map((match) => match[1]))]
  const others = keys.filter((key) => !key.startsWith(`0|${PKG}|4200|`))
  for (const key of others) {
    try {
      shell(`cmd notification snooze --for 600000 '${key}'`)
    } catch (error) {
      info('njoftimi i fshehur', `${key}: ${error.message}`)
    }
  }
  return others
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
  // Kutia e AI-së (log-parse, V2-E2-13): një draft si nga AI-ja; foto e pjatës (V2-E2-16) kthen një ushqim të ri.
  if (url.pathname === '/functions/v1/log-parse') {
    const food = (name, grams, per100, meal) => ({ said: name, ref: null, name, grams, portion: '', estimated: !!body?.image, per100, options: [], meal, time: null, day: 0 })
    const draft = { foods: [], water: [], supplements: [], sets: [], answer: null, notUnderstood: [] }
    const usage = { inputTokens: 2500, outputTokens: 170, cacheWriteTokens: 0, cacheReadTokens: 6200, costEur: 0.0004, ms: 3000 }
    const month = { month: '2026-12-01', spentEur: 0.01, limitEur: 10 }
    // Një trup i madh (fotoja) mund të vijë pa postData te Fetch.requestPaused (CDP e shkurton): atëherë është fotoja.
    if (body?.image || (request.hasPostData && !request.postData)) {
      report.photoRequest = body?.image ? { mediaType: body.image.mediaType, bytes: Math.round((body.image.data.length * 3) / 4), text: body.text } : { mediaType: null, bytes: null, text: null }
      return [200, { draft: { ...draft, foods: [food('Makarona me karkaleca', 350, { kcal: 165, proteinG: 7.5, carbsG: 20, fatG: 6 }, 'dinner')] }, usage, month }]
    }
    return [200, { draft: { ...draft, foods: [food('Pulë e pjekur', 200, { kcal: 239, proteinG: 27.3, carbsG: 0, fatG: 13.6 }, 'lunch')], water: [{ ml: 500, time: null, day: 0 }] }, usage, month }]
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
async function connectOnce() {
  const socket = await waitFor(() => {
    const pid = pidOf()
    const name = `webview_devtools_remote_${pid}`
    return pid && adb('shell', 'cat', '/proc/net/unix').includes(name) ? name : null
  }, 'socket-i i WebView-së')
  adb('forward', '--remove-all')
  adb('forward', 'tcp:9222', `localabstract:${socket}`)
  const target = await waitFor(async () => {
    // Me afat: një socket i vjetër mund ta pranojë lidhjen pa u përgjigjur kurrë.
    const list = await (await fetch('http://127.0.0.1:9222/json', { signal: AbortSignal.timeout(5000) })).json()
    return list.find((entry) => entry.type === 'page')
  }, 'faqja në WebView')

  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close()
      reject(new Error('WebSocket-i i WebView-së nuk u hap brenda 10 s'))
    }, 10_000)
    ws.onopen = () => {
      clearTimeout(timer)
      resolve()
    }
    ws.onerror = (error) => {
      clearTimeout(timer)
      reject(error)
    }
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
    // Çdo gabim mban kontrollin e fundit që kaloi, që të dihet ku ndodhi.
    const after = report.checks.at(-1)?.name ?? 'fillimi'
    if (message.method === 'Runtime.exceptionThrown') {
      report.errors.push(`${message.params.exceptionDetails.exception?.description ?? 'exception'} [pas: ${after}]`)
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      // Një objekt tregohet me fushat e tij (p.sh. refuzimi i një plugin-i: { code, message }).
      const text = async (arg) => {
        if (arg.value !== undefined) return arg.value
        if (arg.objectId) {
          const properties = await send('Runtime.getProperties', { objectId: arg.objectId, ownProperties: true }).catch(() => null)
          const fields = (properties?.result?.result ?? []).filter((field) => field.value && 'value' in field.value).map((field) => `${field.name}: ${field.value.value}`)
          if (fields.length) return `{${fields.join(', ')}}`
        }
        return arg.description
      }
      errorDetails.push(Promise.all(message.params.args.map(text)).then((parts) => `${parts.join(' ')} [pas: ${after}]`))
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      // 400 i hyrjes me fjalëkalim të gabuar është pjesë e provës, jo gabim.
      if (!/status of 400/.test(message.params.entry.text)) report.errors.push(`${message.params.entry.text} ${message.params.entry.url ?? ''}`.trim())
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
  try {
    await send('Fetch.enable', { patterns: [{ urlPattern: `*${SUPABASE}*`, requestStage: 'Request' }] })
    await send('Runtime.enable')
    await send('Log.enable')
  } catch (error) {
    ws.close()
    throw error
  }
  return { send, evaluate, close: () => ws.close() }
}

/**
 * Lidhja me WebView-në. WebView-ja e nisur për herë të parë pas ndezjes së emulatorit mund të mos përgjigjet
 * brenda afatit ("Log.enable pa përgjigje"): lidhja mbyllet dhe provohet sërish, deri në 3 herë.
 */
async function connect() {
  for (let attempt = 1; ; attempt++) {
    try {
      return await connectOnce()
    } catch (error) {
      if (attempt === 3) throw error
      info('lidhja me WebView', `përpjekja ${attempt}: ${error.message}; provohet sërish`)
      await sleep(3000)
    }
  }
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
// Ikona e muzikës te kreu i seancës (0.23): emri mban këngën dhe tempon ("Hap Trupi në ritëm: Prova e ritmit, …, 128 BPM").
const musicLabel = (page) =>
  page.evaluate(`[...document.querySelectorAll('header button')].map((b) => ${NORMALIZE}(b.getAttribute('aria-label'))).find((label) => label.startsWith('Hap Trupi në ritëm')) ?? null`)
const clickButtonStarting = async (page, prefix) => {
  const find = `[...document.querySelectorAll('button')].find((b) => ${NORMALIZE}(b.getAttribute('aria-label') ?? b.textContent).startsWith(${JSON.stringify(prefix)}))`
  await waitFor(() => page.evaluate(`!!${find}`), `butoni "${prefix}…"`, 20_000)
  await page.evaluate(`${find}.click()`)
}

// Vendos vlerën si tastiera, që React ta marrë (setter-i native dhe ngjarja input).
const type = async (page, selector, value) => {
  await waitFor(() => page.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), selector, 20_000)
  await page.evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)})
    input.focus()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}

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

/** Pret që seanca të tregojë ushtrimin dhe setin (setet nga njoftimi zbatohen pak pas hapjes). */
const atStep = (page, expected) =>
  waitFor(async () => JSON.stringify(await sessionStep(page)) === JSON.stringify(expected), `${expected.exercise}, ${expected.set}`, 15_000).then(
    () => true,
    async () => {
      info('seanca', JSON.stringify(await sessionStep(page)))
      return false
    },
  )

const restEndsAt = (page) =>
  page.evaluate(`(() => {
    const key = Object.keys(localStorage).find((name) => name.startsWith('th:rest:'))
    return key ? JSON.parse(localStorage.getItem(key)).endsAt : null
  })()`)

/** "Pushimi mbaroi" (4201) vjen brenda 2 s nga fundi i pushimit, me ekran të fikur. */
async function expectRestDone(label, endsAt) {
  const before = notification(4201)?.when ?? null
  const alarmsBefore = alarmLines()
  await sleep(Math.max(0, endsAt - deviceNow()) + 4000)
  let done = notification(4201)
  const delta = done ? done.when - endsAt : null
  report[label] = { endsAt, posted: done?.when ?? null, deltaMs: delta, title: done?.title ?? null, before, alarmsBefore, prefs: sessionPrefs().rest }
  if (!(done && Math.abs(delta) <= 2000)) {
    // Diagnoza: alarmet e app-it dhe a vjen njoftimi më vonë.
    report[label].alarmsAfter = alarmLines()
    done = await waitFor(() => (notification(4201)?.when ?? 0) > endsAt - 2000 && notification(4201), 'njoftimi i vonuar', 60_000).catch(() => null)
    report[label].late = done ? done.when - endsAt : null
    writeFileSync(join(outDir, `alarmet-${label.replace(/\W+/g, '-')}.txt`), adb('shell', 'dumpsys', 'alarm'))
  }
  check(`${label}: "Pushimi mbaroi" vjen me ekran të kyçur, brenda 2 s`, delta !== null && report[label].alarmsAfter === undefined && notification(4201)?.title === 'Pushimi mbaroi', JSON.stringify(report[label]))
}

/** Alarmet e app-it te AlarmManager (për diagnozë). */
function alarmLines() {
  return adb('shell', 'dumpsys', 'alarm')
    .split('\n')
    .filter((line) => line.includes(PKG))
    .slice(0, 8)
    .map((line) => line.trim())
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

// Jo gabime të app-it:
// - një kërkesë drejt Supabase-s së imituar para se CDP të lidhet (procesi sapo nisi; smoke.invalid nuk
//   ekziston jashtë provës), ose pa rrjet;
// - refuzimet e plugin-eve që app-i i pret dhe i trajton, që Capacitor i shkruan si console.error në build-in
//   debug: muzika pa "Qasjen te njoftimet" (NO_ACCESS) dhe shkarkimi me SHA-256 të gabuar (HASH_MISMATCH).
const ignoredError = (text) =>
  /(ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED).*smoke\.invalid|smoke\.invalid.*(ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED)/.test(text) ||
  /^\{.*code: (NO_ACCESS|HASH_MISMATCH)\b/.test(text) ||
  // CapacitorHttp në build-in debug shkruan çdo refuzim si console.error, edhe kur app-i e kap: kërkimi i
  // tempos (MusicBrainz/AcousticBrainz) mbaron me "offline" kur rrjeti i emulatorit vonon.
  /^\{message: timeout, code: SocketTimeoutException\}/.test(text)

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
  page = await open()
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
  check('v2: pa hyrje të re, direkt te Sot me seancën e hapur të v1', await waitFor(() => hasText(page, '1 nga 21 sete'), '1 nga 21 sete', 15_000).then(() => true, () => false))
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
  screenshot('v2-progresi')
  // 0.23: Progresi tregon vetëm rreshtin e fotove; fotot dhe shtimi i tyre janë te faqja e fotove.
  await click(page, 'a[href="/progresi/fotot"]')
  await waitFor(() => page.evaluate(`!!document.querySelector('button[aria-label^="Para, "]')`), 'fotoja "Para" te faqja e fotove')
  check('v2: Progresi tregon matjen dhe foton e v1', true)
  await click(page, 'a[href="/ushqimi"]')
  // Dita e ushqimit (V46) ndërrohet 3 orë para zgjimit: para saj (p.sh. në 01:20) Ushqimi tregon ditën
  // e djeshme, ndërsa vakti i v1 u regjistrua me datën kalendarike të sotme.
  const foodDayIsYesterday = await page.evaluate(`new Promise((resolve) => {
    const request = indexedDB.open('training-hub')
    request.onsuccess = () => {
      const query = request.result.transaction('user_settings').objectStore('user_settings').getAll()
      query.onsuccess = () => {
        const [hours, minutes] = String(query.result[0]?.wake_time ?? '07:00').split(':').map(Number)
        const now = new Date()
        resolve(now.getHours() * 60 + now.getMinutes() < hours * 60 + minutes - 180)
      }
    }
    request.onerror = () => resolve(false)
  })`)
  if (foodDayIsYesterday) {
    info('v2: Ushqimi', 'para ndërrimit të ditës së ushqimit (V46): vakti i v1 i përket ditës që vjen; kontrollohet vetëm te baza')
  } else {
    // 0.23: vaktet e regjistruara mblidhen në një rresht ("1 vakt i regjistruar").
    await waitFor(() => page.evaluate(`/\\d+ vakte? (?:i|të) regjistruar/.test(${PAGE_TEXT})`), 'rreshti "vakt i regjistruar"')
    check('v2: Ushqimi tregon vaktin e regjistruar te v1', true)
  }
  screenshot('v2-ushqimi')
  await click(page, 'a[href="/"]')

  // ==== D. Seanca dhe seti nga njoftimi (V2-E1-07, V2-E1-08) ====
  await section('njoftimi', 'Seanca dhe seti nga njoftimi', async () => {
    await openSession(page)
    const ids = await exerciseIds(page)
    const sessionId = report.v1.session
    check('seanca e v1 vazhdon te v2: Bench Press, seti 2 nga 3', await atStep(page, { exercise: 'Bench Press', set: 'Seti 2 nga 3' }))
    await waitForNotificationTitle(4200, 'Bench Press · Seti 2 nga 3')
    check('njoftimi i seancës: Bench Press · Seti 2 nga 3, me peshën e setit 1', notification(4200).text.startsWith('60 kg × 12'), notification(4200).text)
    // Muzika pa leje: ikona "Lidh muzikën tënde" te kreu (V2-E1-12; ikonë që nga 0.23).
    check('muzika pa leje: ikona "Lidh muzikën tënde" te seanca', await waitFor(() => hasButton(page, 'Lidh muzikën tënde'), 'Lidh muzikën tënde', 15_000).then(() => true, () => false))
    screenshot('seanca-v2')

    // D1. Prekja e dyfishtë te paneli i njoftimeve ruan një set (Bench Press seti 2), jo dy.
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await sleep(1000)
    await expandShade()
    screenshot('njoftimi-paneli')
    const doubleTap = await tapSave('prekja-e-dyfishte', 'Bench Press · Seti 3 nga 3', 2)
    await waitForNotificationTitle(4200, 'Bench Press · Seti 3 nga 3')
    await sleep(2500)
    collapseShade()
    page.close()
    page = await open()
    await openSession(page)
    check('njoftimi: seti i ruajtur del te seanca', await atStep(page, { exercise: 'Bench Press', set: 'Seti 3 nga 3' }))
    // Pritet pak, që një prekje e dytë e vonuar të kishte kohë të dilte si set i ri.
    await sleep(2000)
    const bench = await setsOf(page, sessionId, ids['Bench Press'])
    check('njoftimi: prekja e dyfishtë ruan një set', bench.map((set) => set.set_number).join(',') === '1,2', `setet ${bench.map((set) => set.set_number).join(',')}, prekja ${doubleTap.at}`)

    // D2. Ekrani i kyçur me PIN: "Ruaj setin" pa e shkyçur telefonin; pushimi nis nga njoftimi dhe
    // "Pushimi mbaroi" vjen me ekran të fikur.
    ensurePin()
    await sleepScreen()
    await wakeScreen()
    await sleep(1500)
    check('ekrani i kyçur me PIN', keyguardShowing() !== false)
    screenshot('ekrani-kycur')
    const lockTap = await tapSave('ekrani-kycur', 'Incline Bench Press · Seti 1 nga 2')
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
    const lockSet = await waitFor(async () => (await setsOf(page, sessionId, ids['Bench Press'])).find((set) => set.set_number === 3), 'seti 3 nga ekrani i kyçur', 20_000)
    check('ekrani i kyçur: seti 3 ruhet me kohën e prekjes', lockSet && Math.abs(Date.parse(lockSet.logged_at) - lockTap.at) <= 3000, `${lockSet?.logged_at} vs ${new Date(lockTap.at).toISOString()}`)
    await waitFor(() => posted('set_logs').some((row) => row.id === lockSet.id), 'sinkronizimi i setit nga ekrani i kyçur', 30_000)

    // D3. Seanca: "Ruaj setin" te app-i (Incline Bench Press seti 1, 40 kg) dhe pushimi me ekran të kyçur.
    check('pas Bench Press seanca kalon te Incline Bench Press', await atStep(page, { exercise: 'Incline Bench Press', set: 'Seti 1 nga 2' }))
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
    const killedTap = await tapSave('procesi-i-vrare', 'Incline Dumbbell Flye · Seti 1 nga 2')
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
    // Procesi sapo nisi: sinkronizimi i parë lexon edhe tabelat e tjera para setit; në CI zgjati një herë mbi 30 s.
    await waitFor(() => posted('set_logs').some((row) => row.set_number === 2 && row.exercise_id === ids['Incline Bench Press']), 'sinkronizimi i setit nga njoftimi', 60_000)
    const killedSet = posted('set_logs').find((row) => row.set_number === 2 && row.exercise_id === ids['Incline Bench Press'])
    check('procesi i vrarë: seti sinkronizohet me logged_at = koha e prekjes', Date.parse(killedSet.logged_at) === queued[0].at, `${killedSet.logged_at} = ${new Date(queued[0].at).toISOString()}`)
    screenshot('seanca-seti-nga-njoftimi')
  })

  // D5. Videot e formës (V2-E1-13): leja CAMERA te prekja e parë, kamera virtuale, regjistrimi pa internet.
  await section('kamera', 'Videot e formës', async () => {
    await openSession(page)
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
  })

  // D6. Muzika (V2-E1-12): leja "Qasja te njoftimet" dhe, me app-in e provës, mini-player-i dhe rreshti i
  // muzikës te njoftimi i seancës me kontrollet.
  await section('muzika', 'Muzika te seanca dhe te njoftimi', async () => {
    await openSession(page)
    adb('shell', 'cmd', 'notification', 'allow_listener', `${PKG}/${PKG}.MusicListenerService`)
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await sleep(1000)
    launch()
    await waitFor(async () => !(await hasButton(page, 'Lidh muzikën tënde')), 'ikona e lidhjes ikën pas lejes', 20_000)
    // Emulatori mund të ketë vetë një sesion medie pa titull (app-et e Google-it): atëherë ikona mban atë.
    const musicIdle = await waitFor(async () => (await musicLabel(page)) !== null, 'muzika me lejen', 15_000)
    check('muzika: me lejen, ikona e lidhjes ikën dhe del muzika', Boolean(musicIdle))
    info('muzika para app-it të provës', (await musicLabel(page)) === 'Hap Trupi në ritëm: asnjë app muzike nuk luan' ? 'Asnjë app muzike nuk luan' : 'ikona me një sesion tjetër të emulatorit')
    if (apkPlayer) {
      adb('install', apkPlayer)
      adb('shell', 'pm', 'grant', PLAYER, 'android.permission.POST_NOTIFICATIONS')
      adb('logcat', '-c')
      adb('shell', 'am', 'start', '-W', '-n', `${PLAYER}/.MainActivity`)
      launch()
      await waitFor(async () => ((await musicLabel(page)) ?? '').includes('Prova e ritmit'), 'ikona me "Prova e ritmit"', 20_000)
      await waitFor(async () => ((await musicLabel(page)) ?? '').endsWith('128 BPM'), 'ikona me 128 BPM', 20_000)
      check('muzika: ikona te kreu mban këngën dhe tempon', true, await musicLabel(page))
      screenshot('muzika-seanca')
      const playerLog = () => adb('logcat', '-d', '-s', 'VrullProva').split('\n').filter((line) => line.includes('komanda'))
      // Kontrollet te ekrani i plotë, që hap ikona.
      await clickButtonStarting(page, 'Hap Trupi në ritëm')
      await waitForText(page, 'Prova e ritmit', 20_000)
      await clickButton(page, 'Kënga tjetër')
      await waitFor(() => playerLog().some((line) => line.includes('komanda next -> Kënga e dytë')), 'kënga tjetër nga seanca', 15_000)
      await waitForText(page, 'Kënga e dytë', 15_000)
      check('muzika: "Kënga tjetër" te seanca ndërron këngën', true)
      await clickButton(page, 'Kthehu te seanca')
      // Pozicioni (rrëshqitësi i "Trupi në ritëm"): numri vjen si Integer nga JS-i (CallNumbers.java).
      const seek = await page.evaluate(`Capacitor.Plugins.Music.control({ action: 'seekTo', positionMs: 30000 }).then(() => 'ok', (e) => e.code)`)
      await waitFor(() => playerLog().some((line) => line.includes('komanda seekTo')), 'pozicioni te app-i i muzikës', 15_000)
      check('muzika: pozicioni i këngës ndryshon nga Vrull', seek === 'ok', seek)
      // Rreshti i muzikës te njoftimi: titulli dhe kontrollet (uiautomator; ekrani me kronometër mund të mos qetësohet).
      adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
      await sleep(1000)
      info('njoftimet e fshehura para rreshtit të muzikës', onlySessionNotification())
      await expandShade()
      // Butonat e rreshtit (notification_music.xml). uiautomator i jep kur ekrani qetësohet; përndryshe (kronometri
      // i njoftimit e mban në lëvizje) gjenden nga butoni prush i njoftimit të zgjeruar: rreshti 48 dp nis 8 dp nën
      // kontrollet, butonat 48 dp me 6 dp mes tyre, i fundit në skajin e djathtë.
      const nodes = uiNodes() ?? []
      const node = (name) => nodes.find((entry) => entry.id.endsWith(`:id/music_${name}`))
      let buttons
      if (node('play_pause') && node('next') && node('previous')) {
        check('njoftimi: rreshti i muzikës tregon këngën', node('title')?.text === 'Kënga e dytë', node('title')?.text)
        check('njoftimi: luaj/pauzë sipas gjendjes', node('play_pause').desc === 'Pauzë', node('play_pause').desc)
        buttons = Object.fromEntries(['play_pause', 'next', 'previous'].map((name) => [name, [String(node(name).x), String(node(name).y)]]))
      } else {
        info('njoftimi i muzikës', 'uiautomator nuk e kapi panelin (kronometri); butonat gjenden nga butoni prush')
        const dp = Number(adb('shell', 'wm', 'density').match(/(\d+)\s*$/)[1]) / 160
        const ember = emberButton()
        const right = ember.x + ember.w / 2
        const y = Math.round(ember.y + ember.h / 2 + 32 * dp)
        const at = (index) => [String(Math.round(right - 24 * dp - index * 54 * dp)), String(y)]
        buttons = { next: at(0), play_pause: at(1), previous: at(2) }
      }
      screenshot('njoftimi-muzika')
      adb('shell', 'input', 'tap', ...buttons.play_pause)
      await waitFor(() => playerLog().some((line) => line.includes('komanda pause')), 'pauza nga njoftimi', 15_000)
      await sleep(1500)
      adb('shell', 'input', 'tap', ...buttons.play_pause)
      await waitFor(() => playerLog().some((line) => line.includes('komanda play')), 'luaj nga njoftimi', 15_000)
      await sleep(1500)
      adb('shell', 'input', 'tap', ...buttons.next)
      await waitFor(() => playerLog().some((line) => line.includes('komanda next -> Kënga e tretë')), 'kënga tjetër nga njoftimi', 15_000)
      await sleep(1500)
      screenshot('njoftimi-muzika-pas')
      adb('shell', 'input', 'tap', ...buttons.previous)
      await waitFor(() => playerLog().some((line) => line.includes('komanda previous -> Kënga e dytë')), 'kënga e mëparshme nga njoftimi', 15_000)
      check('njoftimi: rreshti i muzikës me pauzë, luaj, para dhe mbrapa', true)
      collapseShade()
      launch()
      // MusicBrainz përmes CapacitorHttp (V2-E1-16a): për "Kënga e dytë" GetSongBPM i imituar s'ka tempo, ndaj
      // app-i pyet MusicBrainz. Kërkesa del nga telefoni (jo nga WebView), ndaj shihet vetëm te `_meta`.
      const tempoRecord = await waitFor(async () => {
        const { _meta: meta } = await readDb(page, ['_meta'])
        return meta.find((entry) => entry.key === 'tempo:vrull|kenga e dyte') ?? null
      }, 'tempo e "Kënga e dytë"', 30_000).catch(() => null)
      info('MusicBrainz përmes CapacitorHttp', tempoRecord ? tempoRecord.value : 'pa përgjigje (MusicBrainz ose rrjeti i runner-it)')
      adb('shell', 'am', 'force-stop', PLAYER)
    }
  })

  // D7. Anglishtja: njoftimi ndjek gjuhën e app-it.
  await section('anglishtja', 'Njoftimi ndjek gjuhën', async () => {
    await chooseLanguage(page, 'en')
    await waitForNotificationTitle(4200, 'Incline Dumbbell Flye · Set 1 of 2')
    check('anglisht: njoftimi i seancës në anglisht', true, notification(4200).title)
    screenshot('pamja-anglisht')
    await chooseLanguage(page, 'sq')
    await waitForNotificationTitle(4200, 'Incline Dumbbell Flye · Seti 1 nga 2')
  }, { after: 'njoftimi' })

  // D8. Butoni mbrapa mbyll fletën e ushtrimeve dhe mbetet te seanca; "Mbyll stërvitjen" heq njoftimin.
  await section('mbyllja', 'Butoni mbrapa te seanca dhe mbyllja', async () => {
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
  })

  // D9. Rikujtuesit e zgjuar (V2-E2-08): njoftimi me butona nga plugin-i native, procesi i vrarë, ekrani
  // i kyçur. Rikujtuesit e provës vendosen drejt te plugin-i (Reminders.schedule), 8 sekonda pas tani;
  // procesi vritet që planifikimi i app-it të mos i zëvendësojë para se të bien.
  await section('rikujtuesit', 'Rikujtuesit e zgjuar: butonat me ekran të kyçur', async () => {
    const today = await page.evaluate(`(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') })()`)
    const reminder = (id, kind, meal, actions, done) => ({
      id,
      at: Date.now() + 8000,
      title: kind === 'water' ? 'Uji: 0,5 nga 3,0 L' : 'Dreka',
      body: 'Prova e rikujtuesve',
      kind,
      key: `${kind}|${today}|${meal ?? ''}`,
      data: { date: today, meal, supplementIds: [], ml: kind === 'water' ? 250 : undefined },
      actions,
      done,
      undo: 'Kthe mbrapsht',
    })
    ensurePin()
    const scheduleAndKill = async (template, snoozeMinutes) => {
      // Planifikimi i app-it (1,5 s pas çdo shkrimi, hapjeje ose sinkronizimi) mund ta zëvendësojë listën
      // e provës para se procesi të vritet: pas vrasjes lista kontrollohet, dhe provohet sërish.
      let item = template
      for (let attempt = 1; ; attempt++) {
        // Pritet që plani i app-it të qetësohet (hapja, sinkronizimi, prekjet e zbatuara): lista e
        // rikujtuesve nuk ndryshon për 4 s.
        let last = ''
        let still = 0
        for (let waited = 0; waited < 30 && still < 4; waited++) {
          await sleep(1000)
          const now = JSON.stringify(reminderPrefs().list)
          still = now === last ? still + 1 : 0
          last = now
        }
        item = { ...template, at: Date.now() + 8000 }
        await page.evaluate(
          `window.Capacitor.nativePromise('Reminders', 'schedule', ${JSON.stringify({ reminders: [item], channel: { name: 'Rikujtuesit', description: 'Prova' }, cancelKeys: [], snoozeMinutes })})`,
        )
        page.close()
        // Vrasja menjëherë (si sistemi kur i duhet kujtesa), para se app-i të planifikojë sërish; alarmet mbeten.
        adb('shell', 'run-as', PKG, 'kill', '-9', pidOf())
        await waitFor(() => pidOf() === '', 'procesi i vrarë', 10_000)
        adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        if (reminderPrefs().list.some((entry) => entry.id === item.id && entry.key === item.key)) break
        if (attempt === 3) throw new Error(`Planifikimi i app-it zëvendësoi rikujtuesin e provës ${item.id} tri herë`)
        info('planifikimi i app-it zëvendësoi rikujtuesin e provës', `${item.id}, përpjekja ${attempt + 1}`)
        page = await open()
      }
      await sleepScreen()
      await waitFor(() => notification(item.id), `rikujtuesi ${item.id}`, 30_000)
      await wakeScreen()
      await sleep(1500)
      await expandShade()
    }

    // 1. "Hëngra si në plan" me ekran të kyçur: njoftimi bëhet "u regjistrua", prekja mbetet në radhë
    // derisa hapet app-i, pastaj dreka është te ditari dhe njoftimi hiqet.
    await scheduleAndKill(
      reminder(5190, 'meal', 'lunch', [{ id: 'ate', title: 'Hëngra si në plan' }, { id: 'snooze', title: 'Shty 30 min' }], {
        ate: { title: 'Dreka u regjistrua', body: 'Si në plan' },
      }),
    )
    check('rikujtuesi i drekës vjen me procesin e vrarë', notification(5190)?.title === 'Dreka', notification(5190)?.title)
    screenshot('rikujtuesi-dreka')
    await tapNotificationButton('Hëngra si në plan', 'Dreka')
    await waitForNotificationTitle(5190, 'Dreka u regjistrua')
    const ate = reminderPrefs().queue.filter((entry) => entry.action === 'ate')
    check('"Hëngra si në plan" pa shkyçur: njoftimi "Dreka u regjistrua" dhe prekja në radhë', ate.length === 1 && keyguardShowing() !== false, JSON.stringify(ate))
    screenshot('rikujtuesi-regjistruar')
    collapseShade()
    await unlock()
    page = await open()
    await waitFor(() => reminderPrefs().queue.length === 0, 'radha e rikujtuesve e zbrazur', 45_000)
    const lunch = await waitFor(async () => {
      const { diary_entries: rows } = await readDb(page, ['diary_entries'])
      const found = rows.filter((row) => row.date === today && row.meal === 'lunch' && !row.deleted_at)
      return found.length > 0 ? found : null
    }, 'dreka te ditari', 20_000)
    check('hapja e app-it e regjistron drekën nga Plani im', lunch.length > 0, `${lunch.length} artikuj`)
    // Plani i ri (1,5 s pas regjistrimit) heq njoftimet e vakteve të regjistruara, por jo "u regjistrua":
    // ai me "Kthe mbrapsht" ikën vetë pas 10 minutash (SPEC §13).
    await sleep(6000)
    check('"Dreka u regjistrua" mbetet në panel pas planit të ri', notification(5190)?.title === 'Dreka u regjistrua', notification(5190)?.title ?? 'asnjë')

    // 2. "Shty 30 min": njoftimi ikën dhe vjen sërish me alarmin e shtyrjes.
    await scheduleAndKill(reminder(5191, 'supplements', 'dinner', [{ id: 'took', title: 'E mora' }, { id: 'snooze', title: 'Shty 30 min' }], { took: { title: 'Suplementet u shënuan', body: '' } }))
    await tapNotificationButton('Shty 30 min', 'Dreka')
    await waitFor(() => !notification(5191), 'njoftimi i shtyrë ikën', 10_000)
    const snoozed = Object.values(reminderPrefs().snoozed)
    check('"Shty 30 min": shtyrja ruhet për pas 30 minutash', snoozed.length === 1 && Math.abs(snoozed[0].at - (Date.now() + 30 * 60_000)) < 120_000, JSON.stringify(snoozed.map((item) => [item.id, item.at])))
    collapseShade()

    // 3. "Piva një gotë", pastaj "Kthe mbrapsht" para hapjes së app-it: prekja hiqet nga radha.
    await unlock()
    page = await open()
    await scheduleAndKill(reminder(5192, 'water', null, [{ id: 'drank', title: 'Piva një gotë' }], { drank: { title: 'U shtua një gotë', body: '0,75 nga 3,0 L' } }))
    await tapNotificationButton('Piva një gotë', 'Uji: 0,5 nga 3,0 L')
    await waitForNotificationTitle(5192, 'U shtua një gotë')
    await tapNotificationButton('Kthe mbrapsht', 'U shtua një gotë')
    await waitFor(() => !notification(5192), 'njoftimi i ujit ikën pas "Kthe mbrapsht"', 10_000)
    check('"Kthe mbrapsht" heq gotën nga radha para se ta zbatojë app-i', reminderPrefs().queue.every((entry) => entry.action !== 'drank'), JSON.stringify(reminderPrefs().queue))
    collapseShade()
    await unlock()
    page = await open()
    const { water_logs: water } = await readDb(page, ['water_logs'])
    check('pa gotë te uji pas "Kthe mbrapsht"', water.filter((row) => row.date === today && !row.deleted_at).length === 0)

    // 4. Shtyrja që vjen sërish: butonat e saj punojnë (shtyrja hiqet nga lista e saj kur bie).
    await scheduleAndKill(reminder(5193, 'meal', 'dinner', [{ id: 'ate', title: 'Hëngra si në plan' }, { id: 'snooze', title: 'Shty 30 min' }], { ate: { title: 'Darka u regjistrua', body: '' } }), 0.15)
    await tapNotificationButton('Shty 30 min', 'Dreka')
    const snoozeId = Number(
      await waitFor(() => Object.entries(reminderPrefs().snoozed).find(([, item]) => item.key === `meal|${today}|dinner`)?.[0], 'shtyrja e darkës te lista e shtyrjeve', 10_000),
    )
    await waitFor(() => notification(snoozeId), `shtyrja ${snoozeId} vjen sërish`, 40_000)
    await tapNotificationButton('Hëngra si në plan', 'Dreka')
    await waitForNotificationTitle(snoozeId, 'Darka u regjistrua')
    const fromSnooze = reminderPrefs().queue.filter((entry) => entry.action === 'ate')
    check('butoni i një shtyrjeje që erdhi sërish: prekja në radhë', fromSnooze.length === 1 && fromSnooze[0].key === `meal|${today}|dinner`, JSON.stringify(fromSnooze))
    collapseShade()
    await unlock()
    page = await open()
    await waitFor(() => reminderPrefs().queue.length === 0, 'radha e zbrazur pas shtyrjes', 45_000)

    // 5. Plani i ri ia jep id-në e një njoftimi të dukshëm një rikujtuesi tjetër: butoni vepron mbi atë
    // që shihet (uji), jo mbi rikujtuesin e ri me të njëjtën id (darka, më vonë).
    await scheduleAndKill(reminder(5194, 'water', null, [{ id: 'drank', title: 'Piva një gotë' }], { drank: { title: 'U shtua një gotë', body: '' } }))
    const later = { ...reminder(5194, 'meal', 'dinner', [{ id: 'ate', title: 'Hëngra si në plan' }], {}), at: Date.now() + 3_600_000, title: 'Darka' }
    await unlock()
    page = await open()
    await page.evaluate(
      `window.Capacitor.nativePromise('Reminders', 'schedule', ${JSON.stringify({ reminders: [later], channel: { name: 'Rikujtuesit', description: 'Prova' }, cancelKeys: [] })})`,
    )
    page.close()
    adb('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    await expandShade()
    await tapNotificationButton('Piva një gotë', 'Uji: 0,5 nga 3,0 L')
    await waitForNotificationTitle(5194, 'U shtua një gotë')
    // App-i jeton: dëgjuesi e zbaton prekjen menjëherë, ndaj kontrollohet uji te baza, jo radha.
    collapseShade()
    page = await open()
    await waitFor(() => reminderPrefs().queue.length === 0, 'radha e zbrazur pas id-së së ripërdorur', 45_000)
    const afterShift = await readDb(page, ['water_logs'])
    const glasses = afterShift.water_logs.filter((row) => row.date === today && !row.deleted_at)
    check('id e ripërdorur: butoni vepron mbi njoftimin që shihet (një gotë uji, jo darka)', glasses.length === 1 && Number(glasses[0].ml) === 250, JSON.stringify(glasses.map((row) => row.ml)))
  })

  // ==== E. Trupi 3D, butoni mbrapa dhe tema ====
  await section('navigimi', 'Trupi 3D, butoni mbrapa dhe tema', async () => {
    await click(page, 'a[href="/progresi"]')
    await waitFor(() => page.evaluate(`!!document.querySelector('a[href="/progresi/trupi"]')`), 'Trupi te Progresi')
    await click(page, 'a[href="/progresi/trupi"]')
    await waitForHeading(page, 'Trupi')
    // Trupi 3D (V2-E1-14): modeli vizatohet me WebGL nga GLB-ja në APK; emulatori e vizaton me CPU.
    const webgl = await page.evaluate(`(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) })()`)
    if (!webgl) {
      info('Trupi 3D', 'WebView-i i emulatorit nuk ka WebGL; modeli kontrollohet në telefon')
    } else {
      await waitFor(() => page.evaluate(`!!document.querySelector('section canvas') && !document.body.innerText.includes('Po ngarkohet modeli')`), 'modeli 3D', 60_000)
      check('Trupi: modeli 3D vizatohet nga APK-ja', !(await hasText(page, 'Modeli 3D nuk u ngarkua')))
    }
    screenshot('trupi-3d')
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
    await waitFor(() => hasButton(page, 'Dil'), 'butoni "Dil"')
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
    // Që nga 0.21 (V2-E2-08) rikujtuesit i mban plugin-i native Reminders, me alarmet e veta.
    const planned = await waitFor(() => (reminderPrefs().list.length > 0 ? reminderPrefs().list.length : null), 'rikujtuesit te plugin-i Reminders', 20_000).catch(() => 0)
    check('rikujtuesit planifikohen pas lejes së njoftimeve', planned > 0, `${planned} rikujtues`)
    page.close()
    // Mbrapa në fillim të historisë (app-i i sapohapur te Sot) e çon app-in në sfond pa e mbyllur.
    adb('shell', 'am', 'force-stop', PKG)
    page = await open()
    await waitForPath(page, '/')
    await waitForText(page, 'Java 0')
    await pressBack()
    await waitFor(() => !isForeground(), 'app-i në sfond me butonin mbrapa', 15_000)
    check('mbrapa në fillim të historisë e çon app-in në sfond, gjallë', pidOf() !== '')
  })
  try {
    adb('shell', 'locksettings', 'clear', '--old', PIN)
  } catch {
    // Pa PIN.
  }

  // ==== F. Instalim i ri (një mik): hyrja në gjuhën e telefonit, hapat e parë me gjuhën ====
  // D10. Kutia e AI-së dhe vakti i shpejtë (V2-E2-13, V2-E2-16): tastiera te kutia, drafti dhe regjistrimi,
  // makrot e shpejta pa AI, foto e pjatës e zvogëluar me canvas në WebView. log-parse është i imituar.
  await section('kutia', 'Kutia e AI-së, makrot dhe foto e pjatës', async () => {
    // Nga një app i hapur rishtas: navigimi mbaron me app-in në sfond pas butonit mbrapa, dhe një location.assign
    // aty mund të marrë "backbutton"-in e vonuar të Capacitor-it te faqja që po ngarkohet (window.Capacitor mungon).
    page?.close()
    adb('shell', 'am', 'force-stop', PKG)
    page = await open()
    await waitForPath(page, '/')
    await click(page, 'a[href="/kutia"]')
    await waitForHeading(page, 'Kutia e AI-së')
    await page.evaluate(`(() => {
      const field = document.querySelector('textarea')
      field.focus()
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, 'Në drekë 200 g pulë dhe dy gota ujë')
      field.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await clickButton(page, 'Dërgo')
    await waitForText(page, 'Pulë e pjekur')
    screenshot('kutia-permbledhja')
    await clickButton(page, 'Regjistro të gjitha')
    await waitForPath(page, '/')
    const afterBox = await readDb(page, ['diary_entries', 'water_logs'])
    check('kutia: ushqimi dhe uji regjistrohen nga drafti', afterBox.diary_entries.some((row) => row.grams === 200 && !row.deleted_at) && afterBox.water_logs.some((row) => Number(row.ml) === 500 && !row.deleted_at), `${afterBox.diary_entries.length} ushqime, ${afterBox.water_logs.length} ujë`)

    await page.evaluate(`location.assign('/ushqimi?vakti=dinner')`)
    await clickButton(page, 'Makrot')
    await waitForText(page, 'Makrot e shpejta')
    for (const [label, value] of [['Emri', 'Darkë jashtë'], ['Kalori', '650'], ['Proteina', '40'], ['Karbohidrate', '60'], ['Yndyrë', '25']]) {
      await page.evaluate(`(() => {
        const label = [...document.querySelectorAll('[role="dialog"] label')].find((item) => item.textContent.trim().startsWith(${JSON.stringify(label)}))
        const input = label.control ?? document.getElementById(label.htmlFor)
        input.focus()
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
    }
    await waitForText(page, 'Ruhet 650.')
    screenshot('makrot')
    await clickButton(page, 'Ruaj te Darka')
    await waitFor(async () => (await readDb(page, ['diary_entries'])).diary_entries.some((row) => Number(row.kcal) === 650 && row.meal === 'dinner' && !row.deleted_at), 'makrot te Darka')
    check('makrot e shpejta: 650 kcal te Darka, pa AI', true)

    // "Foto" do të hapte zgjedhësin e kamerës; skedari i jepet drejt input-it, si pas fotos.
    await page.evaluate(`location.assign('/ushqimi?vakti=dinner')`)
    await waitFor(() => page.evaluate(`!!document.querySelector('[role="dialog"] input[type="file"]')`), 'fleta e Darkës me Foto')
    await choosePhoto(page, '[role="dialog"] input[type="file"]')
    await waitForPath(page, '/kutia')
    await waitForText(page, 'Makarona me karkaleca')
    const photo = report.photoRequest
    if (photo && photo.mediaType === null) info('foto e pjatës', 'CDP nuk e dha trupin e kërkesës (i madh); fotoja u dërgua')
    else check('foto e pjatës: JPEG i zvogëluar dërgohet me vaktin', photo?.mediaType === 'image/jpeg' && photo.bytes > 1000 && photo.bytes < 7_000_000, JSON.stringify(photo))
    const placed = (await readDb(page, ['diary_entries'])).diary_entries.filter((row) => Number(row.grams) === 350 && !row.deleted_at)
    check('foto e pjatës: ushqimi te Darka e fletës, jo te dreka që tha AI-ja', placed.length === 0, `${placed.length} rreshta para regjistrimit`)
    await clickButton(page, 'Regjistro të gjitha')
    await waitFor(async () => (await readDb(page, ['diary_entries'])).diary_entries.some((row) => Number(row.grams) === 350 && row.meal === 'dinner' && !row.deleted_at), 'foto te Darka')
    check('foto e pjatës: regjistrohet te Darka', true)
    screenshot('foto-pjata')
    await goHome(page)
  })

  await section('instalimi', 'Instalim i ri, hapat e parë dhe përditësimi v2 → v3', async () => {
    page?.close()
    adb('uninstall', PKG)
    adb('install', apkV2)
    // Instalimi i ri nuk ka lejen e njoftimeve (Android 13+); app-i e kërkon në stërvitjen e parë, këtu jepet si nga përdoruesi.
    adb('shell', 'pm', 'grant', PKG, 'android.permission.POST_NOTIFICATIONS')
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
    // Objektivat (V2-E2-03): hapi 4 kapërcehet me "Më vonë"; mbeten objektivat e Jimit.
    await waitForHeading(page, 'Objektivat e tua')
    await clickButton(page, 'Më vonë')
    await waitForHeading(page, 'Zgjidh programin')
    await clickButton(page, 'Fillo programin')
    await waitForPath(page, '/')
    await waitForText(page, 'Java 0')
    // 0.23: karta e Sot thotë "Sot · 21:00 · Stërvitja 1" (Stërvitja N në fund të rreshtit).
    check('hapat e parë mbarojnë te Sot me Java 0, shqip', await waitFor(() => hasText(page, 'Stërvitja 1'), 'Stërvitja 1', 15_000).then(() => true, () => false))
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
      // Capacitor e shkruan refuzimin e qëllimshëm si console.error në build-in debug (ignoredError, HASH_MISMATCH).
      const refused = await page.evaluate(`Capacitor.Plugins.AppUpdater.download({ url: '${PROBE}', sha256: '${'1'.repeat(64)}' }).then(() => 'pranoi', (e) => e.code)`)
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
  })

  report.errors.push(...(await Promise.all(errorDetails)))
  const errors = report.errors.filter((text) => !ignoredError(text))
  report.sections = sections
  console.log('---- Pjesët')
  for (const entry of sections) console.log(`${entry.result.padEnd(7)} ${entry.id}${entry.detail ? ` (${entry.detail})` : ''}`)
  check('asnjë gabim JavaScript', errors.length === 0, errors.join(' | '))
  const failed = sections.filter((entry) => entry.result === 'failed')
  if (failed.length > 0) throw new Error(`Pjesët që dështuan: ${failed.map((entry) => entry.id).join(', ')}`)
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
