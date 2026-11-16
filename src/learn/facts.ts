import abs from './facts/sts-abs.json'
import back from './facts/sts-back.json'
import biceps from './facts/sts-biceps.json'
import chest from './facts/sts-chest.json'
import foods from './facts/foods.json'
import hinge from './facts/sts-hinge.json'
import legs from './facts/sts-legs.json'
import recovery from './facts/recovery.json'
import shoulders from './facts/sts-shoulders.json'
import triceps from './facts/sts-triceps.json'

// Paketa e fakteve të Mëso-s (V56, SPEC §0.3e): faktet me burim që vijnë me app-in, shqip dhe në anglishten britanike,
// pa internet dhe pa AI. Një skedar për grup (`facts/<grupi>.json`); provat e burimeve te `docs/research/facts/`.
// Tekstet nuk ndryshohen këtu: një fakt i ri ose i ndrequr del vetëm me një version të ri të app-it.

export interface Text {
  sq: string
  en: string
}

/** Tema e faktit: ushtrimi (emri si te Shortcut to Size), ushqimi i shabllonit të Jimit ose trupi dhe rikuperimi. */
export type FactTopic = { kind: 'exercise'; exercise: string } | { kind: 'food'; food: string } | { kind: 'recovery'; theme: string }

export interface FactSource {
  /** Si del te "Burimi" ("Schoenfeld dhe kolegët, 2016"); anglisht me `sourceLabel`. */
  label: string
  title: string
  url: string
  year: number
  /** Data kur u kontrollua kundrejt burimit. */
  checked: string
}

export interface FactQuiz {
  question: Text
  options: Text[]
  /** Indeksi i përgjigjes së saktë. */
  correct: number
}

export interface Fact {
  id: string
  topic: FactTopic
  text: Text
  /** "Më shumë"; null kur fakti s'ka shpjegim më të gjatë (del vetëm burimi). */
  more: Text | null
  source: FactSource
  quiz: FactQuiz
}

interface FactFile {
  group: string
  facts: Fact[]
}

const FILES = [chest, triceps, back, biceps, shoulders, legs, hinge, abs, foods, recovery] as unknown as FactFile[]

/** Grupet e paketës, me radhën e programit (gjoksi, tricepsi, …, barku), pastaj ushqimet dhe rikuperimi. */
export const FACT_GROUPS: readonly string[] = FILES.map((file) => file.group)

/** Të gjithë faktet e paketës. */
export const FACTS: readonly Fact[] = FILES.flatMap((file) => file.facts)

const byId = new Map(FACTS.map((fact) => [fact.id, fact]))

/** Fakti me këtë id, ose undefined kur nuk është (më) në paketë. */
export const factById = (id: string): Fact | undefined => byId.get(id)

const normal = (name: string) => name.trim().toLocaleLowerCase('en')

/** Faktet e një ushtrimi sipas emrit (pa dallim shkronjash), me radhën e paketës. */
export function exerciseFacts(name: string): Fact[] {
  const wanted = normal(name)
  return FACTS.filter((fact) => fact.topic.kind === 'exercise' && normal(fact.topic.exercise) === wanted)
}

/** Faktet e një ushqimi të shabllonit të Jimit (çelësi, p.sh. `oatmeal`). */
export function foodFacts(key: string): Fact[] {
  return FACTS.filter((fact) => fact.topic.kind === 'food' && fact.topic.food === key)
}

/** Faktet për trupin dhe rikuperimin (dita e pushimit te Sot). */
export const RECOVERY_FACTS: readonly Fact[] = FACTS.filter((fact) => fact.topic.kind === 'recovery')

/** Çelësi i ushqimit të Jimit nga `source_id` i ushqimit (`jim:oatmeal` → `oatmeal`); null për të tjerët. */
export function jimFoodKey(sourceId: string | null | undefined): string | null {
  return typeof sourceId === 'string' && sourceId.startsWith('jim:') ? sourceId.slice(4) : null
}

/**
 * Burimi në gjuhën e app-it: etiketat janë shkruar shqip ("Schoenfeld dhe kolegët, 2016"); anglisht lidhëza
 * përkthehet ("Schoenfeld and colleagues, 2016"), emrat dhe vitet mbeten.
 */
export function sourceLabel(label: string, lang: string): string {
  if (lang === 'sq') return label
  return label.replace(/ dhe kolegët/g, ' and colleagues').replace(/ dhe /g, ' and ')
}

/** Teksti në gjuhën e app-it (shqip ose anglisht). */
export const inLang = (text: Text, lang: string) => (lang === 'en' ? text.en : text.sq)
