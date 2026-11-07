// Emri latinisht dhe funksioni i çdo grupi muskujsh (SPEC §11, "Prek muskulin").

export const MUSCLE_INFO: Record<string, { latin: string; role: string }> = {
  gjoksi: { latin: 'Pectoralis major et minor', role: 'Shtyn krahët përpara dhe i afron drejt trupit, si te shtypja në stol.' },
  shpatullat: { latin: 'Deltoideus', role: 'Ngre krahun përpara, anash dhe mbrapa; mban shpatullën të qëndrueshme.' },
  trapezi: { latin: 'Trapezius', role: 'Ngre dhe afron kockat e shpatullave, si te ngritja e supeve.' },
  shpina: { latin: 'Latissimus dorsi, rhomboidei, teres major', role: 'Tërheq krahët poshtë dhe mbrapa, si te tërheqjet dhe vozitja.' },
  mesi: { latin: 'Erector spinae', role: 'Drejton dhe mban shtyllën kurrizore, si te deadlift-i.' },
  bicepsi: { latin: 'Biceps brachii, brachialis', role: 'Përkul bërrylin dhe rrotullon parakrahun me pëllëmbën lart.' },
  tricepsi: { latin: 'Triceps brachii', role: 'Drejton bërrylin, si te shtypjet dhe zgjatimet e krahut.' },
  parakrahet: { latin: 'Brachioradialis, flexores antebrachii', role: 'Përkulin kyçin dhe gishtat; mbajnë kapjen e shufrës.' },
  barku: { latin: 'Rectus abdominis, obliquus externus', role: 'Përkul dhe rrotullon trupin; mban mesin të fortë nën peshë.' },
  vithet: { latin: 'Gluteus maximus et medius', role: 'Drejton dhe hap ijën, si te squat-i dhe ngritja e ijëve.' },
  kuadricepsi: { latin: 'Quadriceps femoris', role: 'Drejton gjurin, si te squat-i dhe shtypja me këmbë.' },
  'kofshet-e-pasme': { latin: 'Biceps femoris, semitendinosus, semimembranosus', role: 'Përkulin gjurin dhe drejtojnë ijën, si te curl-i i këmbëve.' },
  aduktoret: { latin: 'Adductor magnus et longus', role: 'Afrojnë këmbën drejt vijës së mesit dhe ndihmojnë te squat-i.' },
  pulpat: { latin: 'Gastrocnemius, soleus', role: 'Ngrenë thembrën dhe shtyjnë trupin përpara mbi gishtat.' },
  qafa: { latin: 'Sternocleidomastoideus', role: 'Rrotullon dhe përkul kokën.' },
}
