import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/page'
import { buttonVariants } from '@/components/ui/button-variants'
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
      <p className="mt-6 text-xs leading-4 text-muted-foreground">Training Hub {__APP_VERSION__}</p>
    </>
  )
}
