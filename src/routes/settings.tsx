import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { scheduler, usePendingChanges, useSyncStatus } from '@/data/app-data'
import { shareExport } from '@/data/share-export'
import { describeSync } from '@/data/sync-status-text'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'
import { readTheme, saveTheme, THEME_LABELS, THEMES, type Theme } from '@/lib/theme'

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  function choose(next: Theme) {
    setTheme(next)
    saveTheme(next)
  }

  return (
    <>
      <PageHeader
        title="Cilësimet"
        actions={
          <Link
            to="/"
            aria-label="Kthehu te Sot"
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <Icon name="mbyll" size={22} />
          </Link>
        }
      />
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <fieldset>
          <legend className="text-lg leading-7 font-semibold tracking-[-0.01em]">Tema</legend>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            OLED përdor të zezë të plotë dhe kursen bateri në ekranet OLED.
          </p>
          <div className="mt-4 space-y-2">
            {THEMES.map((option) => (
              <label
                key={option}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-md border px-3.5 text-base',
                  theme === option
                    ? 'border-foreground bg-selected'
                    : 'border-border hover:bg-accent',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  value={option}
                  checked={theme === option}
                  onChange={() => choose(option)}
                  className="size-4 accent-current"
                />
                {THEME_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>
      </section>
      <DataSection />
      <p className="mt-6 text-xs leading-4 text-muted-foreground">Training Hub {__APP_VERSION__}</p>
    </>
  )
}

function DataSection() {
  const status = useSyncStatus()
  const pending = usePendingChanges()
  const [exporting, setExporting] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [, setTick] = useState(0)

  // Koha relative ("para 5 min") rifreskohet vetë.
  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), 30_000)
    return () => clearInterval(timer)
  }, [])

  async function exportData() {
    setExporting(true)
    setProblem(null)
    try {
      await shareExport()
    } catch {
      setProblem('Eksporti nuk u krye. Provo përsëri.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section aria-labelledby="data-title" className="mt-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 id="data-title" className="text-lg leading-7 font-semibold tracking-[-0.01em]">
        Të dhënat
      </h2>
      <p role="status" className="mt-1 text-sm leading-5 text-muted-foreground">
        {describeSync(status)}
      </p>
      {pending > 0 && (
        <p className="mt-1 text-sm leading-5 text-muted-foreground tabular-nums">
          {pending === 1 ? '1 ndryshim pret dërgimin' : `${pending} ndryshime presin dërgimin`}
        </p>
      )}
      <div className="mt-4 grid gap-2">
        <Button variant="outline" disabled={status.syncing} onClick={() => void scheduler.syncNow()}>
          Sinkronizo tani
        </Button>
        <Button variant="outline" disabled={exporting} onClick={() => void exportData()}>
          {exporting ? 'Po përgatitet' : 'Eksporto të dhënat'}
        </Button>
      </div>
      <p className="mt-3 text-xs leading-4 text-muted-foreground">
        Kopja JSON përmban çdo tabelë, pa fotot. Ruaje diku jashtë telefonit.
      </p>
      {problem && (
        <p role="alert" className="mt-2 text-sm leading-5 text-destructive">
          {problem}
        </p>
      )}
    </section>
  )
}
