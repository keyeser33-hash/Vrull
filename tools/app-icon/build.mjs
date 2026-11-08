// Ikona e app-it me shenjën e Vrullit, nga një burim i vetëm (V2-E1-18): gjeometria e shenjës vjen nga
// `src/components/ui/logo.tsx` (katrori, rrezja, vija e shpejtësisë dhe trashësia e saj) dhe ngjyrat
// `--ember` / `--on-ember` nga `src/styles/globals.css`. Shenja: katror prushi me vijën në `on-ember`
// (sistemi i dizajnit, assets/Logos), pa kufi dhe kurrë në ngjyra të tjera.
//
// Krijon:
// - `public/favicon.svg`;
// - ikonën adaptive të Android-it: sfondi është prushi (`values/ic_launcher_colors.xml`), përpara
//   vetëm vija (`drawable/ic_launcher_foreground.xml`), dhe vija e bardhë për ikonat me temë të
//   Android 13+ (`drawable/ic_launcher_monochrome.xml`). Shenja 64 njësi zë 72 dp, pjesën e dukshme
//   të kanavacës 108 dp; vija mbetet brenda zonës së sigurt 66 dp në çdo formë të launcher-it;
// - shenjën e plotë për ekranin e nisjes (`drawable/ic_splash.xml`, 288 dp, brenda rrethit 192 dp
//   të Android 12+ dhe të `core-splashscreen`);
// - ikonat PNG për Android 7.0–7.1 (`mipmap-*/ic_launcher.png` katror, `ic_launcher_round.png` rreth),
//   me Chrome headless.
// Me `--preview <dosja>` ruan edhe pamjet për kontroll: 48, 96 dhe 192 px në rreth, katror dhe
// squircle, ikonën me temë, PNG-të, favicon-in dhe ekranin e nisjes.
//
// Përdorimi: node tools/app-icon/build.mjs [--preview <dosja>]   (CHROME=/rruga/e/chrome, parazgjedhje google-chrome)
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const res = join(root, 'android/app/src/main/res')
const read = (path) => readFileSync(join(root, path), 'utf8')
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

function match(text, pattern, what) {
  const found = pattern.exec(text)
  if (!found) throw new Error(`Nuk gjeta ${what}`)
  return found
}

// Shenja nga komponenti i app-it.
const logo = read('src/components/ui/logo.tsx')
const size = Number(match(logo, /viewBox="0 0 (\d+) \1"/, 'viewBox-in katror te logo.tsx')[1])
const radius = Number(match(logo, /<rect [^>]*rx="(\d+(?:\.\d+)?)"/, 'rrezen e katrorit te logo.tsx')[1])
const line = match(logo, /<path d="M\s*([\d.]+)[ ,]([\d.]+)\s+L?\s*([\d.]+)[ ,]([\d.]+)"/, 'vijën e shpejtësisë te logo.tsx').slice(1).map(Number)
const stroke = Number(match(logo, /strokeWidth="(\d+(?:\.\d+)?)"/, 'trashësinë e vijës te logo.tsx')[1])
const [x1, y1, x2, y2] = line

// Ngjyrat nga tokenat e app-it (të njëjta në çdo temë).
const css = read('src/styles/globals.css')
const token = (name) => match(css, new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`), `--${name} te globals.css`)[1].toUpperCase()
const ember = token('ember')
const onEmber = token('on-ember')

const HEADER = 'Krijuar nga tools/app-icon/build.mjs nga shenja te src/components/ui/logo.tsx; mos e ndrysho me dorë.'
const linePath = `M${x1},${y1}L${x2},${y2}`
const r = radius
const roundedSquare = `M${r},0H${size - r}A${r},${r} 0,0 1,${size},${r}V${size - r}A${r},${r} 0,0 1,${size - r},${size}H${r}A${r},${r} 0,0 1,0,${size - r}V${r}A${r},${r} 0,0 1,${r},0Z`

/** Shenja si SVG: `shape` është katrori i rrumbullakosur, rrethi, ose asnjë (vetëm vija). */
function markSvg({ shape = 'square', lineColor = onEmber, fill = ember, margin = 0 } = {}) {
  const box = size + margin * 2
  const body =
    shape === 'square'
      ? `<rect width="${size}" height="${size}" rx="${r}" fill="${fill}"/>`
      : shape === 'circle'
        ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${fill}"/>`
        : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${box} ${box}">${body}<path d="M${x1} ${y1} ${x2} ${y2}" fill="none" stroke="${lineColor}" stroke-width="${stroke}" stroke-linecap="round"/></svg>`
}

