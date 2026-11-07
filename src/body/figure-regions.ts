// Zonat e figurës 2D përpara dhe mbrapa (SPEC §14, §11): çdo zonë me çelësat e Shtojcës D që mbulon.
// Edhe modeli 3D i lexon për të ditur nga cila anë duket një muskul (model-focus.ts).

export type Shape = { kind: 'rect'; x: number; y: number; w: number; h: number; r: number } | { kind: 'circle'; cx: number; cy: number; r: number }
export type Region = { keys: string[]; shapes: Shape[] }

const rect = (x: number, y: number, w: number, h: number, r = Math.min(w, h) / 2): Shape => ({ kind: 'rect', x, y, w, h, r })
const both = (x: number, y: number, w: number, h: number, r?: number) => [rect(x, y, w, h, r), rect(60 - x - w, y, w, h, r)]

// Silueta: koka, qafa, trupi, krahët, legeni, kofshët, kërcinjtë. Një pamje është 60 × 144.
export const SILHOUETTE: Shape[] = [
  { kind: 'circle', cx: 30, cy: 10, r: 8 },
  rect(26, 16, 8, 8, 3),
  rect(16, 22, 28, 44, 10),
  ...both(6, 24, 9, 22, 4.5),
  ...both(5, 47, 8, 21, 4),
  rect(18, 63, 24, 13, 5),
  ...both(18, 74, 11, 34, 5),
  ...both(19, 110, 9, 28, 4.5),
]

export const FRONT: Region[] = [
  { keys: ['sternocleidomastoid'], shapes: [rect(26.5, 17, 7, 6, 2.5)] },
  { keys: ['deltoid_anterior', 'deltoid_lateral'], shapes: both(6, 23.5, 9, 8, 4) },
  { keys: ['pectoralis_major_clavicular'], shapes: both(18.5, 25, 11, 6, 3) },
  { keys: ['pectoralis_major_sternocostal', 'pectoralis_minor'], shapes: both(18.5, 31.5, 11, 8, 4) },
  { keys: ['biceps_brachii', 'brachialis'], shapes: both(6.5, 32.5, 8, 13, 4) },
  { keys: ['brachioradialis', 'forearm_flexors'], shapes: both(5.5, 48, 7, 15, 3.5) },
  { keys: ['rectus_abdominis'], shapes: [rect(25, 41, 10, 22, 4)] },
  { keys: ['external_oblique'], shapes: both(18, 42, 6, 18, 3) },
  { keys: ['gluteus_medius', 'tensor_fasciae_latae'], shapes: both(18, 64, 5, 9, 2.5) },
  { keys: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'], shapes: both(18.5, 76, 8, 29, 4) },
  { keys: ['adductor_magnus', 'adductor_longus'], shapes: both(26.5, 77, 2.5, 18, 1.25) },
  { keys: ['gastrocnemius', 'soleus'], shapes: both(19, 112, 9, 16, 4.5) },
]

export const BACK: Region[] = [
  { keys: ['trapezius'], shapes: [rect(21, 20, 18, 13, 5)] },
  { keys: ['deltoid_posterior', 'deltoid_lateral'], shapes: both(6, 23.5, 9, 8, 4) },
  { keys: ['infraspinatus', 'teres_major'], shapes: both(17.5, 33, 8, 7, 3) },
  { keys: ['rhomboid_major', 'rhomboid_minor'], shapes: [rect(26, 33, 8, 8, 3)] },
  { keys: ['latissimus_dorsi'], shapes: both(17, 41, 8.5, 17, 4) },
  { keys: ['erector_spinae'], shapes: [rect(26.5, 42, 7, 21, 3)] },
  { keys: ['triceps_brachii'], shapes: both(6, 27, 9, 19, 4.5) },
  { keys: ['brachioradialis', 'forearm_flexors'], shapes: both(5.5, 48, 7, 15, 3.5) },
  { keys: ['gluteus_medius'], shapes: both(18.5, 62.5, 10.5, 5, 2.5) },
  { keys: ['gluteus_maximus'], shapes: both(18.5, 66, 10.5, 11, 5) },
  { keys: ['biceps_femoris', 'semitendinosus', 'semimembranosus'], shapes: both(18.5, 80, 9.5, 26, 4.5) },
  { keys: ['adductor_magnus'], shapes: both(27, 78, 2, 14, 1) },
  { keys: ['gastrocnemius', 'soleus'], shapes: both(19, 110, 9, 20, 4.5) },
]
