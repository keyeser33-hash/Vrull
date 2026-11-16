import { useEffect } from 'react'
import { store, useLocalQuery } from '@/data/app-data'
import { type DayFact, foodFact, markFactSeen } from '@/data/learn'

// Hook-et e kartave "A e dije?" (§0.3e): fakti shënohet i parë kur karta del për herë të parë sot; pas ushqimit
// fakti i ditës lexohet vetëm në ditën e ushqimit të sotme.

/** Shënon faktin e parë kur karta del për herë të parë sot (një rresht te `learn_events`). */
export function useMarkSeen(entry: DayFact | null | undefined) {
  const id = entry && !entry.seen ? `${entry.place}|${entry.date}|${entry.fact.id}` : null
  useEffect(() => {
    if (!id) return
    const [place, date, factId] = id.split('|')
    void markFactSeen(store, place as DayFact['place'], date, factId)
  }, [id])
}

/** Pas regjistrimit të një ushqimi: fakti i ushqimit të regjistruar sot; `date` është dita e ushqimit e sotme. */
export function useFoodFact(date: string, today: boolean) {
  const entry = useLocalQuery(async () => (today ? foodFact(store, date) : null), [date, today])
  useMarkSeen(entry)
  return entry && !entry.dismissed ? entry : null
}
