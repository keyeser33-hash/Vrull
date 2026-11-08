import { useEffect, useId, useState } from 'react'
import { store } from '@/data/app-data'
import { exerciseChoices } from '@/data/exercises'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { type LibraryExercise, searchLibrary } from '@/program/library'

// Zgjedhja e një ushtrimi nga biblioteka (seanca, ndërtuesi): kërkim sipas emrit dhe lista e
// rezultateve, në Vrull (V2-E1-10). Biblioteka ngarkohet vetëm kur hapet zgjedhja; ushtrimet që krijoi
// përdoruesi ("Krijo ushtrim", V2-E1-09) dalin bashkë me të. Emrat e ushtrimeve mbeten në anglisht.

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

export function LibraryPicker({ onPick, busy = false }: { onPick: (exercise: LibraryExercise) => void; busy?: boolean }) {
  const { t } = useI18n()
  const [library, setLibrary] = useState<LibraryExercise[] | null>(null)
  const [query, setQuery] = useState('')
  const searchId = useId()
  useEffect(() => {
    let cancelled = false
    void exerciseChoices(store).then((items) => {
      if (!cancelled) setLibrary(items)
    })
    return () => {
      cancelled = true
    }
  }, [])
  const results = library ? searchLibrary(library, query).slice(0, 40) : []
  return (
    <>
      <label htmlFor={searchId} className="shrink-0 type-label text-muted-foreground">
        {t('builder.library.search')}
      </label>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className={cn('h-button w-full shrink-0 appearance-none rounded-md border border-border bg-surface-2 px-3.5 text-base text-foreground', focusRing)}
      />
      {library === null ? (
        <p role="status" className="type-body text-muted-foreground">
          {t('builder.library.loading')}
        </p>
      ) : results.length === 0 ? (
        <p className="type-body text-muted-foreground">{t('builder.library.none')}</p>
      ) : (
        <ul className="flex flex-col">
          {results.map((item) => (
            <li key={item.id} className="border-t border-border first:border-t-0">
              <button type="button" disabled={busy} className={cn('flex min-h-12 w-full items-center gap-3 text-left disabled:opacity-50', focusRing)} onClick={() => onPick(item)}>
                <span lang="en" className="flex-1 type-body-strong">
                  {item.name}
                </span>
                <span className="type-caption text-muted-foreground">{t(`programme.equipment.${item.equipment}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
