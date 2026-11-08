import { useEffect, useId, useState } from 'react'
import { inputClass } from '@/components/ui/field-styles'
import { store } from '@/data/app-data'
import { exerciseChoices } from '@/data/exercises'
import { type LibraryExercise, searchLibrary } from '@/program/library'
import { cn } from '@/lib/cn'
import { EQUIPMENT_LABEL } from '@/routes/training-format'

// Zgjedhja e një ushtrimi nga biblioteka (seanca, editori): kërkim sipas emrit dhe lista e
// rezultateve. Biblioteka ngarkohet vetëm kur hapet zgjedhja; ushtrimet që krijoi përdoruesi
// ("Krijo ushtrim", V2-E1-09) dalin bashkë me të.

export function LibraryPicker({ onPick, busy = false }: { onPick: (exercise: LibraryExercise) => void; busy?: boolean }) {
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
      <label htmlFor={searchId} className="text-sm leading-5 font-medium">
        Kërko ushtrimin
      </label>
      <input
        id={searchId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        className={cn(inputClass, 'appearance-none')}
      />
      {library === null ? (
        <p className="text-sm leading-5 text-muted-foreground">Po ngarkohet biblioteka</p>
      ) : results.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">Asnjë ushtrim me këtë emër</p>
      ) : (
        <ul className="flex flex-col">
          {results.map((item) => (
            <li key={item.id} className="border-t border-border-subtle first:border-t-0">
              <button type="button" disabled={busy} className="flex min-h-12 w-full items-center gap-3 text-left" onClick={() => onPick(item)}>
                <span className="flex-1 text-base leading-6">{item.name}</span>
                <span className="text-xs leading-4 text-muted-foreground">{EQUIPMENT_LABEL[item.equipment]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
