import { LEVEL_FILL, LEVEL_TONE, modeStyle, RECOVERY } from './body-format'

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

  it('një pamje, e njëjta vlerë te figura, modeli dhe teksti', () => {
    const entry = { recovery: 'pothuajse_gati' as const, level: 2 as const, load: 7.5 }
    expect(modeStyle('rikuperimi', entry)).toEqual({ fill: 'fill-brand/45', tone: { token: '--brand', alpha: 0.45 }, text: 'Pothuajse gati' })
    expect(modeStyle('volumi', entry)).toEqual({ fill: 'fill-brand/60', tone: { token: '--brand', alpha: 0.6 }, text: '7,5 sete' })
    expect(modeStyle('volumi', { ...entry, level: 0, load: 0 })).toEqual({ fill: null, tone: null, text: '0 sete' })
  })
})
