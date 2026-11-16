import type { IconName } from '@/components/ui/icons'
import type { I18n } from '@/i18n'
import { foodName } from '@/i18n/domain'
import { type Fact, inLang, sourceLabel } from '@/learn/facts'
import { JIM_FOODS, type JimFoodKey } from '@/nutrition/jim'

// Tekstet e Mëso-s nga paketa (SPEC §0.3e): tema e faktit (ushtrimi në anglisht, ushqimi i Jimit me emrin e
// katalogut, tema e rikuperimit), burimi ("Burimi: Schoenfeld dhe kolegët, 2016"), teksti në gjuhën e app-it.

type Texts = Pick<I18n, 't' | 'lang'>

/** Ushqimi i Jimit me emrin e katalogut ("Tërshërë e gatuar" / "Cooked oatmeal"). */
export function jimFoodName({ t }: Pick<I18n, 't'>, key: string): string {
  const food = JIM_FOODS[key as JimFoodKey]
  return food ? foodName(t, { name: food.name, sourceId: `jim:${key}` }) : key
}

/** Tema e faktit: "Bench Press", "Tërshërë e gatuar", "Gjumi". */
export function factTopic(i18n: Texts, fact: Fact): string {
  const { topic } = fact
  if (topic.kind === 'exercise') return topic.exercise
  if (topic.kind === 'food') return jimFoodName(i18n, topic.food)
  return i18n.t(`learn.theme.${topic.theme}` as 'learn.theme.rest')
}

/** Çipi i temës te kuizi: ushqimi me "Ushqimi · ", të tjerat si `factTopic`. */
export function quizTopic(i18n: Texts, fact: Fact): string {
  return fact.topic.kind === 'food' ? i18n.t('learn.topic.food', { food: factTopic(i18n, fact) }) : factTopic(i18n, fact)
}

/** Ikona e temës: ushtrimi, ushqimi, trupi. */
export function factIcon(fact: Fact): IconName {
  return fact.topic.kind === 'exercise' ? 'programi' : fact.topic.kind === 'food' ? 'pjata' : 'zemra'
}

/** Burimi si del te karta: etiketa (anglisht me "and colleagues"). */
export function factSource({ lang }: Pick<I18n, 'lang'>, fact: Fact): string {
  return sourceLabel(fact.source.label, lang)
}

/** Teksti, shpjegimi, pyetja dhe përgjigjet në gjuhën e app-it. */
export const factText = ({ lang }: Pick<I18n, 'lang'>, fact: Fact) => inLang(fact.text, lang)
export const factMore = ({ lang }: Pick<I18n, 'lang'>, fact: Fact) => (fact.more ? inLang(fact.more, lang) : null)
export const quizQuestion = ({ lang }: Pick<I18n, 'lang'>, fact: Fact) => inLang(fact.quiz.question, lang)
export const quizOptions = ({ lang }: Pick<I18n, 'lang'>, fact: Fact) => fact.quiz.options.map((option) => inLang(option, lang))
