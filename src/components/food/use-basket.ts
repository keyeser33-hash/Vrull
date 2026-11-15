import { useCallback, useMemo, useRef, useState } from 'react'
import { addItem, type BasketItem, loadBasket, portionOf, removeItem, saveBasket, setAmount, stepItem } from '@/data/basket'

// Shporta te ekrani i kërkimit (V59): gjendja e React-it mbi `data/basket.ts`, e ruajtur në telefon pas çdo ndryshimi
// (sinkron, jo në efekt, që një navigim menjëherë pas zbrazjes të mos e lërë shportën e vjetër).

export interface BasketApi {
  items: BasketItem[]
  add: (item: BasketItem) => void
  /** Një porcion më shumë ose më pak të ushqimit që përputhet; `unit` është sasia e një porcioni të rreshtit. */
  step: (match: (item: BasketItem) => boolean, unit: number, direction: 1 | -1) => void
  setAmount: (foodId: string, amount: { grams: number } | { servings: number }) => void
  remove: (foodId: string) => void
  clear: () => void
}

export function useBasket(): BasketApi {
  const [items, setItems] = useState<BasketItem[]>(() => loadBasket())
  const current = useRef(items)
  const update = useCallback((change: (items: BasketItem[]) => BasketItem[]) => {
    const next = change(current.current)
    current.current = next
    saveBasket(next)
    setItems(next)
  }, [])
  return useMemo(
    () => ({
      items,
      add: (item) => update((list) => addItem(list, item)),
      step: (match, unit, direction) =>
        update((list) => {
          const found = list.find(match)
          return found ? stepItem(list, portionOf(found, unit), direction) : list
        }),
      setAmount: (foodId, amount) => update((list) => setAmount(list, foodId, amount)),
      remove: (foodId) => update((list) => removeItem(list, foodId)),
      clear: () => update(() => []),
    }),
    [items, update],
  )
}
