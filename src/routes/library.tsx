import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BackButton } from '@/components/layout/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { exerciseCatalog } from '@/data/exercises'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import {
  type CatalogItem,
  EQUIPMENT_FILTERS,
  type EquipmentFilter,
  filterCatalog,
  groupsOf,
  LIBRARY_AREAS,
  type LibraryArea,
} from '@/program/exercise-catalog'
import { Chip, ExerciseThumb } from './programme-parts'
import { dotted, equipmentName, musclesLine } from './programme-format'

// Biblioteka (bordi "Biblioteka", V2-E1-09): free-exercise-db (Unlicense) bashkë me ushtrimet në
// telefon, me kërkim dhe filtrat "Muskujt" dhe "Pajisja". Filtrat mbahen në adresë, që kthimi nga
// ushtrimi t'i gjejë njësoj. Lista shfaqet me radhë, 60 në një herë; fotot merren kur duken.

const PAGE = 60

export function LibraryPage() {
  const { t, fmt } = useI18n()
  const catalog = useLocalQuery(() => exerciseCatalog(store), [])
  const [params, setParams] = useSearchParams()
  const [limit, setLimit] = useState(PAGE)
  const searchId = useId()
  const query = params.get('kerko') ?? ''
  const area = LIBRARY_AREAS.find((entry) => entry.id === params.get('muskujt'))?.id ?? null
  const equipment = EQUIPMENT_FILTERS.find((entry) => entry === params.get('pajisja')) ?? null

  const update = (key: string, value: string | null) => {
    setLimit(PAGE)
    setParams(
      (current) => {
        if (value) current.set(key, value)
        else current.delete(key)
        return current
      },
      { replace: true },
    )
  }
  const items = useMemo(() => (catalog ? filterCatalog(catalog.items, { query, area, equipment }) : []), [catalog, query, area, equipment])
  const filters = [area ? t(`programme.area.${area}`) : null, equipment ? equipmentName(t, equipment) : null]
  const title = filters.some(Boolean) ? t('programme.listFiltered', { filters: dotted(filters) }) : t('programme.listAll')

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-col">
        <div className="flex items-center justify-between">
          <BackButton label={t('programme.backToProgramme')} fallback="/programi" />
          <Link
            to="/programi/biblioteka/krijo"
            aria-label={t('programme.createExercise')}
            className={buttonVariants({ variant: 'secondary', ground: 'page', size: 'icon' })}
          >
            <Icon name="plus" size={22} />
          </Link>
        </div>
        <h1 className="type-display-m">{t('programme.libraryTitle')}</h1>
        {catalog ? <p className="mt-0.5 type-caption text-muted-foreground">{t('programme.libraryIntro', { count: catalog.libraryCount })}</p> : null}
      </header>

      <div className="relative">
        <label htmlFor={searchId} className="sr-only">
          {t('programme.search')}
        </label>
        <Icon name="kerko" size={20} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          id={searchId}
          type="search"
          autoComplete="off"
          placeholder={t('programme.searchHint')}
          value={query}
          onChange={(event) => update('kerko', event.currentTarget.value || null)}
          className="h-button w-full appearance-none rounded-md border border-border bg-surface pr-3.5 pl-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        />
      </div>

      <div className="flex flex-col gap-2">
        <FilterRow label={t('programme.filterMuscles')} group={t('programme.filterMusclesGroup')} selected={area}>
          <Chip selected={area === null} aria-pressed={area === null} onClick={() => update('muskujt', null)}>
            {t('programme.allMuscles')}
          </Chip>
          {LIBRARY_AREAS.map((entry) => (
            <Chip key={entry.id} selected={area === entry.id} aria-pressed={area === entry.id} onClick={() => update('muskujt', area === entry.id ? null : entry.id)}>
              {t(`programme.area.${entry.id}` as `programme.area.${LibraryArea}`)}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label={t('programme.filterEquipment')} group={t('programme.filterEquipment')} selected={equipment}>
          <Chip selected={equipment === null} aria-pressed={equipment === null} onClick={() => update('pajisja', null)}>
            {t('programme.allEquipment')}
          </Chip>
          {EQUIPMENT_FILTERS.map((entry: EquipmentFilter) => (
            <Chip key={entry} selected={equipment === entry} aria-pressed={equipment === entry} onClick={() => update('pajisja', equipment === entry ? null : entry)}>
              {equipmentName(t, entry)}
            </Chip>
          ))}
        </FilterRow>
      </div>

      <section aria-labelledby="library-list" className="flex flex-col">
        <div className="flex min-h-touch items-center justify-between gap-2">
          <h2 id="library-list" className="type-label text-muted-foreground">
            {title}
          </h2>
          {area || equipment || query ? (
            <button
              type="button"
              onClick={() => setParams({}, { replace: true })}
              className="h-touch px-1 text-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {t('programme.clearFilters')}
            </button>
          ) : null}
        </div>
        {catalog === undefined ? null : items.length === 0 ? (
          <p className="py-3 type-body text-muted-foreground">{t('programme.noResults')}</p>
        ) : (
          <>
            <ul className="flex flex-col">
              {items.slice(0, limit).map((item) => (
                <LibraryRow key={item.key} item={item} />
              ))}
            </ul>
            {items.length > limit ? (
              <button
                type="button"
                onClick={() => setLimit((current) => current + PAGE)}
                className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 h-12 w-full rounded-md')}
              >
                {t('programme.showMore', { count: fmt.number(Math.min(PAGE, items.length - limit)) })}
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}

/** Një rresht filtrash: etiketa majtas dhe çipat që lëvizin anash, brenda kufirit të faqes. */
function FilterRow({ label, group, selected, children }: { label: string; group: string; selected: string | null; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null)
  // Filtri i zgjedhur (edhe kur vjen nga adresa) duket pa lëvizur rreshtin me dorë.
  useEffect(() => {
    const scroller = row.current
    const chip = scroller?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!scroller || !chip) return
    if (chip.offsetLeft + chip.offsetWidth > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = chip.offsetLeft - 16
  }, [selected])
  return (
    <div className="flex items-center gap-1.5">
      <span aria-hidden className="w-[62px] shrink-0 text-[13px] leading-4 text-muted-foreground">
        {label}
      </span>
      <div ref={row} role="group" aria-label={group} className="-mr-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none]">
        {children}
      </div>
    </div>
  )
}

function LibraryRow({ item }: { item: CatalogItem }) {
  const { t } = useI18n()
  const detail = musclesLine(t, groupsOf(item.primary), groupsOf(item.secondary))
  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        to={`/ushtrimi/${encodeURIComponent(item.key)}`}
        className="flex min-h-16 items-center gap-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        <ExerciseThumb libraryId={item.libraryId} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="type-body-strong">{item.name}</span>
          {detail ? <span className="truncate type-caption text-muted-foreground">{detail}</span> : null}
        </span>
        {item.own ? <span className="shrink-0 rounded-pill bg-surface-2 px-2.5 py-1 text-[13px] font-semibold">{t('programme.own')}</span> : null}
      </Link>
    </li>
  )
}
