import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const ROOT = process.env.LIVE_ROOT ?? '/tmp/live/root'
const PORT = Number(process.env.LIVE_PORT ?? 4173)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
  let file = join(ROOT, path)
  let body
  try { body = await readFile(file) } catch { file = join(ROOT, 'index.html'); body = await readFile(file) }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(body)
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${PORT} nga ${ROOT}`))
