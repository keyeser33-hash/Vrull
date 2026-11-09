import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { store, useLocalQuery } from '@/data/app-data'
import { dayModeNow } from '@/data/day-mode'
import { setDayAttribute } from '@/lib/day-mode'

// Rrënja e rrugëve të app-it (V50): pamja e ditës vlen për gjithë app-in, ndaj `data-day` vendoset këtu, mbi kornizën
// dhe mbi ekranet e plota (`/seanca`, `/seanca/mbyllja`, `/kutia`), jo te korniza. Rifreskohet kur ndryshon
// `daily_states`, `daily_choices` ose çelësi; pastrohet vetëm kur rrënja del (dalja nga llogaria).
export function DayModeRoot() {
  const mode = useLocalQuery(() => dayModeNow(store), [])
  useEffect(() => setDayAttribute(mode ?? 'normal'), [mode])
  useEffect(() => () => setDayAttribute('normal'), [])
  return <Outlet />
}
