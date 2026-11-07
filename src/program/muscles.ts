// Grupet e muskujve për ekranet (rikuperimi, figura e trupit), mbi çelësat e Shtojcës D.

export interface MuscleGroup {
  id: string
  name: string
  keys: string[]
}

export const MUSCLE_GROUPS: MuscleGroup[] = [
  { id: 'gjoksi', name: 'Gjoksi', keys: ['pectoralis_major_clavicular', 'pectoralis_major_sternocostal', 'pectoralis_minor'] },
  { id: 'shpatullat', name: 'Shpatullat', keys: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior'] },
  { id: 'trapezi', name: 'Trapezi', keys: ['trapezius'] },
  { id: 'shpina', name: 'Shpina', keys: ['latissimus_dorsi', 'rhomboid_major', 'rhomboid_minor', 'teres_major', 'infraspinatus'] },
  { id: 'mesi', name: 'Mesi i poshtëm', keys: ['erector_spinae'] },
  { id: 'bicepsi', name: 'Bicepsi', keys: ['biceps_brachii', 'brachialis'] },
  { id: 'tricepsi', name: 'Tricepsi', keys: ['triceps_brachii'] },
  { id: 'parakrahet', name: 'Parakrahët', keys: ['brachioradialis', 'forearm_flexors'] },
  { id: 'barku', name: 'Barku', keys: ['rectus_abdominis', 'external_oblique'] },
  { id: 'vithet', name: 'Vithet', keys: ['gluteus_maximus', 'gluteus_medius', 'tensor_fasciae_latae'] },
  { id: 'kuadricepsi', name: 'Kuadricepsi', keys: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'] },
  { id: 'kofshet-e-pasme', name: 'Kofshët e pasme', keys: ['biceps_femoris', 'semitendinosus', 'semimembranosus'] },
  { id: 'aduktoret', name: 'Aduktorët', keys: ['adductor_magnus', 'adductor_longus'] },
  { id: 'pulpat', name: 'Pulpat', keys: ['gastrocnemius', 'soleus'] },
  { id: 'qafa', name: 'Qafa', keys: ['sternocleidomastoid'] },
]
