import { loadLibrary, muscleKeys, searchLibrary } from './library'

describe('biblioteka e ushtrimeve', () => {
  it('ngarkon ushtrimet e forcës nga free-exercise-db', async () => {
    const library = await loadLibrary()
    expect(library.length).toBeGreaterThan(700)
    expect(library.find((exercise) => exercise.id === 'Barbell_Curl')).toMatchObject({
      name: 'Barbell Curl',
      equipment: 'barbell',
      primary: ['biceps'],
    })
  })

  it('grupet kthehen në çelësat e modelit sipas Shtojcës D', () => {
    expect(muscleKeys(['chest'])).toEqual(['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor'])
    expect(muscleKeys(['shoulders', 'traps'])).toEqual(['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'trapezius'])
    expect(muscleKeys(['middle back'])).toEqual(['rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus'])
    expect(muscleKeys(['lower back', 'calves'])).toEqual(['erector_spinae', 'gastrocnemius', 'soleus'])
    // gluteus_medius është te glutes dhe te abductors: del një herë.
    expect(muscleKeys(['glutes', 'abductors'])).toEqual(['gluteus_maximus', 'gluteus_medius', 'tensor_fasciae_latae'])
    expect(muscleKeys(['neck', 'forearms', 'adductors'])).toEqual([
      'sternocleidomastoid',
      'brachioradialis',
      'forearm_flexors',
      'adductor_magnus',
      'adductor_longus',
    ])
    expect(muscleKeys(['quadriceps', 'hamstrings', 'abdominals', 'lats', 'biceps', 'triceps'])).toEqual([
      'rectus_femoris',
      'vastus_lateralis',
      'vastus_medialis',
      'biceps_femoris',
      'semitendinosus',
      'semimembranosus',
      'rectus_abdominis',
      'external_oblique',
      'latissimus_dorsi',
      'biceps_brachii',
      'brachialis',
      'triceps_brachii',
    ])
  })

  it('kërkimi gjen me çdo fjalë, pa dallim shkronjash, dhe nxjerr përpara emrat që nisin me kërkesën', () => {
    const library = [
      { id: 'a', name: 'Incline Dumbbell Curl', equipment: 'dumbbell' as const, primary: [], secondary: [] },
      { id: 'b', name: 'Dumbbell Curl', equipment: 'dumbbell' as const, primary: [], secondary: [] },
      { id: 'c', name: 'Barbell Curl', equipment: 'barbell' as const, primary: [], secondary: [] },
    ]
    expect(searchLibrary(library, 'curl dumbbell').map((exercise) => exercise.id)).toEqual(['a', 'b'])
    expect(searchLibrary(library, 'DUMBBELL').map((exercise) => exercise.id)).toEqual(['b', 'a'])
    expect(searchLibrary(library, '  ').map((exercise) => exercise.id)).toEqual(['a', 'b', 'c'])
  })
})
