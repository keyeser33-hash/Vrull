import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { cn } from '@/lib/cn'

/**
 * Shigjeta mbrapa e ekraneve të detajit; kthehet aty nga erdhi përdoruesi. Kur ekrani është i pari
 * në histori (p.sh. pas rifreskimit), shkon te `fallback`, që butoni të mos dalë nga app-i.
 */
export function BackButton({ label, fallback = '/', className }: { label: string; fallback?: string; className?: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      className={cn('-ml-2 rounded-pill text-foreground', className)}
      onClick={() => (location.key === 'default' ? navigate(fallback, { replace: true }) : navigate(-1))}
    >
      <Icon name="chevron-majtas" size={22} />
    </Button>
  )
}

/**
 * Kreu i çdo nën-faqeje (V2-E3-30; bordet "Kreu"): shigjeta mbrapa 44 px (e vetmja në app) dhe titulli
 * `display-m`, me një rresht poshtë (`subtitle`) kur ekrani ka një; veprimet e ekranit djathtas.
 */
export function BackHeader({
  title,
  subtitle,
  back,
  fallback,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  back: string
  fallback?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-col">
      <div className="flex min-h-14 items-center gap-1">
        <BackButton label={back} fallback={fallback} />
        <h1 className="min-w-0 flex-1 type-display-m">{title}</h1>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {subtitle ? <p className="-mt-1 pl-10 type-body text-muted-foreground tabular-nums">{subtitle}</p> : null}
    </header>
  )
}
