#!/usr/bin/env node
// Minutat e GitHub Actions të një vale, për docs/agents/KOSTOT.md (docs/agents/ORKESTRIMI.md › Retro).
// Faturimi rrumbullakon çdo job lart në minutë të plotë; API-ja /timing nuk e jep më (docs/research/optimizimi-i-ndertimeve.md),
// ndaj minutat llogariten nga koha e çdo job-i, me të gjitha përpjekjet. Është vlerësim; fatura është te Billing → Usage.
//   node scripts/actions-usage.mjs --since 2026-11-09T20:00:00Z [--repo keyeser33-hash/Vrull]
import { execFileSync } from 'node:child_process'

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`)
  return index > 0 ? process.argv[index + 1] : fallback
}
const since = arg('since')
const repo = arg('repo', 'keyeser33-hash/Vrull')
if (!since || Number.isNaN(Date.parse(since))) {
  console.error('Përdorimi: node scripts/actions-usage.mjs --since <data ISO> [--repo pronari/repo]')
  process.exit(1)
}

const api = (path, jq) => execFileSync('gh', ['api', '--paginate', path, '--jq', jq], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
const rows = (text) => (text ? text.split('\n').map((line) => line.split('\t')) : [])

const runs = rows(api(`repos/${repo}/actions/runs?per_page=100&created=${encodeURIComponent(`>=${since}`)}`, '.workflow_runs[] | [.id, .name, (.conclusion // .status)] | @tsv'))
const totals = new Map()
let minutes = 0
for (const [id, name, conclusion] of runs) {
  const jobs = rows(api(`repos/${repo}/actions/runs/${id}/jobs?filter=all&per_page=100`, '.jobs[] | select(.started_at and .completed_at) | [.started_at, .completed_at] | @tsv'))
  const runMinutes = jobs.reduce((sum, [start, end]) => sum + Math.max(1, Math.ceil((Date.parse(end) - Date.parse(start)) / 60_000)), 0)
  const key = `${name}\t${conclusion}`
  const entry = totals.get(key) ?? { runs: 0, minutes: 0 }
  totals.set(key, { runs: entry.runs + 1, minutes: entry.minutes + runMinutes })
  minutes += runMinutes
}

console.log(`Nisjet që nga ${since} te ${repo}: ${runs.length}, rreth ${minutes} minuta (≈ $${(minutes * 0.006).toFixed(2).replace('.', ',')} me $0,006/min Linux)`)
console.log('Workflow\tPërfundimi\tNisje\tMinuta')
for (const [key, { runs: count, minutes: total }] of [...totals].sort((a, b) => b[1].minutes - a[1].minutes)) console.log(`${key}\t${count}\t${total}`)
