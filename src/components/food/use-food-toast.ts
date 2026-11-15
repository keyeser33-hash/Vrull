import { useCallback, useEffect, useRef, useState } from 'react'

// Njoftimi i qetë pas një veprimi të shpejtë: 6 sekonda, një njoftim në çdo çast (`FoodToastBar`).

export const UNDO_MS = 6000

export interface FoodToast {
  id: number
  text: string
  undo: () => Promise<unknown> | void
}

export function useFoodToast() {
  const [toast, setToast] = useState<FoodToast | null>(null)
  const counter = useRef(0)
  const show = useCallback((text: string, undo: FoodToast['undo']) => setToast({ id: ++counter.current, text, undo }), [])
  const clear = useCallback(() => setToast(null), [])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), UNDO_MS)
    return () => clearTimeout(timer)
  }, [toast])
  return { toast, show, clear }
}
