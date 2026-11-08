// Emri latinisht i çdo grupi muskujsh (SPEC §11, "Prek muskulin"); emri dhe funksioni sipas gjuhës
// janë te katalogu (`muscleName` nga `@/i18n/domain`; funksioni `bodyModel.role.*` te src/i18n/areas/body.ts).

export const MUSCLE_INFO: Record<string, { latin: string }> = {
  gjoksi: { latin: 'Pectoralis major et minor' },
  shpatullat: { latin: 'Deltoideus' },
  trapezi: { latin: 'Trapezius' },
  shpina: { latin: 'Latissimus dorsi, rhomboidei, teres major' },
  mesi: { latin: 'Erector spinae' },
  bicepsi: { latin: 'Biceps brachii, brachialis' },
  tricepsi: { latin: 'Triceps brachii' },
  parakrahet: { latin: 'Brachioradialis, flexores antebrachii' },
  barku: { latin: 'Rectus abdominis, obliquus externus' },
  vithet: { latin: 'Gluteus maximus et medius' },
  kuadricepsi: { latin: 'Quadriceps femoris' },
  'kofshet-e-pasme': { latin: 'Biceps femoris, semitendinosus, semimembranosus' },
  aduktoret: { latin: 'Adductor magnus et longus' },
  pulpat: { latin: 'Gastrocnemius, soleus' },
  qafa: { latin: 'Sternocleidomastoideus' },
}
