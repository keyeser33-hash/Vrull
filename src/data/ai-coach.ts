import { nutritionDay } from './nutrition'
import { pastSession } from './history'
import { readProfile } from './profile'
import type { LocalStore } from './store'
import { todayView } from './today'
import { waterDay } from './water'
import type { I18n } from '@/i18n'
import { foodName, mealName, programDayName } from '@/i18n/domain'

// Faktet e trajnerit (V41, V2-E2-15; bordi V22-Trajneri): një tekst i shkurtër me të dhënat e ditës që shkon
// me mesazhin (jashtë cache-it, sepse ndryshon pas çdo regjistrimi). AI-ja përgjigjet vetëm nga këto:
// objektivat dhe ushqimi i sotëm, vaktet e planit që mbeten, uji, stërvitja e radhës dhe dy të fundit.

const round = (value: number) => Math.round(value)

export async function coachFacts(store: LocalStore, now: Date, { t, fmt }: I18n): Promise<string> {
  const view = await todayView(store)
  const [day, water] = await Promise.all([nutritionDay(store, view.date, now), waterDay(store, view.date)])
  const lines: string[] = []

  const totals = day.totals
  if (day.targets) {
    const left = (eaten: number, target: number) => round(Math.max(0, target - eaten))
    lines.push(
      `Food day ${view.date} (${day.dayType === 'training' ? 'training day' : 'rest day'}). Eaten: ${round(totals.kcal)} kcal, protein ${round(totals.proteinG)} g, carbs ${round(totals.carbsG)} g, fat ${round(totals.fatG)} g.`,
      `Targets: ${round(day.targets.kcal)} kcal, protein ${round(day.targets.proteinG)} g, carbs ${round(day.targets.carbsG)} g, fat ${round(day.targets.fatG)} g. Left: ${left(totals.kcal, day.targets.kcal)} kcal, protein ${left(totals.proteinG, day.targets.proteinG)} g.`,
    )
  } else lines.push(`Food day ${view.date}. Eaten: ${round(totals.kcal)} kcal, protein ${round(totals.proteinG)} g. No targets set.`)

  const ahead = day.meals.filter((slot) => slot.status === 'next' || slot.status === 'todo')
  for (const slot of ahead.slice(0, 5)) {
    const items = slot.template.map(
      (line) => `${foodName(t, { name: line.name, sourceId: line.sourceId })} ${round(line.grams)} g (${round(line.proteinG)} g protein, ${round(line.kcal)} kcal)`,
    )
    lines.push(`Plan, ${mealName(t, slot.meal)} ${slot.time}: ${items.join('; ') || 'no items'}.`)
  }
  if (water.targetMl) lines.push(`Water: ${fmt.number(water.totalMl / 1000, { maxDigits: 2 })} of ${fmt.number(water.targetMl / 1000, { maxDigits: 2 })} L.`)

  const snapshot = view.snapshot
  if (snapshot && !snapshot.completed) {
    const plan = snapshot.plan
    const { trainingTime } = await readProfile(store)
    const when = view.mode === 'session' ? 'in progress now' : view.mode === 'train' ? `today ${trainingTime}` : `${view.nextDate ?? 'next'} ${trainingTime}`
    const exercises = plan.slots.map((slot) => `${snapshot.exercises[slot.exerciseId]?.name ?? '?'} ${slot.sets} sets`)
    lines.push(
      `Next workout (${when}): ${t('history.workout', { n: plan.dayNumber })} · ${programDayName(t, plan.dayName)}, ${snapshot.label}. ${exercises.length} exercises: ${exercises.join('; ')}.`,
    )
  }

  const done = (await store.all('workout_sessions'))
    .filter((session) => session.status === 'completed')
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 2)
  for (const session of done) {
    const past = await pastSession(store, session.id)
    if (!past) continue
    const best = past.exercises.map((exercise) => {
      const top = [...exercise.sets].filter((set) => set.weightKg && set.reps).sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0]
      return top ? `${exercise.name} ${fmt.number(top.weightKg!)} kg × ${top.reps}` : exercise.name
    })
    lines.push(`Done ${past.date}: ${past.dayNumber ? t('history.workout', { n: past.dayNumber }) : 'workout'}. ${best.join('; ')}.`)
  }
  return lines.join('\n')
}
