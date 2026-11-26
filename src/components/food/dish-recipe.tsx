import { type ReactNode, useId } from 'react'
import type { CatalogDish } from '@/catalog/types'
import { useI18n } from '@/i18n/use-i18n'

// Receta e një pjate shqiptare te fleta e sasisë (V65, SPEC §0.3h): përbërësit siç i thotë burimi me gramët që hyjnë në llogari, çfarë është
// vlerësim, dhe burimi me lidhje. Vlerat vijnë nga Lista në telefon (`CatalogDish`); asgjë nuk pret rrjetin, vetëm lidhja e burimit e hap shfletuesin.

const link = 'inline-flex min-h-touch items-center text-ember-text underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

function Block({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex shrink-0 flex-col gap-1.5">
      <h3 id={id} className="type-label text-muted-foreground">
        {title}
      </h3>
      {hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
      {children}
    </section>
  )
}

export function DishRecipe({ dish }: { dish: CatalogDish }) {
  const { t, fmt, lang } = useI18n()
  const marks = [dish.readers ? t('foodsearch.dish.readers') : null, dish.estimate ? t('foodsearch.dish.estimate') : null].filter(Boolean)
  return (
    <div className="flex shrink-0 flex-col gap-4">
      <Block title={t('foodsearch.dish.title')}>
        <p lang={lang} className="type-body">
          {dish.note[lang]}
        </p>
        {marks.length > 0 ? <p className="type-body-strong">{marks.join(' · ')}</p> : null}
        <p className="type-caption text-muted-foreground">{t('foodsearch.dish.macros')}</p>
      </Block>

      <Block title={t('foodsearch.dish.ingredients')} hint={t('foodsearch.dish.ingredientsHint')}>
        <ul className="flex flex-col">
          {dish.ingredients.map((item, index) => (
            <li key={`${item.id}-${index}`} className="flex min-h-9 items-baseline justify-between gap-3 border-t border-border py-1.5 first:border-t-0">
              <span lang="sq" className="min-w-0 text-[15px] leading-5">
                {item.text}
              </span>
              <span className="shrink-0 text-[15px] leading-5 text-muted-foreground tabular-nums">{fmt.unit(item.grams, 'g', { maxDigits: 1 })}</span>
            </li>
          ))}
        </ul>
      </Block>

      {dish.estimates.length > 0 ? (
        <Block title={t('foodsearch.dish.estimates')} hint={t('foodsearch.dish.estimatesHint')}>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {dish.estimates.map((text) => (
              <li key={text} lang="sq" className="type-caption text-muted-foreground">
                {text}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      <Block title={t('foodsearch.dish.source')}>
        <p lang="sq" className="type-body">
          {dish.source.label}
        </p>
        {dish.source.url ? (
          <a href={dish.source.url} target="_blank" rel="noreferrer" aria-label={t('foodsearch.dish.open', { title: dish.source.title })} lang="sq" className={link}>
            {dish.source.title}
          </a>
        ) : (
          <p lang="sq" className="type-caption text-muted-foreground">
            {dish.source.title}
          </p>
        )}
      </Block>
    </div>
  )
}
