import { JIM_FOODS } from '@/nutrition/jim'
import { SHORTCUT_TO_SIZE } from '@/program/shortcut-to-size'
import { exerciseFacts, type Fact, FACT_GROUPS, FACTS, factById, foodFacts, jimFoodKey, RECOVERY_FACTS, sourceLabel, type Text } from './facts'

// Paketa e fakteve (SPEC §0.3e): forma e çdo fakti si kontrolli i agjentëve (`check.mjs`), emrat e ushtrimeve kundrejt
// Shortcut to Size, çelësat e ushqimeve kundrejt shabllonit të Jimit dhe id-të unike.

const THEMES = ['rest', 'sleep', 'protein', 'hydration', 'warmup', 'progression', 'effort', 'soreness', 'volume', 'frequency', 'tempo', 'creatine', 'caffeine', 'recovery']
const ACRONYMS = /\b(NSCA|ACSM|NASM|EFSA|USDA|NIH|ISSN|EMG|DOMS|RIR|RPE|IFBB|AAU|YMCA|BMJ|JAMA|DHA|EPA|ACE|FDA|WHO|HMB|ATP|BCAA|CSCS|PhD|MD|DPT)\b/g

/** Problemet e një teksti dygjuhësh: bosh, gjatësia, pikëçuditja, emoji, hapësirat, sentence case, presja dhjetore. */
function textProblems(where: string, value: Text | null | undefined, max: number, sentence = true): string[] {
  if (!value) return [`${where}: mungon`]
  const problems: string[] = []
  for (const lang of ['sq', 'en'] as const) {
    const s = value[lang]
    if (typeof s !== 'string' || s.trim() === '') {
      problems.push(`${where}.${lang}: bosh`)
      continue
    }
    if (s.length > max) problems.push(`${where}.${lang}: ${s.length} shenja (deri në ${max})`)
    if (s.includes('!')) problems.push(`${where}.${lang}: pikëçuditje`)
    if (/\p{Extended_Pictographic}/u.test(s)) problems.push(`${where}.${lang}: emoji`)
    if (s !== s.trim() || /\s{2,}/.test(s)) problems.push(`${where}.${lang}: hapësira të tepërta`)
    if (sentence && /^\p{Ll}/u.test(s)) problems.push(`${where}.${lang}: nis me shkronjë të vogël`)
    if (sentence && /\b\p{Lu}{4,}\b/u.test(s.replace(ACRONYMS, ''))) problems.push(`${where}.${lang}: jo sentence case`)
  }
  if (/\d\.\d/.test(value.sq)) problems.push(`${where}.sq: presja dhjetore`)
  return problems
}

function factProblems(fact: Fact): string[] {
  const at = fact.id
  const problems = [...textProblems(`${at}.text`, fact.text, 280), ...textProblems(`${at}.quiz.question`, fact.quiz.question, 160)]
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fact.id)) problems.push(`${at}: id jo kebab-case`)
  if (fact.more !== null) problems.push(...textProblems(`${at}.more`, fact.more, 560))
  if (fact.topic.kind === 'recovery' && !THEMES.includes(fact.topic.theme)) problems.push(`${at}: tema ${fact.topic.theme}`)
  const { source, quiz } = fact
  if (!source.label || !source.title) problems.push(`${at}: burimi pa etiketë ose titull`)
  if (!/^https:\/\//.test(source.url) || /wikipedia\.org/.test(source.url)) problems.push(`${at}: lidhja e burimit`)
  if (!Number.isInteger(source.year) || source.year < 1850 || source.year > 2026) problems.push(`${at}: viti i burimit`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source.checked)) problems.push(`${at}: data e kontrollit`)
  if (quiz.options.length < 3 || quiz.options.length > 4) problems.push(`${at}: 3–4 përgjigje`)
  quiz.options.forEach((option, index) => problems.push(...textProblems(`${at}.quiz.options[${index}]`, option, 70, false)))
  if (new Set(quiz.options.map((option) => option.sq)).size !== quiz.options.length) problems.push(`${at}: përgjigje të njëjta`)
  if (!Number.isInteger(quiz.correct) || quiz.correct < 0 || quiz.correct >= quiz.options.length) problems.push(`${at}: përgjigjja e saktë`)
  return problems
}

describe('paketa e fakteve', () => {
  it('ka 100 fakte në 10 grupe, me id unike', () => {
    expect(FACTS).toHaveLength(100)
    expect(FACT_GROUPS).toEqual(['sts-chest', 'sts-triceps', 'sts-back', 'sts-biceps', 'sts-shoulders', 'sts-legs', 'sts-hinge', 'sts-abs', 'foods', 'recovery'])
    expect(new Set(FACTS.map((fact) => fact.id)).size).toBe(FACTS.length)
  })

  it('çdo fakt ka formën e kontrollit: tekstet, burimi, pyetja e kuizit', () => {
    expect(FACTS.flatMap(factProblems)).toEqual([])
  })

  it('emrat e ushtrimeve janë të Shortcut to Size', () => {
    const names = new Set(SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.name))
    const unknown = FACTS.flatMap((fact) => (fact.topic.kind === 'exercise' && !names.has(fact.topic.exercise) ? [`${fact.id}: ${fact.topic.exercise}`] : []))
    expect(unknown).toEqual([])
  })

  it('çelësat e ushqimeve janë të shabllonit të Jimit', () => {
    const unknown = FACTS.flatMap((fact) => (fact.topic.kind === 'food' && !Object.hasOwn(JIM_FOODS, fact.topic.food) ? [`${fact.id}: ${fact.topic.food}`] : []))
    expect(unknown).toEqual([])
  })

  it('kërkimi sipas ushtrimit, ushqimit, id-së dhe rikuperimi', () => {
    expect(exerciseFacts('bench press').map((fact) => fact.id)).toEqual(exerciseFacts('Bench Press').map((fact) => fact.id))
    expect(exerciseFacts('Bench Press').length).toBeGreaterThan(0)
    expect(exerciseFacts('Incline Cable Flye')).toEqual([])
    expect(foodFacts('oatmeal').map((fact) => fact.id)).toEqual(['oatmeal-1'])
    expect(factById('oatmeal-1')?.topic).toEqual({ kind: 'food', food: 'oatmeal' })
    expect(factById('nuk-ekziston')).toBeUndefined()
    expect(RECOVERY_FACTS.length).toBe(20)
    expect(RECOVERY_FACTS.every((fact) => fact.topic.kind === 'recovery')).toBe(true)
  })

  it('çelësi i ushqimit të Jimit nga burimi', () => {
    expect(jimFoodKey('jim:oatmeal')).toBe('oatmeal')
    expect(jimFoodKey('pdf:rice')).toBeNull()
    expect(jimFoodKey(null)).toBeNull()
  })

  it('burimi anglisht përkthen lidhëzën, jo emrat', () => {
    expect(sourceLabel('Schoenfeld dhe kolegët, 2016', 'sq')).toBe('Schoenfeld dhe kolegët, 2016')
    expect(sourceLabel('Schoenfeld dhe kolegët, 2016', 'en')).toBe('Schoenfeld and colleagues, 2016')
    expect(sourceLabel('Ekstrom, Donatelli dhe Soderberg, 2003', 'en')).toBe('Ekstrom, Donatelli and Soderberg, 2003')
    expect(sourceLabel('ACSM, 2009', 'en')).toBe('ACSM, 2009')
    expect(FACTS.map((fact) => sourceLabel(fact.source.label, 'en')).filter((label) => /\bdhe\b|kolegët/.test(label))).toEqual([])
  })
})
