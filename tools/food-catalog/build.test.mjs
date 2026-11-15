// @vitest-environment node
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { assemble } from './build.mjs'
import { sha256Of, verifySha } from './download.mjs'
import { readDataset } from './usda.mjs'

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const parts = () =>
  [
    ['usda_foundation', 'foundation'],
    ['usda_sr_legacy', 'sr_legacy'],
    ['usda_fndds', 'fndds'],
  ].map(([source, dir]) => ({ source, version: 'test', ...readDataset(source, fixture(dir)) }))

describe('ndërtimi i listës', () => {
  it('bashkon tre burimet pa gabime të rojës dhe numëron sipas burimit', () => {
    const { jsonl, summary, errors } = assemble(parts())
    expect(errors).toEqual([])
    expect(summary.total).toBe(10)
    expect(Object.fromEntries(Object.entries(summary.bySource).map(([key, value]) => [key, value.rows]))).toEqual({
      usda_foundation: 5,
      usda_sr_legacy: 2,
      usda_fndds: 3,
    })
    expect(summary.check.notes.kcal_flag).toBe(2)
    const rows = jsonl.trim().split('\n').map((line) => JSON.parse(line))
    expect(rows).toHaveLength(10)
    expect(new Set(rows.map((row) => row.id)).size).toBe(10)
  })

  it('madhësia e ngjeshur përputhet me gzip të skedarit', () => {
    const { jsonl, summary } = assemble(parts())
    expect(summary.bytes).toBe(Buffer.byteLength(jsonl))
    expect(gunzipSync(gzipSync(jsonl)).toString()).toBe(jsonl)
    expect(summary.gzipBytes).toBeGreaterThan(0)
    expect(summary.gzipBytes).toBeLessThan(summary.bytes)
  })

  it('dalja është e përcaktuar: i njëjti hyrje jep të njëjtin skedar', () => {
    expect(assemble(parts()).jsonl).toBe(assemble(parts()).jsonl)
  })

  it('një ID e dyfishtë mes burimeve del si gabim te përmbledhja', () => {
    const doubled = parts()
    doubled[1].rows.push({ ...doubled[1].rows[0] })
    const { summary, errors } = assemble(doubled)
    expect(errors.map((error) => error.rule)).toContain('id_duplicate')
    expect(summary.check.errors).toBeGreaterThan(0)
  })
})

describe('shkarkimi', () => {
  it('sha256 i herës së parë regjistrohet; më pas duhet të përputhet', () => {
    const sha = sha256Of(Buffer.from('abc'))
    expect(sha).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(verifySha(null, sha)).toEqual({ ok: true, record: sha })
    expect(verifySha(sha, sha)).toEqual({ ok: true, record: null })
    expect(verifySha(sha, 'tjetër').ok).toBe(false)
  })

  it('sources.json: çdo skedar ka URL nga fdc.nal.usda.gov, version, sha256 dhe licenca është CC0', () => {
    const config = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))
    expect(config.license).toBe('CC0-1.0')
    expect(config.files.map((file) => file.id)).toEqual(['usda_foundation', 'usda_sr_legacy', 'usda_fndds'])
    for (const file of config.files) {
      expect(file.url).toMatch(/^https:\/\/fdc\.nal\.usda\.gov\/fdc-datasets\/.+\.zip$/)
      expect(file.version).toMatch(/^\d{4}-\d{2}/)
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})
