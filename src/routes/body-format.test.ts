import { focusDetail, LEVEL_FILL, LEVEL_TONE, modeStyle, RECOVERY, setsText } from './body-format'

// Modeli 3D merr të njëjtat ngjyra si figura 2D: tokeni dhe opaciteti i klasës `fill-…`.
function fromClass(fill: string | null) {
  if (fill === null) return null
  const match = /^fill-([a-z-]+)(?:\/(\d+))?$/.exec(fill)
  if (!match) throw new Error(fill)
  return { token: `--${match[1]}`, alpha: match[2] ? Number(match[2]) / 100 : 1 }
}

describe('ngjyrat e Trupit', () => {
  it('rikuperimi: toni 3D i çdo gjendjeje përputhet me klasën e figurës 2D', () => {
    for (const [status, style] of Object.entries(RECOVERY)) expect(style.tone, status).toEqual(fromClass(style.fill))
  })

  it('volumi: katër nivele, "pa sete" pa ngjyrë, pastaj brand gjithnjë e më i plotë', () => {
    expect(LEVEL_TONE).toEqual(LEVEL_FILL.map(fromClass))
    expect(LEVEL_TONE.map((tone) => tone?.alpha ?? 0)).toEqual([0, 0.3, 0.6, 1])
  })

  it('një pamje, e njëjta vlerë te figura, modeli, teksti dhe rreshti i listës', () => {
    const entry = { recovery: 'pothuajse_gati' as const, level: 1 as const, load: 7.5, hours: 50 }
    expect(modeStyle('rikuperimi', entry)).toEqual({
      fill: 'fill-brand/45',
      tone: { token: '--brand', alpha: 0.45 },
      text: 'Pothuajse gati',
      value: 'Pothuajse gati',
      detail: 'Stërvitja e fundit para 2 ditësh',
    })
    expect(modeStyle('volumi', entry)).toEqual({
      fill: 'fill-brand/30',
      tone: { token: '--brand', alpha: 0.3 },
      text: '7,5 sete · nën objektiv',
      value: '7,5 sete',
      detail: 'Nën objektiv',
    })
    expect(modeStyle('volumi', { ...entry, level: 2, load: 14 }).text).toBe('14 sete · në objektiv')
    // Pa sete: vlera e thotë një herë, rreshti shton vetëm objektivin.
    expect(modeStyle('volumi', { ...entry, level: 0, load: 0 })).toEqual({ fill: null, tone: null, text: 'Pa sete', value: 'Pa sete', detail: 'Nën objektiv' })
  })

  it('setet me presje dhjetore; zero është "Pa sete"', () => {
    expect([0, 0.5, 1, 1.5, 12].map(setsText)).toEqual(['Pa sete', '0,5 sete', '1 set', '1,5 sete', '12 sete'])
  })

  it('çipi i fokusit: te volumi, pjesa e prekur kundrejt grupit; te rikuperimi, gjendja e grupit', () => {
    const chest = {
      recovery: 'i_lodhur' as const,
      level: 1 as const,
      load: 3,
      hours: 20,
      unsplit: 0,
      // Bench Press: 3 sete te grupi, 3 te gjoksi i mesëm (kryesor), 1,5 te i sipërmi (ndihmës).
      parts: [
        { key: 'pectoralis_major_clavicular', load: 1.5 },
        { key: 'pectoralis_major_sternocostal', load: 3 },
        { key: 'pectoralis_minor', load: 0 },
      ],
    }
    expect(focusDetail('volumi', chest, 'pectoralis_major_clavicular', 'Gjoksi i sipërm')).toBe('Gjoksi i sipërm · 1,5 nga 3 sete')
    expect(focusDetail('volumi', chest, 'pectoralis_minor', 'Pectoralis minor')).toBe('Pectoralis minor · 0 nga 3 sete')
    expect(focusDetail('rikuperimi', chest, 'pectoralis_minor', 'Pectoralis minor')).toBe('Pectoralis minor · I lodhur')
    const calves = { ...chest, level: 0 as const, load: 0, parts: [{ key: 'gastrocnemius', load: 0 }, { key: 'soleus', load: 0 }] }
    expect(focusDetail('volumi', calves, 'gastrocnemius', 'Gastroknemiusi')).toBe('Gastroknemiusi · Pa sete')
    // Një grup me një pjesë: vlera e grupit, me objektivin.
    const traps = { ...chest, level: 2 as const, load: 12, parts: [{ key: 'trapezius', load: 12 }] }
    expect(focusDetail('volumi', traps, 'trapezius', 'Trapezi')).toBe('Trapezi · 12 sete · në objektiv')
    // Me sete nga biblioteka (pa ndarje sipas pjesëve), çipi nuk e ndan grupin: vlera e grupit.
    const mixed = { ...chest, load: 7, unsplit: 4 }
    expect(focusDetail('volumi', mixed, 'pectoralis_minor', 'Pectoralis minor')).toBe('Pectoralis minor · 7 sete · nën objektiv')
  })
})