/** Vector drawable i Android-it me shenjën në mes të një kanavace `viewport` njësi. */
function vector({ dp, viewport, paths, comment }) {
  const offset = (viewport - size) / 2
  const body = paths
    .map((path) =>
      [
        '        <path',
        `            android:pathData="${path.data}"`,
        ...(path.fill ? [`            android:fillColor="${path.fill}"`] : []),
        ...(path.stroke ? [`            android:strokeColor="${path.stroke}"`, `            android:strokeWidth="${stroke}"`, '            android:strokeLineCap="round"'] : []),
        '            />',
      ].join('\n'),
    )
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- ${HEADER}
     ${comment} -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${dp}dp"
    android:height="${dp}dp"
    android:viewportWidth="${viewport}"
    android:viewportHeight="${viewport}">
    <group android:translateX="${offset}" android:translateY="${offset}">
${body}
    </group>
</vector>
`
}

// Ikona adaptive: kanavaca 108 dp ka pjesën e dukshme 72 dp në mes; shenja (size njësi) zë 72 dp,
// ndaj kanavaca është size × 108 / 72 njësi.
const adaptiveViewport = (size * 108) / 72
write(
  join(res, 'drawable/ic_launcher_foreground.xml'),
  vector({
    dp: 108,
    viewport: adaptiveViewport,
    paths: [{ data: linePath, stroke: '@color/ic_launcher_line' }],
    comment: 'Vija e shpejtësisë mbi sfondin prush (@color/ic_launcher_background); launcher-i e pret në formën e vet.',
  }),
)
write(
  join(res, 'drawable/ic_launcher_monochrome.xml'),
  vector({
    dp: 108,
    viewport: adaptiveViewport,
    paths: [{ data: linePath, stroke: '#FFFFFFFF' }],
    comment: 'Ikona me një ngjyrë për ikonat me temë të Android 13+: sistemi e ngjyros vetë.',
  }),
)
// Nisja: ikona pa sfond është 288 dp dhe duhet të hyjë në rrethin 192 dp. Pika më e largët e katrorit
// të rrumbullakosur nga qendra: (size/2 − r)·√2 + r njësi; kanavaca zgjidhet që ajo të bjerë te 92 dp.
const farthest = (size / 2 - r) * Math.SQRT2 + r
const splashViewport = Math.ceil((farthest * 288) / 92)
write(
  join(res, 'drawable/ic_splash.xml'),
  vector({
    dp: 288,
    viewport: splashViewport,
    paths: [
      { data: roundedSquare, fill: '@color/ic_launcher_background' },
      { data: linePath, stroke: '@color/ic_launcher_line' },
    ],
    comment: 'Shenja e plotë për ekranin e nisjes (Android 12+ dhe core-splashscreen), brenda rrethit 192 dp.',
  }),
)
write(
  join(res, 'values/ic_launcher_colors.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- ${HEADER}
     Prushi (tokeni ember) dhe vija mbi të (on-ember) nga src/styles/globals.css. -->
<resources>
    <color name="ic_launcher_background">${ember}</color>
    <color name="ic_launcher_line">${onEmber}</color>
</resources>
`,
)
write(join(root, 'public/favicon.svg'), `${markSvg()}\n`)

