import { useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { saveExternalFood } from '@/data/foods'
import { findProduct, saveProductFood, shareProduct } from '@/data/products'
import type { MessageKey } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { canScanBarcode, scanBarcode } from '@/lib/barcode-native'
import { cn } from '@/lib/cn'
import { offProduct } from '@/nutrition/off'

// Barkodi (SPEC §9): skaneri i Google Play Services në telefon, ose shifrat me dorë. Barkodi kërkohet së pari te produktet e grupit (V59, pa
// internet), pastaj te Open Food Facts (vetëm me barkod), dhe produkti i gjetur ndahet me grupin. Produkti i gjetur ruhet dhe hapet te
// fleta e sasisë; ai që mungon shtohet si ushqim i ri.

type BarcodeState = 'idle' | 'busy' | 'missing' | 'offline' | 'error' | 'installing' | 'scan-error'

const BARCODE_MESSAGE: Record<BarcodeState, MessageKey | null> = {
  idle: null,
  busy: null,
  missing: 'food.barcode.missing',
  offline: 'food.barcode.offline',
  error: 'food.barcode.error',
  installing: 'food.barcode.installing',
  'scan-error': 'food.barcode.scanError',
}

export function BarcodeSheet({ onClose, onFound, onMissing }: { onClose: () => void; onFound: (id: string) => void; onMissing: () => void }) {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  const [state, setState] = useState<BarcodeState>('idle')
  const codeId = useId()
  async function scan() {
    setState('busy')
    const result = await scanBarcode()
    if (result.state === 'found') {
      setCode(result.code)
      return lookUp(result.code)
    }
    setState(result.state === 'cancelled' ? 'idle' : result.state === 'installing' ? 'installing' : 'scan-error')
  }
  async function lookUp(scanned?: string) {
    const value = (scanned ?? code).replace(/\D/g, '')
    if (value.length < 8) return setState('error')
    setState('busy')
    try {
      // Së pari te produktet e grupit (në telefon, pa internet); Open Food Facts vetëm kur grupi nuk e ka barkodin (V59).
      const shared = await findProduct(store, value)
      if (shared) return onFound(await saveProductFood(store, shared))
      if (!navigator.onLine) return setState('offline')
      const food = await offProduct(value)
      if (!food) return setState('missing')
      const id = await saveExternalFood(store, food)
      // Produkti i skanuar ndahet me grupin; një dështim këtu nuk e prish gjetjen.
      await shareProduct(store, food).catch(() => null)
      onFound(id)
    } catch {
      setState(navigator.onLine ? 'error' : 'offline')
    }
  }
  const message = BARCODE_MESSAGE[state]
  return (
    <Sheet title={t('food.barcode')} onClose={onClose}>
      {canScanBarcode() ? (
        <Button variant="outline" size="xl" disabled={state === 'busy'} onClick={() => void scan()}>
          <Icon name="barkodi" size={22} />
          {t('food.scan')}
        </Button>
      ) : null}
      <label htmlFor={codeId} className="text-sm leading-5 font-medium">
        {canScanBarcode() ? t('food.digitsOr') : t('food.digits')}
      </label>
      <input
        id={codeId}
        inputMode="numeric"
        autoComplete="off"
        value={code}
        aria-invalid={state === 'error' ? true : undefined}
        onChange={(event) => (setCode(event.currentTarget.value), setState('idle'))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void lookUp()
        }}
        className={inputClass}
      />
      {message ? (
        <p role="alert" className={cn('type-caption', state === 'error' || state === 'scan-error' ? 'text-danger' : 'text-muted-foreground')}>
          {t(message)}
        </p>
      ) : null}
      {state === 'missing' ? (
        <Button variant="outline" onClick={onMissing}>
          {t('food.addAsNew')}
        </Button>
      ) : null}
      <Button variant="primary" size="lg" disabled={state === 'busy'} onClick={() => void lookUp()}>
        {state === 'busy' ? t('food.searching') : t('food.find')}
      </Button>
    </Sheet>
  )
}
