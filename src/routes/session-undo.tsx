import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { surfaceClass } from '@/components/ui/surface'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { SESSION_TIMING } from './session-local'

// "Zhbëj" pas çdo "Ruaj setin" (SPEC §0.3g, V58; bordi "Pushimi · Zhbëj"): "Seti 2 u ruajt · 62,5 × 7 ·
// Zhbëj" rri 6 s mbi veprimin kryesor, me një vijë që shkurtohet; pastaj ikën. Lexuesi i ekranit e dëgjon
// kur del (rajon `aria-live`, jo `status`, që banderola e rekordit mbetet e vetmja). Me lëvizje të
// reduktuar vija rri e plotë.

export function UndoToast({ text, setNumber, onUndo, onExpire }: { text: string; setNumber: number; onUndo: () => void; onExpire: () => void }) {
  const { t } = useI18n()
  const [draining, setDraining] = useState(false)
  const expire = useRef(onExpire)
  useEffect(() => {
    expire.current = onExpire
  })
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDraining(true))
    const id = window.setTimeout(() => expire.current(), SESSION_TIMING.undoMs)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(id)
    }
  }, [])
  return (
    <div aria-live="polite" className={cn(surfaceClass, 'relative flex min-h-touch items-center justify-between gap-2 overflow-hidden rounded-lg py-1 pr-1 pl-3')}>
      <span className="min-w-0 text-sm leading-[1.35] font-semibold tabular-nums">{text}</span>
      <Button variant="ghost" aria-label={t('session.undo.label', { set: setNumber })} onClick={onUndo} className="shrink-0 px-3 text-ember-text">
        {t('session.undo.action')}
      </Button>
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-0.5 bg-ember-text transition-[width] ease-linear"
        style={{ width: draining ? '0%' : '100%', transitionDuration: `${SESSION_TIMING.undoMs}ms` }}
      />
    </div>
  )
}
