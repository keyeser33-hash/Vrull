import type { Messages, TranslationOf } from '../translate'

// Termat e domenit që i përdorin shumë ekrane (Sot, seanca, programi, trupi, historiku, hyrja):
// grupet e muskujve, emrat e Shortcut to Size që ruhen shqip në bazë, tema e ditës, pajisjet dhe
// vend-mbajtësi i fotos së ushtrimit. Funksionet: `src/i18n/domain.ts`.
// Çelësat: 'muscle.*', 'plan.*', 'equipment.*', 'exercise.*'.

export const sq = {
  // Grupet e muskujve (src/program/muscles.ts), sipas id-së.
  'muscle.gjoksi': 'Gjoksi',
  'muscle.shpatullat': 'Shpatullat',
  'muscle.trapezi': 'Trapezi',
  'muscle.shpina': 'Shpina',
  'muscle.mesi': 'Mesi i poshtëm',
  'muscle.bicepsi': 'Bicepsi',
  'muscle.tricepsi': 'Tricepsi',
  'muscle.parakrahet': 'Parakrahët',
  'muscle.barku': 'Barku',
  'muscle.vithet': 'Vithet',
  'muscle.kuadricepsi': 'Kuadricepsi',
  'muscle.kofshet-e-pasme': 'Kofshët e pasme',
  'muscle.aduktoret': 'Aduktorët',
  'muscle.pulpat': 'Pulpat',
  'muscle.qafa': 'Qafa',
  // Blloqet, javët dhe xhirot e programit.
  'plan.week': 'Java {week}',
  'plan.phase': 'Faza {n}',
  'plan.run': 'Xhiro {run}',
  'plan.none': 'Pa program',
  // Ditët e Shortcut to Size, me radhën e programit (emrat ruhen shqip në bazë).
  'plan.stsDay.1': 'Gjoks, triceps, pulpa',
  'plan.stsDay.2': 'Shpinë, biceps, bark',
  'plan.stsDay.3': 'Shpatulla, trapez, pulpa',
  'plan.stsDay.4': 'Këmbë, bark',
  // Tema e ditës ("Dita e gjoksit"), nga muskuli kryesor i ushtrimit të parë (`dayTheme`): Sot dhe historiku.
  'plan.theme.chest': 'Dita e gjoksit',
  'plan.theme.back': 'Dita e shpinës',
  'plan.theme.shoulders': 'Dita e shpatullave',
  'plan.theme.arms': 'Dita e krahëve',
  'plan.theme.legs': 'Dita e këmbëve',
  'plan.theme.abs': 'Dita e barkut',
  // Pajisjet (`Equipment`): programi, biblioteka, ushtrimi dhe trupi 3D.
  'equipment.barbell': 'Shufër',
  'equipment.ez_bar': 'Shufër EZ',
  'equipment.dumbbell': 'Dumbbell',
  'equipment.cable': 'Kabëll',
  'equipment.machine': 'Makineri',
  'equipment.bodyweight': 'Pesha e trupit',
  'equipment.kettlebell': 'Kettlebell',
  'equipment.band': 'Llastik',
  'equipment.other': 'Tjetër',
  // Vend-mbajtësi i fotos së ushtrimit (`ExercisePhoto`, faqja e ushtrimit).
  'exercise.noPhoto': 'Pa foto',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  // Muscle groups (src/program/muscles.ts), by id.
  'muscle.gjoksi': 'Chest',
  'muscle.shpatullat': 'Shoulders',
  'muscle.trapezi': 'Traps',
  'muscle.shpina': 'Back',
  'muscle.mesi': 'Lower back',
  'muscle.bicepsi': 'Biceps',
  'muscle.tricepsi': 'Triceps',
  'muscle.parakrahet': 'Forearms',
  'muscle.barku': 'Abs',
  'muscle.vithet': 'Glutes',
  'muscle.kuadricepsi': 'Quads',
  'muscle.kofshet-e-pasme': 'Hamstrings',
  'muscle.aduktoret': 'Adductors',
  'muscle.pulpat': 'Calves',
  'muscle.qafa': 'Neck',
  'plan.week': 'Week {week}',
  'plan.phase': 'Phase {n}',
  'plan.run': 'Round {run}',
  'plan.none': 'No programme',
  'plan.stsDay.1': 'Chest, triceps, calves',
  'plan.stsDay.2': 'Back, biceps, abs',
  'plan.stsDay.3': 'Shoulders, traps, calves',
  'plan.stsDay.4': 'Legs, abs',
  'plan.theme.chest': 'Chest day',
  'plan.theme.back': 'Back day',
  'plan.theme.shoulders': 'Shoulder day',
  'plan.theme.arms': 'Arm day',
  'plan.theme.legs': 'Leg day',
  'plan.theme.abs': 'Abs day',
  'equipment.barbell': 'Barbell',
  'equipment.ez_bar': 'EZ bar',
  'equipment.dumbbell': 'Dumbbell',
  'equipment.cable': 'Cable',
  'equipment.machine': 'Machine',
  'equipment.bodyweight': 'Bodyweight',
  'equipment.kettlebell': 'Kettlebell',
  'equipment.band': 'Band',
  'equipment.other': 'Other',
  'exercise.noPhoto': 'No photo',
}
