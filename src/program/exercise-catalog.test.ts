import {
  buildCatalog,
  type CatalogRow,
  filterCatalog,
  groupsOf,
  keysOf,
  libraryGroupsOf,
  nameStatus,
  takenNames,
  volumeShare,
} from './exercise-catalog'
import type { LibraryExercise } from './library'

// Biblioteka e ekranit (bordi "Biblioteka"): free-exercise-db bashkë me ushtrimet në telefon, filtrat
// sipas muskujve dhe pajisjes, dhe ushtrimi i përdoruesit ("Krijo ushtrim").

const library: LibraryExercise[] = [
  { id: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Barbell Bench Press - Medium Grip', equipment: 'barbell', primary: ['chest'], secondary: ['shoulders', 'triceps'] },
  { id: 'Dumbbell_Bicep_Curl', name: 'Dumbbell Bicep Curl', equipment: 'dumbbell', primary: ['biceps'], secondary: ['forearms'] },
  { id: 'Arnold_Dumbbell_Press', name: 'Arnold Dumbbell Press', equipment: 'dumbbell', primary: ['shoulders'], secondary: ['triceps'] },
  { id: 'Barbell_Squat', name: 'Barbell Squat', equipment: 'barbell', primary: ['quadriceps'], secondary: ['calves', 'glutes'] },
  { id: 'EZ-Bar_Curl', name: 'EZ-Bar Curl', equipment: 'ez_bar', primary: ['biceps'], secondary: [] },
]

const rows: CatalogRow[] = [
  // Shortcut to Size: emri i PDF-së, me ID-në e bibliotekës dhe çelësat e saktë (Shtojca E).
  {
    id: 'ex-bench',
    name: 'Bench Press',
    libraryId: 'Barbell_Bench_Press_-_Medium_Grip',
    equipment: 'barbell',
    primary: ['pectoralis_major_sternocostal'],
    secondary: ['deltoid_anterior', 'triceps_brachii'],
  },
  // Shortcut to Size pa ushtrim te biblioteka.
  { id: 'ex-pulldown', name: 'Standing Pulldown', libraryId: null, equipment: 'cable', primary: ['latissimus_dorsi'], secondary: ['biceps_brachii'] },
  // I krijuar nga përdoruesi.
  {
    id: 'ex-landmine',
    name: 'Landmine Press',
    libraryId: null,
    equipment: 'barbell',
    primary: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
    secondary: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor', 'triceps_brachii'],
  },
  // Nga biblioteka me të njëjtin emër (editori i v1): bashkohet me rreshtin e bibliotekës.
  { id: 'ex-curl', name: 'dumbbell bicep curl', libraryId: null, equipment: 'dumbbell', primary: ['biceps_brachii'], secondary: [] },
]

const programNames = new Set(['bench press', 'standing pulldown'])

describe('biblioteka me ushtrimet e telefonit', () => {
  const catalog = buildCatalog(library, rows, programNames)

  it('bashkon bibliotekën me ushtrimet në telefon dhe i rendit A–Z', () => {
    expect(catalog.map((item) => item.name)).toEqual([
      'Arnold Dumbbell Press',
      'Barbell Squat',
      'Bench Press',
      'dumbbell bicep curl',
      'EZ-Bar Curl',
      'Landmine Press',
      'Standing Pulldown',
    ])
  })

  it('ushtrimi në telefon zë vendin e atij të bibliotekës, me çelësat e vet dhe ID-në e bibliotekës', () => {
    expect(catalog.find((item) => item.name === 'Bench Press')).toEqual({
      key: 'ex-bench',
      exerciseId: 'ex-bench',
      libraryId: 'Barbell_Bench_Press_-_Medium_Grip',
      name: 'Bench Press',
      equipment: 'barbell',
      primary: ['pectoralis_major_sternocostal'],
      secondary: ['deltoid_anterior', 'triceps_brachii'],
      own: false,
    })
    // Emri i njëjtë, pa ID: merr foton e bibliotekës.
    expect(catalog.find((item) => item.exerciseId === 'ex-curl')).toMatchObject({ libraryId: 'Dumbbell_Bicep_Curl', own: false })
  })

  it('ushtrimi i bibliotekës që s’është në telefon merr çelësat nga grupet (Shtojca D)', () => {
    expect(catalog.find((item) => item.name === 'Arnold Dumbbell Press')).toEqual({
      key: 'Arnold_Dumbbell_Press',
      exerciseId: null,
      libraryId: 'Arnold_Dumbbell_Press',
      name: 'Arnold Dumbbell Press',
      equipment: 'dumbbell',
      primary: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'],
      secondary: ['triceps_brachii'],
      own: false,
    })
  })

  it('"I yti" vetëm për ushtrimin e krijuar nga përdoruesi, jo për ato të programit', () => {
    expect(catalog.filter((item) => item.own).map((item) => item.name)).toEqual(['Landmine Press'])
  })

  it('filtron sipas zonës së muskujve (kryesorët), pajisjes dhe kërkimit', () => {
    const names = (filter: Parameters<typeof filterCatalog>[1]) => filterCatalog(catalog, filter).map((item) => item.name)
    expect(names({ area: 'shoulders' })).toEqual(['Arnold Dumbbell Press', 'Landmine Press'])
    expect(names({ area: 'arms' })).toEqual(['dumbbell bicep curl', 'EZ-Bar Curl'])
    expect(names({ area: 'legs' })).toEqual(['Barbell Squat'])
    expect(names({ area: 'back' })).toEqual(['Standing Pulldown'])
    // Shufra përfshin shufrën EZ.
    expect(names({ equipment: 'barbell' })).toEqual(['Barbell Squat', 'Bench Press', 'EZ-Bar Curl', 'Landmine Press'])
    expect(names({ area: 'arms', equipment: 'dumbbell' })).toEqual(['dumbbell bicep curl'])
    expect(names({ query: '  PRESS ' })).toEqual(['Arnold Dumbbell Press', 'Bench Press', 'Landmine Press'])
    expect(names({ query: 'press dumb' })).toEqual(['Arnold Dumbbell Press'])
    expect(names({})).toHaveLength(7)
  })

  it('emri i ushtrimit të ri: bosh, i zënë (pa dallim shkronjash, edhe emri i bibliotekës) ose i ri', () => {
    const taken = takenNames(library, rows)
    expect(nameStatus('  ', taken)).toBe('empty')
    expect(nameStatus('bench press', taken)).toBe('taken')
    expect(nameStatus(' Barbell  Squat ', taken)).toBe('taken')
    expect(nameStatus('Barbell Bench Press - Medium Grip', taken)).toBe('taken')
    expect(nameStatus('Landmine Row', taken)).toBe('new')
  })
})

describe('grupet e muskujve', () => {
  it('grupet e ekranit nga çelësat, me radhën e grupeve', () => {
    expect(groupsOf(['triceps_brachii', 'pectoralis_major_sternocostal', 'deltoid_anterior'])).toEqual(['gjoksi', 'shpatullat', 'tricepsi'])
    expect(groupsOf([])).toEqual([])
  })

  it('çelësat e grupeve të zgjedhura', () => {
    expect(keysOf(['shpatullat', 'pulpat'])).toEqual(['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'gastrocnemius', 'soleus'])
  })

  it('grupet e free-exercise-db që çelësat i mbulojnë plotësisht (për editorin)', () => {
    expect(libraryGroupsOf(keysOf(['barku', 'pulpat']))).toEqual(['abdominals', 'calves'])
    expect(libraryGroupsOf(['deltoid_anterior'])).toEqual([])
  })

  it('volumi javor i një seti: kryesori 1, ndihmësi 0,5, një herë për grup (SPEC §11)', () => {
    expect(volumeShare(['shpatullat'], ['gjoksi', 'tricepsi', 'shpatullat'])).toEqual([
      { group: 'shpatullat', sets: 1 },
      { group: 'gjoksi', sets: 0.5 },
      { group: 'tricepsi', sets: 0.5 },
    ])
  })
})
