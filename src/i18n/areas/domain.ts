import type { Messages, TranslationOf } from '../translate'

// Termat e domenit që i përdorin shumë ekrane (Sot, seanca, programi, trupi, historiku, hyrja):
// grupet e muskujve dhe emrat e Shortcut to Size, që ruhen shqip në bazë. Funksionet: `src/i18n/domain.ts`.
// Çelësat: 'muscle.*', 'plan.*'.

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
}
