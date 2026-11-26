import { type ReactNode, useId } from 'react'
import { catalogMeta } from '@/catalog/files'
import { FOOD_SOURCES, type FoodSourceInfo, sourceFacts } from '@/catalog/sources'
import { Sheet } from '@/components/layout/sheet'
import { useI18n } from '@/i18n/use-i18n'

// Burimet dhe licencat (SPEC §0.3h, §11, §9; Cilësimet › "Burimet dhe licencat"): atribuimi që kërkon secila licencë, me lidhjet te burimi
// dhe te licenca, versioni i Listës së Vrullit dhe sa ushqime vijnë nga secili burim. Teksti i atribuimit mbetet siç e kërkon licenca.

// Të dhënat dhe asetet e tjera (jo ushqime).
const OTHER = [
  { id: 'program', name: 'Shortcut to Size' },
  { id: 'anatomy', name: 'BodyParts3D' },
  { id: 'exercises', name: 'free-exercise-db' },
  { id: 'fonts', name: 'Barlow, Barlow Condensed' },
] as const

const link = 'inline-flex min-h-touch items-center text-ember-text underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-1">
      <h3 id={id} className="type-label text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function FoodSource({ source }: { source: FoodSourceInfo }) {
  const { t } = useI18n()
  const facts = sourceFacts(catalogMeta, source)
  const id = source.id
  return (
    <li className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0">
      <span className="type-body-strong">{source.name ?? t('sources.dishes.name')}</span>
      <span className="type-body">{t(`sources.${source.id}.use`)}</span>
      {source.datasets.length > 0 ? (
        <span className="type-caption text-muted-foreground tabular-nums">
          {[t('sources.food.rows', { count: facts.rows }), ...facts.versions.map((version) => t('sources.food.version', { version }))].join(' · ')}
        </span>
      ) : null}
      <span className="type-caption text-muted-foreground">{t(`sources.${source.id}.license`)}</span>
      {id !== 'dishes' ? (
        <span lang="en" className="type-caption text-muted-foreground">
          {t(`sources.${id}.attribution`)}
        </span>
      ) : null}
      {source.url && source.licenseUrl ? (
        <span className="flex flex-wrap gap-x-4">
          <a href={source.url} target="_blank" rel="noreferrer" className={link}>
            {t('sources.food.source')}
          </a>
          <a href={source.licenseUrl} target="_blank" rel="noreferrer" className={link}>
            {t('sources.food.license')}
          </a>
        </span>
      ) : null}
    </li>
  )
}

export function SourcesSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
    <Sheet title={t('settings.sources')} onClose={onClose}>
      <Section title={t('sources.food.title')}>
        <p className="type-caption text-muted-foreground tabular-nums">{t('sources.food.summary', { version: String(catalogMeta.version), count: catalogMeta.total })}</p>
        <p className="type-caption text-muted-foreground">{t('sources.food.names')}</p>
        <ul className="flex flex-col">
          {FOOD_SOURCES.map((source) => (
            <FoodSource key={source.id} source={source} />
          ))}
        </ul>
      </Section>
      <Section title={t('sources.other.title')}>
        <ul className="flex flex-col">
          {OTHER.map((source) => (
            <li key={source.id} className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0">
              <span className="type-body-strong">{source.name}</span>
              <span className="type-body">{t(`sources.${source.id}.use`)}</span>
              <span className="type-caption text-muted-foreground">{t(`sources.${source.id}.license`)}</span>
            </li>
          ))}
        </ul>
      </Section>
    </Sheet>
  )
}
