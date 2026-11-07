// Vaktet e planit (SPEC §9); çelësat janë ata të bazës (`meal_key`).

export type MealKey =
  | 'breakfast_1'
  | 'breakfast_2'
  | 'snack_am'
  | 'lunch'
  | 'snack_pm'
  | 'dinner'
  | 'bedtime'
  | 'pre_workout'
  | 'intra_workout'
  | 'post_workout'

export const MEAL_LABEL: Record<MealKey, string> = {
  breakfast_1: 'Mëngjesi 1',
  breakfast_2: 'Mëngjesi 2',
  snack_am: 'Snack paradite',
  lunch: 'Dreka',
  snack_pm: 'Snack pasdite',
  dinner: 'Darka',
  bedtime: 'Para gjumit',
  pre_workout: 'Para stërvitjes',
  intra_workout: 'Gjatë stërvitjes',
  post_workout: 'Pas stërvitjes',
}

/** Emri i vaktit në një fjali: "Regjistro drekën". */
export const MEAL_OBJECT: Record<MealKey, string> = {
  breakfast_1: 'mëngjesin 1',
  breakfast_2: 'mëngjesin 2',
  snack_am: 'snack-un e paraditës',
  lunch: 'drekën',
  snack_pm: 'snack-un e pasdites',
  dinner: 'darkën',
  bedtime: 'vaktin para gjumit',
  pre_workout: 'vaktin para stërvitjes',
  intra_workout: 'vaktin gjatë stërvitjes',
  post_workout: 'vaktin pas stërvitjes',
}
