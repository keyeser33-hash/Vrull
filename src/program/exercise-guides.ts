// Udhëzuesi i ushtrimit si të dhëna (SPEC §0.3g): përgatitja, lëvizja, tempo dhe fryma, sinjalet,
// gabimet, këshillat me emrin e ekspertit, siguria dhe "Pak histori", në shqip dhe anglisht, secili
// seksion me burimin. Skedarët janë te `guides/`, një për çdo grup (docs/agents/PLANI-UDHEZUESIT.md);
// `guideProblems` është roja që provat e nisin për çdo skedar.

export interface Text {
  sq: string
  en: string
}

export interface GuideList {
  items: Text[]
  /** Çelësat te `sources`; rreshti "Burimi" poshtë seksionit. */
  sources: string[]
}

export interface GuideTip {
  /** Organizata, studimi ose eksperti me titull, si del në krye të kartës. */
  who: string
  text: Text
  sources: string[]
}

export interface GuideSource {
  /** Si del te rreshti "Burimi": "NASM, Barbell Bench Press". */
  label: string
  url: string
  /** Data kur burimi u hap dhe u krahasua me tekstin. */
  checked: string
}

export interface ExerciseGuide {
  /** Emri te Shortcut to Size ose ID-ja e free-exercise-db. */
  exercise: string
  /** Sekondat e fazës ekscentrike (ulja e kontrolluar, muskuli zgjatet) dhe koncentrike, pavarësisht
   * drejtimit të shufrës; null për mbajtjet (plank). */
  tempo: { eccentricS: number; concentricS: number } | null
  setup: GuideList
  steps: GuideList
  breathing: GuideList
  /** 3–6; të parat 3 dalin te seanca. */
  cues: GuideList
  mistakes: GuideList
  tips: GuideTip[]
  safety: GuideList
  history: { text: Text; sources: string[] } | null
  sources: Record<string, GuideSource>
}

export interface GuideFile {
  group: string
  guides: ExerciseGuide[]
}

const LIMITS: Record<'setup' | 'steps' | 'breathing' | 'cues' | 'mistakes' | 'safety', [number, number]> = {
  setup: [2, 6],
  steps: [2, 6],
  breathing: [1, 4],
  cues: [3, 6],
  mistakes: [3, 8],
  safety: [1, 5],
}
const MAX_LINE = 280
const MAX_CUE = 40
const MAX_TIPS = 6
// SPEC §0.3e: jo Wikipedia, blogje, forume ose rrjete sociale.
const BANNED = /(^|\.)(wikipedia\.org|reddit\.com|quora\.com|blogspot\.com|wordpress\.com|medium\.com|tiktok\.com|facebook\.com|instagram\.com|pinterest\.com)$/
const EMOJI = /\p{Extended_Pictographic}/u

function textProblems(where: string, text: Text, max: number): string[] {
  const out: string[] = []
  for (const lang of ['sq', 'en'] as const) {
    const value = text[lang]?.trim() ?? ''
    const at = `${where} ${lang}`
    if (!value) {
      out.push(`${at}: bosh`)
      continue
    }
    if (/^\p{Ll}/u.test(value)) out.push(`${at}: nis me shkronjë të vogël`)
    if (value.includes('!')) out.push(`${at}: pikëçuditje`)
    if (EMOJI.test(value)) out.push(`${at}: emoji`)
    if (value.length > max) out.push(`${at}: mbi ${max} shenja`)
  }
  return out
}

function sourceProblems(where: string, keys: string[], guide: ExerciseGuide): string[] {
  if (!keys.length) return [`${where}: pa burim`]
  return keys.filter((key) => !guide.sources[key]).map((key) => `${where}: burimi nuk ekziston: ${key}`)
}

/** Problemet e një udhëzuesi; bosh kur është gati për app-in. */
export function guideProblems(guide: ExerciseGuide, known: Set<string>): string[] {
  const out: string[] = []
  if (!known.has(guide.exercise)) out.push(`ushtrimi nuk njihet: ${guide.exercise}`)
  if (guide.tempo) {
    const { eccentricS, concentricS } = guide.tempo
    if (!Number.isInteger(eccentricS) || !Number.isInteger(concentricS) || eccentricS < 1 || eccentricS > 6 || concentricS < 1 || concentricS > 4) out.push('tempo: jashtë kufijve')
  }

  for (const [key, [min, max]] of Object.entries(LIMITS) as [keyof typeof LIMITS, [number, number]][]) {
    const section = guide[key]
    const n = section.items.length
    if (n < min || n > max) out.push(`${key}: ${n} rreshta, lejohen ${min}–${max}`)
    section.items.forEach((item, i) => out.push(...textProblems(`${key} ${i + 1}`, item, key === 'cues' ? MAX_CUE : MAX_LINE)))
    out.push(...sourceProblems(key, section.sources, guide))
  }

  if (guide.tips.length > MAX_TIPS) out.push(`tips: ${guide.tips.length}, lejohen deri në ${MAX_TIPS}`)
  guide.tips.forEach((tip, i) => {
    if (!tip.who.trim()) out.push(`tips ${i + 1}: pa emrin e ekspertit`)
    out.push(...textProblems(`tips ${i + 1}`, tip.text, MAX_LINE * 2))
    out.push(...sourceProblems(`tips ${i + 1}`, tip.sources, guide))
  })
  if (guide.history) {
    out.push(...textProblems('history', guide.history.text, MAX_LINE * 2))
    out.push(...sourceProblems('history', guide.history.sources, guide))
  }

  const used = new Set([
    ...Object.keys(LIMITS).flatMap((key) => guide[key as keyof typeof LIMITS].sources),
    ...guide.tips.flatMap((tip) => tip.sources),
    ...(guide.history?.sources ?? []),
  ])
  for (const [key, source] of Object.entries(guide.sources)) {
    if (!used.has(key)) out.push(`burimi nuk përdoret: ${key}`)
    if (!source.label.trim()) out.push(`${key}: pa emër`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checked)) out.push(`${key}: data e kontrollit`)
    let url: URL | null = null
    try {
      url = new URL(source.url)
    } catch {
      out.push(`${key}: lidhje e pavlefshme`)
    }
    if (url && url.protocol !== 'https:') out.push(`${key}: lidhja duhet https`)
    if (url && BANNED.test(url.hostname)) out.push(`${key}: burim i ndaluar (${url.hostname})`)
  }
  return out
}