// Chrome headless përmes CDP (si scripts/ds-screens.mjs): një shfletues për të gjitha PNG-të, çdo
// faqe me SVG-në në gjithë dritaren dhe sfond të tejdukshëm.
const work = mkdtempSync(join(tmpdir(), 'vrull-icon-'))
const browser = await openChrome(work)
try {
  // Ikonat e vjetra (Android 7.0–7.1): 48 dp me 2 dp hapësirë rreth shenjës.
  const legacyMargin = (size * 2) / 44
  const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [density, px] of Object.entries(densities)) {
    await browser.shoot(markSvg({ margin: legacyMargin }), px, px, join(res, `mipmap-${density}/ic_launcher.png`))
    await browser.shoot(markSvg({ shape: 'circle', margin: legacyMargin }), px, px, join(res, `mipmap-${density}/ic_launcher_round.png`))
  }

  const previewIndex = process.argv.indexOf('--preview')
  if (previewIndex > 0) {
    const out = process.argv[previewIndex + 1]
    if (!out) throw new Error('--preview kërkon një dosje')
    mkdirSync(out, { recursive: true })
    await preview(browser, out)
  }
} finally {
  // Profili fshihet pasi Chrome të ketë dalë, që të mos shkruajë më në të.
  await browser.close()
  rmSync(work, { recursive: true, force: true, maxRetries: 5 })
}
console.log(`Ikona e Vrullit: ${ember} me vijën ${onEmber}; nisja ${splashViewport} njësi në 288 dp.`)

