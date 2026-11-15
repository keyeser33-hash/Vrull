#!/usr/bin/env node
// Minutat e GitHub Actions të një vale ose të muajit, për docs/agents/KOSTOT.md dhe para çdo emulatori ose lëshimi
// (docs/agents/ORKESTRIMI.md › hapi 8, Lëshimi). Faturimi rrumbullakon çdo job lart në minutë të plotë; API-ja /timing
// nuk e jep më (docs/research/optimizimi-i-ndertimeve.md), ndaj minutat llogariten nga koha e çdo job-i, me të gjitha
// përpjekjet. Është vlerësim; fatura është te Settings → Billing → Usage.
//   node scripts/actions-usage.mjs --since 2026-11-09T20:00:00Z [--repo keyeser33-hash/Vrull]
//   node scripts/actions-usage.mjs --month [--check <minutat që do nisësh>] [--release]
// --check del me kodin 1 kur minutat që mbeten, pa rezervën e lëshimit, nuk mjaftojnë; me --release (vetë lëshimi)
// rezerva nuk zbritet, sepse ajo mbahet pikërisht për të.
import { execFileSync } from 'node:child_process'

// Plani Free: $12 në muaj, Linux me 2 bërthama $0,006/min (docs.github.com › Billing › GitHub Actions).
const INCLUDED_USD = 12
const LINUX_USD_PER_MIN = 0.006
const INCLUDED_MIN = Math.floor(INCLUDED_USD / LINUX_USD_PER_MIN)
// Një lëshim kushton ~30 min (0.24.0), dhe porta e tij mund të duhet nisur edhe një herë.
const RELEASE_RESERVE_MIN = 60

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 ? process.argv[index + 1] : fallback
}
const has = (name) => process.argv.includes(`--${name}`)
const repo = arg('repo', 'keyeser33-hash/Vrull')
const month = has('month')
const now = new Date()
const since = month ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString() : arg('since')
const check = has('check') ? Number(arg('check')) : undefined
if (!since || Number.isNaN(Date.parse(since)) || (check !== undefined && !(check >= 0))) {
  console.error('Përdorimi: node scripts/actions-usage.mjs (--since <data ISO> | --month) [--check <minuta>] [--repo pronari/repo]')
  process.exit(2)
}

const rows = (text) => (text ? text.split('\n').map((line) => line.split('\t')) : [])
const api = (path, jq) => rows(execFileSync('gh', ['api', path, '--jq', jq], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim())
// `gh api --paginate` bie te proxy-ja e sesionit mbi 100 nisje (403, "Numeric-ID repository paths"), ndaj faqet merren me `page=`.
const pages = (path, jq) => {
  const all = []
  for (let page = 1; ; page++) {
    const batch = api(`${path}&per_page=100&page=${page}`, jq)
    all.push(...batch)
    if (batch.length < 100) return all
  }
}

const runs = pages(`repos/${repo}/actions/runs?created=${encodeURIComponent(`>=${since}`)}`, '.workflow_runs[] | [.id, .name, (.conclusion // .status)] | @tsv')
const totals = new Map()
let minutes = 0
for (const [id, name, conclusion] of runs) {
  const jobs = pages(`repos/${repo}/actions/runs/${id}/jobs?filter=all`, '.jobs[] | select(.started_at and .completed_at) | [.started_at, .completed_at] | @tsv')
  const runMinutes = jobs.reduce((sum, [start, end]) => sum + Math.max(1, Math.ceil((Date.parse(end) - Date.parse(start)) / 60_000)), 0)
  const key = `${name}\t${conclusion}`
  const entry = totals.get(key) ?? { runs: 0, minutes: 0 }
  totals.set(key, { runs: entry.runs + 1, minutes: entry.minutes + runMinutes })
  minutes += runMinutes
}

const usd = (value) => `$${value.toFixed(2).replace('.', ',')}`
console.log(`Nisjet që nga ${since} te ${repo}: ${runs.length}, rreth ${minutes} minuta (≈ ${usd(minutes * LINUX_USD_PER_MIN)} me $0,006/min Linux)`)
console.log('Workflow\tPërfundimi\tNisje\tMinuta')
for (const [key, { runs: count, minutes: total }] of [...totals].sort((a, b) => b[1].minutes - a[1].minutes)) console.log(`${key}\t${count}\t${total}`)

if (month) {
  const left = INCLUDED_MIN - minutes
  console.log(`Muaji: rreth ${minutes} nga ${INCLUDED_MIN} minuta; mbeten rreth ${left}, nga të cilat ${RELEASE_RESERVE_MIN} janë rezerva e lëshimit.`)
  if (check !== undefined) {
    const free = left - (has('release') ? 0 : RELEASE_RESERVE_MIN)
    if (free < check) {
      console.error(`Ndal: nisja kërkon ~${check} min, dhe mbeten ~${Math.max(0, free)}. Pyet përdoruesin (ORKESTRIMI.md › Kostot).`)
      process.exit(1)
    }
    console.log(`Mjafton: nisja kërkon ~${check} min, dhe mbeten ~${free}.`)
  }
}
