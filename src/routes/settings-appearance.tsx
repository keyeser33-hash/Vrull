import { type ReactNode, useId, useState } from 'react'
import { Group, SwitchRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import { chooseBackground } from '@/data/background'
import { followDayState, setFollowDayState } from '@/data/daily-state'
import { chooseLanguage } from '@/data/language'
import { LANGUAGE_NAMES, LANGUAGES, LOCALES } from '@/i18n/language'
import { useI18n } from '@/i18n/use-i18n'
import { BACKGROUNDS, useBackground } from '@/lib/background'
import { cn } from '@/lib/cn'
import { readTheme, saveTheme, THEMES, type Theme } from '@/lib/theme'

// Pamja (bordi "Pamja", V2-E1-05): tema OLED, Natë, Ditë me një parapamje në vetë temën; sfondi
// "I plotë" ose "Vija shpejtësie"; "Pamja ndjek gjendjen" (V2-E3-07, vetëm në telefon) me mostrën e dy
// butonave; gjuha. Çdo zgjedhje vlen menjëherë: fikja e çelësit e kthen pamjen e ditës te normalja.

export function AppearancePage() {
  const { t, lang } = useI18n()
  const [theme, setTheme] = useState<Theme>(readTheme)
  const background = useBackground()
  const themeTitle = useId()
  const backgroundTitle = useId()
  const languageTitle = useId()
  const follow = useLocalQuery(() => followDayState(store), []) ?? true

  return (
    <div className="flex flex-col gap-[18px]">
      <BackHeader title={t('settings.appearance')} back={t('settings.backToSettings')} fallback="/cilesimet" />

      <section aria-labelledby={themeTitle} className="flex flex-col gap-2.5">
        <h2 id={themeTitle} className="type-label text-muted-foreground">
          {t('settings.theme')}
        </h2>
        <div role="radiogroup" aria-labelledby={themeTitle} className="grid grid-cols-3 gap-2">
          {THEMES.map((option) => (
            <Option
              key={option}
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => {
                setTheme(option)
                saveTheme(option)
              }}
              label={t(`settings.theme.${option}`)}
              labelClassName="font-display text-lg leading-[1.2] font-bold uppercase"
              preview={<ThemePreview theme={option} />}
            />
          ))}
        </div>
        <p className="type-caption text-muted-foreground">{t('appearance.themeHint')}</p>
      </section>

      <section aria-labelledby={backgroundTitle} className="flex flex-col gap-2.5">
        <h2 id={backgroundTitle} className="type-label text-muted-foreground">
          {t('settings.background')}
        </h2>
        <div role="radiogroup" aria-labelledby={backgroundTitle} className="grid grid-cols-2 gap-2">
          {BACKGROUNDS.map((option) => (
            <Option
              key={option}
              name="background"
              value={option}
              checked={background === option}
              onChange={() => void chooseBackground(store, option)}
              label={t(`settings.background.${option}`)}
              labelClassName="type-caption font-semibold"
              preview={<span className={cn('block h-[46px] rounded-[10px] bg-background', option === 'speed_lines' && 'bg-speed-lines')} />}
            />
          ))}
        </div>
        <p className="type-caption text-muted-foreground">{t('appearance.backgroundHint')}</p>
      </section>

      <Group>
        <SwitchRow label={t('daymode.follow')} detail={t('daymode.followDetail')} checked={follow} onChange={(on) => void setFollowDayState(store, on)} />
        <div role="img" aria-label={t('daymode.sampleLabel')} className="flex flex-col gap-1.5 px-4 pt-2 pb-3.5">
          <div aria-hidden className="grid grid-cols-2 gap-2">
            {/* Mostra është e fiksuar: prushi i vërtetë (edhe në ditë të lodhur) dhe rëra. */}
            <span data-day-keep className="flex h-touch items-center justify-center rounded-md bg-ember px-2 font-display text-[17px] font-extrabold tracking-[0.02em] whitespace-nowrap text-on-ember uppercase">
              {t('daymode.sampleUsual')}
            </span>
            <span className="flex h-touch items-center justify-center rounded-md bg-sand px-2 font-display text-[17px] font-extrabold tracking-[0.02em] whitespace-nowrap text-on-ember uppercase">
              {t('daymode.sampleTired')}
            </span>
          </div>
          <span aria-hidden className="type-caption text-muted-foreground">
            {t('daymode.sampleNote')}
          </span>
        </div>
      </Group>

      <section aria-labelledby={languageTitle} className="flex flex-col gap-2.5">
        <h2 id={languageTitle} className="type-label text-muted-foreground">
          {t('settings.language')}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((option) => {
            const pressed = lang === option
            return (
              <button
                key={option}
                type="button"
                lang={LOCALES[option]}
                aria-pressed={pressed}
                onClick={() => void chooseLanguage(store, option)}
                className={cn(
                  'flex h-button items-center justify-center gap-2 rounded-md border font-display text-xl font-bold uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                  pressed ? 'border-foreground bg-foreground text-background' : 'border-subtle bg-surface text-foreground',
                )}
              >
                {pressed ? <Icon name="zgjedhur" size={18} /> : null}
                {LANGUAGE_NAMES[option]}
              </button>
            )
          })}
        </div>
        <p className="type-caption text-muted-foreground">{t('settings.languageHint')}</p>
      </section>
    </div>
  )
}

/**
 * Një zgjedhje me parapamje (tema, sfondi): radio e vërtetë (shigjetat e tastierës, lexuesi i
 * ekranit), kornizë 2 px `foreground` kur është e zgjedhur, 1 px `subtle` kur jo, dhe shenja pranë emrit.
 */
function Option({
  name,
  value,
  checked,
  onChange,
  label,
  labelClassName,
  preview,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  label: string
  labelClassName: string
  preview: ReactNode
}) {
  return (
    <label className={cn('flex min-w-0 cursor-pointer flex-col gap-2', checked ? 'text-foreground' : 'text-muted-foreground')}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} aria-label={label} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'block rounded-md peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground',
          checked ? 'border-2 border-foreground' : 'border border-subtle p-px',
        )}
      >
        {preview}
      </span>
      <span aria-hidden className={cn('flex min-h-[22px] items-center gap-1.5', labelClassName)}>
        {checked ? <Icon name="zgjedhur" size={16} /> : null}
        {label}
      </span>
    </label>
  )
}

/** Parapamja e një teme me tokenat e asaj teme (`data-theme`): tekst, kartë dhe veprimi kryesor. */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span data-theme={theme} data-day-keep className="flex h-[92px] flex-col justify-end gap-1.5 rounded-[10px] bg-background p-2.5">
      <span className="block h-1.5 w-11 max-w-full rounded-[3px] bg-foreground" />
      <span className="block h-1 w-[30px] rounded-[2px] bg-muted-foreground" />
      <span className="block h-6 rounded-[6px] border border-surface-border bg-surface" />
      <span className="block h-3 rounded-[4px] bg-ember" />
    </span>
  )
}
