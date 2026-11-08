// Vaktet e planit (SPEC §9); çelësat janë ata të bazës (`meal_key`). Emrat sipas gjuhës vijnë nga
// katalogu ('food.meal.*', `mealName` te `@/i18n/domain`).

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
