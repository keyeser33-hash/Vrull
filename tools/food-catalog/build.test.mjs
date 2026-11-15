// @vitest-environment node
import { gunzipSync, gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { assemble, READERS } from './build.mjs'
import { SOURCE_LICENSES } from './check.mjs'
import { itemsOf, sha256Of, verifySha } from './download.mjs'
import { readCiqual } from './ciqual.mjs'
import { readDataset } from './usda.mjs'

const fixture = (name) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url))
const parts = () => [
  ...[
    ['usda_foundation', 'foundation'],
    ['usda_sr_legacy', 'sr_legacy'],
    ['usda_fndds', 'fndds'],
  ].map(([source, dir]) => ({ source, version: 'test', ...readDataset(source, fixture(dir)) })),
  { source: 'ciqual', version: 'test', ...readCiqual(fixture('ciqual')) },
]

describe('ndërtimi i listës', () => {
  it('bashkon burimet pa gabime të rojës dhe numëron sipas burimit', () => {
    const { jsonl, summary, errors } = assemble(parts())
    expect(errors).toEqual([])
    expect(summary.total).toBe(15)
    expect(Object.fromEntries(Object.entries(summary.bySource).map(([key, value]) => [key, value.rows]))).toEqual({
      usda_foundation: 5,
      usda_sr_legacy: 2,
      usda_fndds: 3,
      ciqual: 5,
    })
    expect(summary.check.notes.kcal_flag).toBe(3)
    const rows = jsonl.trim().split('\n').map((line) => JSON.parse(line))
    expect(rows).toHaveLength(15)
    expect(new Set(rows.map((row) => row.id)).size).toBe(15)
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

  it('sources.json: çdo burim ka faqe, version, licencë të njohur nga roja, atribuim dhe URL-të nga faqet zyrtare me sha256', () => {
    const config = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))
    const official = {
      usda_foundation: /^https:\/\/fdc\.nal\.usda\.gov\/fdc-datasets\/.+\.zip$/,
      usda_sr_legacy: /^https:\/\/fdc\.nal\.usda\.gov\/fdc-datasets\/.+\.zip$/,
      usda_fndds: /^https:\/\/fdc\.nal\.usda\.gov\/fdc-datasets\/.+\.zip$/,
      ciqual: /^https:\/\/entrepot\.recherche\.data\.gouv\.fr\/api\/access\/datafile\/\d+$/,
    }
    expect(config.files.map((file) => file.id)).toEqual(Object.keys(official))
    for (const file of config.files) {
      expect(SOURCE_LICENSES[file.id]).toBe(file.license)
      expect(file.licenseUrl).toMatch(/^https:\/\//)
      expect(file.attribution.length).toBeGreaterThan(20)
      expect(file.page).toMatch(/^https:\/\//)
      expect(file.version).toMatch(/^\d{4}-\d{2}/)
      for (const { item } of itemsOf(file, '/x')) {
        expect(item.url).toMatch(official[file.id])
        expect(item.sha256).toMatch(/^[0-9a-f]{64}$/)
      }
    }
    expect(config.files.find((file) => file.id === 'usda_sr_legacy').license).toBe('CC0-1.0')
  })

  it('buildi ka lexues për çdo burim të sources.json', () => {
    const config = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))
    for (const file of config.files) expect(READERS[file.id]).toBeTypeOf('function')
  })
})