/** Pamjet për kontroll: si e pret launcher-i ikonën adaptive në forma të ndryshme dhe madhësi. */
async function preview(browser, out) {
  // Kanavaca adaptive (108) e prerë te 72 në mes, pastaj maska e launcher-it.
  const adaptive = (shape, px, themed = false) => {
    // 72 dp e dukshme = size njësi në mes të kanavacës; vija është aty ku e vendos ic_launcher_foreground.
    const offset = (adaptiveViewport - size) / 2
    const half = adaptiveViewport / 2
    const clip =
      shape === 'circle'
        ? `<circle cx="${half}" cy="${half}" r="${size / 2}"/>`
        : shape === 'square'
          ? `<rect x="${offset}" y="${offset}" width="${size}" height="${size}" rx="${size * 0.12}"/>`
          : `<path d="${squircle(half, size / 2)}"/>`
    // Me temë: ngjyrat i zgjedh sistemi; këtu një shembull i Material You.
    const background = themed ? '#D8E2FF' : ember
    const lineColor = themed ? '#1A2B4C' : onEmber
    const id = `m-${shape}-${px}-${themed ? 't' : 'c'}`
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="${offset} ${offset} ${size} ${size}"><defs><clipPath id="${id}">${clip}</clipPath></defs><g clip-path="url(#${id})"><rect width="${adaptiveViewport}" height="${adaptiveViewport}" fill="${background}"/><path d="M${x1 + offset} ${y1 + offset} ${x2 + offset} ${y2 + offset}" stroke="${lineColor}" stroke-width="${stroke}" stroke-linecap="round" fill="none"/></g></svg>`
  }
  const cell = (label, content) => `<figure><div class="art">${content}</div><figcaption>${label}</figcaption></figure>`
  const rows = [48, 96, 192]
    .map(
      (px) =>
        `<section><h2>${px} px</h2>${['circle', 'square', 'squircle'].map((shape) => cell(shape === 'circle' ? 'rreth' : shape === 'square' ? 'katror' : 'squircle', adaptive(shape, px))).join('')}${cell('me temë', adaptive('circle', px, true))}${cell('PNG 7.x', `<img src="file://${join(res, `mipmap-${px === 48 ? 'mdpi' : px === 96 ? 'xhdpi' : 'xxxhdpi'}/ic_launcher.png`)}" width="${px}" height="${px}">`)}${cell('PNG rreth', `<img src="file://${join(res, `mipmap-${px === 48 ? 'mdpi' : px === 96 ? 'xhdpi' : 'xxxhdpi'}/ic_launcher_round.png`)}" width="${px}" height="${px}">`)}</section>`,
    )
    .join('')
  const favicon = [16, 32, 48].map((px) => cell(`favicon ${px}`, `<img src="file://${join(root, 'public/favicon.svg')}" width="${px}" height="${px}">`)).join('')
  const style = `<style>body{margin:0;padding:16px;background:#3A3A3C;color:#fff;font:13px system-ui}section{display:flex;gap:16px;align-items:flex-end;margin-bottom:16px}h2{flex:0 0 64px;font-size:13px;margin:0}figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:4px}.art{display:flex;align-items:center;justify-content:center}.light{display:flex;gap:16px;align-items:flex-end;background:#F4F4F5;color:#000;padding:8px;border-radius:8px}</style>`
  await browser.shoot(`${style}${rows}<section><h2>web</h2>${favicon}<div class="light">${favicon}</div></section>`, 1360, 640, join(out, 'app-icon-preview.png'))
  // Nisja në 390 × 844 dp: sfondi i zi i OLED-it, shenja në kanavacën 288 dp dhe (me vijë) rrethi
  // 192 dp ku Android e pret.
  const splashPx = (size * 288) / splashViewport
  await browser.shoot(
    `<div style="width:100vw;height:100vh;background:#000;display:flex;align-items:center;justify-content:center"><div style="width:192px;height:192px;display:flex;align-items:center;justify-content:center;outline:1px dashed #555;border-radius:50%"><div style="width:${splashPx}px;height:${splashPx}px;flex-shrink:0">${markSvg()}</div></div></div>`,
    390,
    844,
    join(out, 'splash-preview.png'),
  )
}

/** Squircle (superelipsë n = 4) me qendër dhe rreze, si maska e disa launcher-ëve. */
function squircle(center, radius) {
  const points = []
  for (let step = 0; step <= 64; step++) {
    const angle = (step / 64) * Math.PI * 2
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x = center + radius * Math.sign(cos) * Math.abs(cos) ** 0.5
    const y = center + radius * Math.sign(sin) * Math.abs(sin) ** 0.5
    points.push(`${step === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `${points.join('')}Z`
}

/** Chrome headless me CDP: `shoot(html, gjerësia, lartësia, skedari)` ruan faqen si PNG. */
async function openChrome(dir) {
  const page = join(dir, 'page.html')
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${join(dir, 'profile')}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars']
  // Si root (kontejnerët e CI-së) Chrome nuk niset me sandbox.
  if (process.getuid?.() === 0) args.push('--no-sandbox')
  const chrome = spawn(process.env.CHROME ?? 'google-chrome', [...args, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const exited = new Promise((resolve) => chrome.once('exit', resolve))
  const wsUrl = await new Promise((resolve, reject) => {
    let output = ''
    const timer = setTimeout(() => reject(new Error('Chrome nuk u nis për 30 s')), 30_000)
    chrome.stderr.on('data', (chunk) => {
      output += chunk
      const found = /DevTools listening on (ws:\/\/\S+)/.exec(output)
      if (found) {
        clearTimeout(timer)
        resolve(found[1])
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
  const loads = []
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.method === 'Page.loadEventFired') loads.splice(0).forEach((resolve) => resolve())
    const waiting = pending.get(message.id)
    if (!waiting) return
    pending.delete(message.id)
    if (message.error) waiting.reject(new Error(`${waiting.method}: ${message.error.message}`))
    else waiting.resolve(message.result)
  }
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, { method, resolve, reject })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const call = (method, params) => send(method, params, sessionId)
  await call('Page.enable')
  await call('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  return {
    async shoot(html, width, height, out) {
      writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}body>svg{display:block;width:100vw;height:100vh}</style>${html}`)
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
      const loaded = new Promise((resolve) => loads.push(resolve))
      await call('Page.navigate', { url: `file://${page}` })
      await loaded
      const { data } = await call('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } })
      write(out, Buffer.from(data, 'base64'))
    },
    async close() {
      ws.close()
      chrome.kill()
      await exited
    },
  }
}
