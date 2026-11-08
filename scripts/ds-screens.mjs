// Prova e pamjes së sistemit Vrull në 390 px: hap faqen e brendshme /dev/ds në Chrome headless (CDP),
// në shqip dhe në anglisht, dhe kontrollon për secilën temë (OLED, Natë, Ditë):
// - faqja nuk lëviz anash në 390 px;
// - Barlow dhe Barlow Condensed ngarkohen nga app-i, pa asnjë kërkesë jashtë tij;
// - çdo gjë që preket ka të paktën 44 × 44 px.
// Ruan pamjen e çdo teme: <dosja>/ds-<gjuha>-<tema>.png dhe raportin <dosja>/report.json.
// Përdorimi: node scripts/ds-screens.mjs [dosja]   (CHROME=/rruga/e/chrome, parazgjedhje google-chrome)
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const WIDTH = 390
const HEIGHT = 844
const outDir = process.argv[2] ?? 'ds-screens'
mkdirSync(outDir, { recursive: true })

const report = { checks: [], screenshots: [] }
const failures = []
function check(name, ok, detail = '') {
  report.checks.push({ name, ok, detail })
  console.log(`${ok ? 'OK ' : 'GABIM'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) failures.push(name)
}

const server = await createServer({
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { host: '127.0.0.1', port: 0, strictPort: false },
  logLevel: 'error',
})
await server.listen()
const base = server.resolvedUrls.local[0].replace(/\/$/, '')
const origin = new URL(base).origin

const profile = mkdtempSync(join(tmpdir(), 'vrull-ds-'))
const chromeArgs = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars']
// Si root (kontejnerët e CI-së) Chrome nuk niset me sandbox.
if (process.getuid?.() === 0) chromeArgs.push('--no-sandbox')
const chrome = spawn(process.env.CHROME ?? 'google-chrome', [...chromeArgs, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })

try {
  const wsUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('Chrome nuk u nis për 20 s')), 20_000)
    chrome.stderr.on('data', (chunk) => {
      output += chunk
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(output)
      if (match) {
        clearTimeout(timer)
        resolve(match[1])
      }
    })
    chrome.on('error', reject)
    chrome.on('exit', (code) => reject(new Error(`Chrome doli me kod ${code}: ${output.slice(-400)}`)))
  })

  const ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })
  let nextId = 0
  const pending = new Map()
  const requests = []
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id)
      clearTimeout(timer)
      pending.delete(message.id)
      if (message.error) reject(new Error(message.error.message))
      else resolve(message.result)
      return
    }
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url)
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`${method} pa përgjigje`))
      }, 30_000)
      pending.set(id, { resolve, reject, timer })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => send(method, params, sessionId)
  await page('Page.enable')
  await page('Network.enable')
  await page('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 2, mobile: true })

  const evaluate = async (expression) => {
    const result = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  const waitFor = async (expression, label, timeout = 30_000) => {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      if (await evaluate(expression).catch(() => false)) return
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(`Nuk u arrit: ${label}`)
  }

  for (const lang of ['sq', 'en']) {
    // Gjuha lexohet nga ruajtja e telefonit para vizatimit të parë (i18n/language.ts).
    await page('Page.navigate', { url: `${base}/dev/ds` })
    await waitFor(`document.readyState === 'complete'`, 'faqja e parë')
    await evaluate(`localStorage.setItem('th-language', ${JSON.stringify(lang)})`)
    requests.length = 0
    await page('Page.navigate', { url: `${base}/dev/ds` })
    await waitFor(`document.querySelectorAll('section[data-theme]').length === 3`, `/dev/ds (${lang})`)
    await evaluate(`document.fonts.ready.then(() => true)`)
    await new Promise((resolve) => setTimeout(resolve, 600))

    const layout = await evaluate(`(() => {
      const width = innerWidth
      const wide = [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > width + 0.5)
        .map((element) => element.tagName.toLowerCase() + '.' + String(element.className).split(' ').slice(0, 3).join('.'))
      return { scrollWidth: document.documentElement.scrollWidth, width, wide: wide.slice(0, 10) }
    })()`)
    check(`${lang}: pa scroll anësor në ${WIDTH} px`, layout.scrollWidth <= WIDTH && layout.wide.length === 0, `scrollWidth ${layout.scrollWidth}${layout.wide.length ? `; ${layout.wide.join(', ')}` : ''}`)

    const fonts = await evaluate(`[...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family.replace(/"/g, '') + ' ' + face.weight)`)
    const needed = ['Barlow 400', 'Barlow 500', 'Barlow 600', 'Barlow 700', 'Barlow Condensed 600', 'Barlow Condensed 700', 'Barlow Condensed 800']
    const missing = needed.filter((face) => !fonts.includes(face))
    check(`${lang}: Barlow dhe Barlow Condensed të ngarkuara`, missing.length === 0, missing.length ? `mungojnë ${missing.join(', ')}` : [...new Set(fonts)].join(', '))
    const outside = requests.filter((url) => !url.startsWith(origin) && !url.startsWith('data:'))
    check(`${lang}: asnjë kërkesë jashtë app-it`, outside.length === 0, outside.join(', '))

    const small = await evaluate(`(() => {
      const found = []
      for (const element of document.querySelectorAll('main button, main a, main input')) {
        // Emri i ListRow-it e shtrin prekjen te i gjithë rreshti (::after mbi <li>).
        const target = element.className.includes('after:inset-0') ? element.closest('li') : element
        const rect = target.getBoundingClientRect()
        if (rect.height < 44 || rect.width < 44) found.push((element.getAttribute('aria-label') || element.textContent.trim()).slice(0, 40) + ' ' + Math.round(rect.width) + '×' + Math.round(rect.height))
      }
      return found
    })()`)
    check(`${lang}: çdo gjë që preket ka 44 px`, small.length === 0, small.slice(0, 8).join('; '))

    const sections = await evaluate(`[...document.querySelectorAll('section[data-theme]')].map((section) => {
      const rect = section.getBoundingClientRect()
      return { theme: section.dataset.theme, y: rect.top + scrollY, height: rect.height }
    })`)
    for (const { theme, y, height } of sections) {
      const shot = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: WIDTH, height, scale: 1 } })
      const file = join(outDir, `ds-${lang}-${theme}.png`)
      writeFileSync(file, Buffer.from(shot.data, 'base64'))
      report.screenshots.push(file)
    }
  }
  ws.close()
} finally {
  chrome.kill('SIGKILL')
  await server.close()
  rmSync(profile, { recursive: true, force: true })
}

writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2))
console.log(`Pamjet: ${report.screenshots.join(', ')}`)
if (failures.length) {
  console.error(`Dështuan: ${failures.join('; ')}`)
  process.exit(1)
}
