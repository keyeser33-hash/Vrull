// Prova e APK-së në një Android virtual (emulator), përmes adb dhe Chrome DevTools Protocol.
// Përdorimi: node scripts/android-smoke.mjs <dosja-e-rezultateve> <v1.apk> <v2.apk>
// v1 dhe v2 janë build-e debug me të njëjtin çelës, v2 me version më të lartë.
// Kontrollon: instalimi, hapja pa gabime dhe pa shirit veprimesh, rifreskimi në një rrugë të brendshme, butoni mbrapa,
// ndërrimi i temës, dhe që përditësimi v1 -> v2 i mban të dhënat.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PKG = 'al.traininghub.app'
const [outDir = 'smoke-out', apkV1, apkV2] = process.argv.slice(2)
if (!apkV1 || !apkV2) {
  console.error('Përdorimi: node scripts/android-smoke.mjs <dosja> <v1.apk> <v2.apk>')
  process.exit(2)
}
mkdirSync(outDir, { recursive: true })

const report = { checks: [], errors: [] }
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

// Lidhet me WebView-në e app-it (vetëm build-et debug e lejojnë) dhe kthen një evaluate().
async function connect() {
  const socket = await waitFor(() => {
    const pid = adb('shell', 'pidof', PKG)
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
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, timer } = pending.get(message.id)
      clearTimeout(timer)
      pending.delete(message.id)
      resolve(message)
      return
    }
    if (message.method === 'Runtime.exceptionThrown') {
      report.errors.push(message.params.exceptionDetails.exception?.description ?? 'exception')
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      report.errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      report.errors.push(message.params.entry.text)
    }
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
  await send('Runtime.enable')
  await send('Log.enable')
  return { send, evaluate, close: () => ws.close() }
}

const heading = (page) => page.evaluate(`document.querySelector('h1')?.textContent ?? ''`)
const waitForHeading = (page, text) =>
  waitFor(async () => (await heading(page)) === text, `titulli "${text}"`)

try {
  // Nis nga një pajisje pa app-in; çinstalimi dështon kur s'ka çfarë të heqë.
  try {
    adb('uninstall', PKG)
  } catch {
    // App-i nuk ishte i instaluar.
  }

  // 1. Instalimi dhe hapja e v1.
  adb('install', apkV1)
  const codeV1 = versionCode()
  check('v1 instalohet', codeV1 !== null, `versionCode ${codeV1}`)
  launch()
  let page = await connect()
  // Rifreskim pasi dëgjuesit e gabimeve janë gati, që të kapet çdo gabim i ngarkimit.
  await page.send('Page.reload')
  await waitForHeading(page, 'Sot')
  check('hapet te "Sot"', true)
  check('tema OLED si parazgjedhje', (await page.evaluate('document.documentElement.className')) === 'dark oled')
  report.userAgent = await page.evaluate('navigator.userAgent')
  report.insets = await page.evaluate(`(() => {
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)'
    document.body.append(probe)
    const style = getComputedStyle(probe)
    const value = { top: style.paddingTop, bottom: style.paddingBottom, width: innerWidth, height: innerHeight }
    probe.remove()
    return value
  })()`)
  const navInside = await page.evaluate(`(() => {
    const nav = document.querySelector('nav[aria-label="Kryesore"]').getBoundingClientRect()
    return nav.bottom <= innerHeight + 0.5 && nav.height >= 56
  })()`)
  check('navigimi poshtë brenda ekranit', navInside, JSON.stringify(report.insets))
  check('pa scroll anësor', await page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
  check('pa shirit veprimesh mbi faqe', !hasActionBar())
  const bandOled = statusBandColor()
  check('rripi i orës në OLED është i zi', sameColor(bandOled, '#000000'), bandOled.join(','))
  check('titulli "Sot" brenda ekranit', await page.evaluate(`document.querySelector('h1').getBoundingClientRect().top >= 0`))
  screenshot('1-sot-oled')

  // 2. Rifreskimi në një rrugë të brendshme (serveri lokal i Capacitor-it kthen index.html).
  await page.evaluate(`document.querySelector('a[aria-label="Cilësimet"]').click()`)
  await waitForHeading(page, 'Cilësimet')
  await page.send('Page.reload')
  await waitForHeading(page, 'Cilësimet')
  check('rifreskimi te /cilesimet mban faqen', true)

  // 3. Butoni mbrapa: kthehet te "Sot", pastaj mbyll app-in.
  await page.evaluate(`document.querySelector('a[href="/programi"]').click()`)
  await waitForHeading(page, 'Programi')
  await pressBack()
  await waitForHeading(page, 'Cilësimet')
  check('mbrapa kthen te faqja e mëparshme', true)
  page.close()

  // 4. Tema e çelët zgjidhet nga cilësimet dhe ruhet.
  adb('shell', 'am', 'force-stop', PKG)
  launch()
  page = await connect()
  await waitForHeading(page, 'Sot')
  await page.evaluate(`document.querySelector('a[aria-label="Cilësimet"]').click()`)
  await waitForHeading(page, 'Cilësimet')
  await page.evaluate(`document.querySelector('input[type="radio"][value="light"]').click()`)
  await waitFor(async () => (await page.evaluate(`localStorage.getItem('th-theme')`)) === 'light', 'ruajtja e temës')
  check('tema e çelët ruhet', (await page.evaluate('document.documentElement.className')) === '')
  await sleep(500)
  screenshot('2-cilesimet-light-v1')
  const bandLight = statusBandColor()
  check('rripi i orës merr sfondin e temës së çelët', sameColor(bandLight, '#FAFAFA'), bandLight.join(','))
  await pressBack()
  await waitForHeading(page, 'Sot')
  await pressBack()
  await waitFor(() => !isForeground(), 'app-i në sfond me butonin mbrapa', 15_000)
  check('mbrapa në fillim të historisë e çon app-in në sfond', true)
  check('app-i mbetet gjallë në sfond', pidOf() !== '')
  page.close()

  // 5. Përditësimi v1 -> v2 mbi app-in ekzistues, pa humbur të dhënat.
  adb('install', '-r', apkV2)
  const codeV2 = versionCode()
  check('v2 instalohet mbi v1', codeV2 !== null && codeV2 > codeV1, `${codeV1} -> ${codeV2}`)
  launch()
  page = await connect()
  await page.send('Page.reload')
  await waitForHeading(page, 'Sot')
  check('tema e çelët mbetet pas përditësimit', (await page.evaluate(`localStorage.getItem('th-theme')`)) === 'light')
  check('tema aplikohet para vizatimit', (await page.evaluate('document.documentElement.className')) === '')
  await sleep(500)
  screenshot('3-sot-light-v2')
  const bandAfterUpdate = statusBandColor()
  check('rripi i orës mbetet i çelët pas përditësimit', sameColor(bandAfterUpdate, '#FAFAFA'), bandAfterUpdate.join(','))
  page.close()

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
} finally {
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
  process.exit(report.ok ? 0 : 1)
}
