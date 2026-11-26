// Ndihmësi i CDP-së për provat live: Chrome pa ekran me profil të përhershëm, 390 × 844.
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
export const BASE = `http://127.0.0.1:${process.env.LIVE_PORT ?? 4173}`
export async function open({ width = 390, height = 844 } = {}) {
  const chrome = spawn('google-chrome', ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${process.env.LIVE_PROFILE ?? '/tmp/live/profile'}`, '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--no-sandbox', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const wsUrl = await new Promise((resolve, reject) => {
    let out = ''
    const t = setTimeout(() => reject(new Error('chrome')), 20000)
    chrome.stderr.on('data', (c) => { out += c; const m = /DevTools listening on (ws:\/\/\S+)/.exec(out); if (m) { clearTimeout(t); resolve(m[1]) } })
  })
  const ws = new WebSocket(wsUrl)
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j })
  let id = 0
  const pending = new Map()
  const errors = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); return }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const i = ++id; pending.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params, sessionId })) })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = (m, p) => send(m, p, sessionId)
  await page('Page.enable'); await page('Runtime.enable')
  await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true })
  await page('Emulation.setTimezoneOverride', { timezoneId: 'Europe/Tirane' })
  const evaluate = async (expression) => {
    const r = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true })
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    return r.result.value
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const waitFor = async (expr, label, timeout = 15000) => { const s = Date.now(); while (Date.now() - s < timeout) { if (await evaluate(expr).catch(() => false)) return true; await sleep(150) } throw new Error('Nuk u arrit: ' + label) }
  const go = async (path) => { await page('Page.navigate', { url: BASE + path }); await sleep(300); await waitFor(`document.readyState === 'complete'`, path); await sleep(900) }
  const shot = async (file, full = false) => {
    if (full) {
      const h = await evaluate(`Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, ...[...document.querySelectorAll('main, [data-scroll], .overflow-y-auto')].map((e) => e.scrollHeight + e.getBoundingClientRect().top))`)
      await page('Emulation.setDeviceMetricsOverride', { width, height: Math.min(Math.max(h, height), 5000), deviceScaleFactor: 1, mobile: true })
      await sleep(500)
    }
    const r = await page('Page.captureScreenshot', { format: 'png' })
    writeFileSync(file, Buffer.from(r.data, 'base64'))
    if (full) { await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true }); await sleep(200) }
  }
  // Klikon butonin ose lidhjen me tekstin (ose aria-label) e dhënë.
  const click = async (text) => evaluate(`(() => { const t = ${JSON.stringify(text)}; const els = [...document.querySelectorAll('button, a, [role=button], [role=radio], [role=tab], label, [role=switch], [role=checkbox]')]; const ws = new RegExp(String.fromCharCode(92) + 's+', 'g'); const n = (e) => (e.textContent || '').replace(ws, ' ').trim().toLowerCase(); const lt = t.toLowerCase(); const vis = els.filter((e) => e.offsetParent !== null || e.getClientRects().length); const el = vis.find((e) => n(e) === lt) || vis.find((e) => (e.getAttribute('aria-label') || '').toLowerCase() === lt) || vis.find((e) => n(e).startsWith(lt)); if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true })()`)
  const text = () => evaluate(`document.body.innerText`)
  const close = async () => { try { await send('Browser.close') } catch {} ; chrome.kill() }
  return { page, evaluate, waitFor, go, shot, click, text, sleep, errors, close }
}
