import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { VrullMark } from '@/components/ui/logo'
import { useI18n } from '@/i18n/use-i18n'

// Kreu i pesë ekraneve kryesore (bordi "Sot"): rreshti i vogël sipër (data, java), titulli
// `display-m`, një fjali poshtë; djathtas veprimet e ekranit dhe butoni "Profili dhe cilësimet",
// logo e Vrullit në 44 px, që hap Cilësimet.

export function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Veprimet e vetë ekranit, para butonit të profilit. */
  actions?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {eyebrow ? <span className="type-caption text-muted-foreground tabular-nums">{eyebrow}</span> : null}
        <h1 className="type-display-m">{title}</h1>
        {subtitle ? <p className="mt-1 type-body text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <ProfileButton />
      </div>
    </header>
  )
}

export function ProfileButton() {
  const { t } = useI18n()
  return (
    <Link
      to="/cilesimet"
      aria-label={t('shell.profile')}
      className="-mr-1 flex size-touch shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
    >
      <VrullMark size={36} />
    </Link>
  )
}
