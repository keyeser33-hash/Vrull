import { describe, expect, it } from 'vitest'
import { type FillFood, fillMacros } from './fill-macros'

// Plotëso makrot (V2-E3-28c, SPEC §0.3h): propozime nga proteina dhe kaloritë që mbeten, pa AI dhe pa rrjet.

const food = (id: string, source: FillFood['source'], kcal: number, proteinG: number, servingG: number | null, name = id): FillFood => ({
  foodId: id,
  name,
  source,
  sourceId: null,
  per100: { kcal, proteinG, carbsG: 0, fatG: 0 },
  servingG,
  servingLabel: null,
  unit: null,
})

// Pluhur proteine: 30 g për lugë, 400 kcal dhe 80 g proteinë për 100 g (120 kcal, 24 g P për lugë).
const powder = food('powder', 'supplement', 400, 80, 30)
// Gjizë: 226 g për gotë, 72 kcal dhe 12,4 g proteinë për 100 g.
const cheese = food('cheese', 'plan', 72, 12.4, 226)
// Ton: një kanoçe 142 g, 116 kcal dhe 26 g proteinë për 100 g.
const tuna = food('tuna', 'own', 116, 26, 142)
// Bukë: një fetë 28 g, 250 kcal dhe 10 g proteinë për 100 g.
const bread = food('bread', 'own', 250, 10, 28)
// Gjoks pule pa porcion: hapa 10 g, 120 kcal dhe 22,5 g proteinë për 100 g.
const chicken = food('chicken', 'own', 120, 22.5, null)

const mains = (proposals: ReturnType<typeof fillMacros>['proposals']) => proposals.map((proposal) => proposal.items[0].food.foodId)

describe('fillMacros', () => {
  it('një ushqim në porcione të plota: numri më i vogël që e mbush proteinën, pa kaluar kalorit', () => {
    const { status, proposals } = fillMacros({ proteinG: 46, kcal: 520 }, [powder])
    expect(status).toBe('ok')
    expect(proposals).toHaveLength(1)
    const [only] = proposals
    // 2 lugë = 48 g proteinë, 240 kcal; një lugë (24 g) nuk mjafton, tri do të ishin tepricë.
    expect(only.items).toHaveLength(1)
    expect(only.items[0]).toMatchObject({ count: 2, grams: 60 })
    expect(only.proteinG).toBeCloseTo(48, 5)
    expect(only.kcal).toBeCloseTo(240, 5)
    expect(only.coverage).toBe(1)
    expect(only.kcalLeft).toBeCloseTo(280, 5)
    expect(only.source).toBe('supplement')
  })

  it('nuk propozon porcione që e kalojnë shumë proteinën: 2 kanoçe ton (74 g) kur mbeten 46 g', () => {
    const [only] = fillMacros({ proteinG: 46, kcal: 520 }, [tuna]).proposals
    expect(only.items[0].count).toBe(1)
    expect(only.coverage).toBeCloseTo(36.92 / 46, 2)
    // Kur mbeten pak, një porcion i vetëm lejohet edhe pse e kalon: një lugë pluhur për 10 g proteinë.
    const [small] = fillMacros({ proteinG: 10, kcal: 520 }, [powder]).proposals
    expect(small.items[0].count).toBe(1)
    expect(small.coverage).toBe(1)
  })

  it('pa porcion ushqimi shtohet me hapa 10 g', () => {
    const [only] = fillMacros({ proteinG: 46, kcal: 520 }, [chicken]).proposals
    // 46 / 2,25 = 20,4 hapa: 21 hapa = 210 g = 47,25 g proteinë, 252 kcal.
    expect(only.items[0]).toMatchObject({ count: 21, grams: 210 })
    expect(only.coverage).toBe(1)
  })

  it('kalorit janë kufi: propozimi ndalet te porcioni i fundit që futet dhe proteina mbetet e pambushur', () => {
    const [only] = fillMacros({ proteinG: 46, kcal: 200 }, [powder]).proposals
    // Dy lugë janë 240 kcal; vetëm një (120 kcal) futet.
    expect(only.items[0].count).toBe(1)
    expect(only.kcal).toBe(120)
    expect(only.coverage).toBeCloseTo(24 / 46, 5)
    expect(only.kcalLeft).toBe(80)
  })

  it('asnjë propozim nuk kalon kalorit që mbeten', () => {
    for (const kcal of [30, 130, 260, 520, 1000]) {
      for (const proposal of fillMacros({ proteinG: 80, kcal }, [powder, cheese, tuna, bread, chicken]).proposals) {
        expect(proposal.kcal).toBeLessThanOrEqual(kcal + 1e-9)
        expect(proposal.kcalLeft).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  })

  it('një ushqim që nuk futet as një herë në kalori nuk del', () => {
    expect(fillMacros({ proteinG: 40, kcal: 100 }, [powder])).toEqual({ status: 'ok', proposals: [] })
  })

  it('dy ushqime kur i pari nuk mjafton: ton + bukë del para tonit të vetëm', () => {
    // Një kanoçe toni: 36,9 g proteinë, 164,7 kcal; e dyta do 329 kcal, mbi 300. Një fetë bukë plotëson pak.
    const { proposals } = fillMacros({ proteinG: 46, kcal: 300 }, [tuna, bread])
    const [first] = proposals
    expect(first.items.map((item) => item.food.foodId)).toEqual(['tuna', 'bread'])
    expect(first.items[0].count).toBe(1)
    expect(first.coverage).toBeGreaterThan(36.9 / 46)
    expect(first.kcal).toBeLessThanOrEqual(300)
    // Ushqimi kryesor (ai me më shumë proteinë) është i pari.
    expect(first.items[0].proteinG).toBeGreaterThanOrEqual(first.items[1].proteinG)
  })

  it('ushqimi i dytë shtohet vetëm kur e rrit mbulimin', () => {
    const { proposals } = fillMacros({ proteinG: 46, kcal: 520 }, [powder, bread])
    expect(proposals.every((proposal) => proposal.items.length === 1)).toBe(true)
  })

  it('renditja: mbulimi i proteinës, pastaj më pak kalori', () => {
    const { proposals } = fillMacros({ proteinG: 46, kcal: 520 }, [bread, cheese, powder])
    // Pluhuri: 100 % me 240 kcal; gjiza: 2 gota = 56 g, 100 % me 325 kcal; buka mbush vetëm një pjesë.
    expect(mains(proposals)).toEqual(['powder', 'cheese', 'bread'])
    const coverage = proposals.map((proposal) => proposal.coverage)
    expect([...coverage].sort((a, b) => b - a)).toEqual(coverage)
    expect(proposals[0].coverage).toBe(1)
    expect(proposals[2].coverage).toBeLessThan(1)
  })

  it('deri në 3 propozime dhe asnjë ushqim kryesor dy herë', () => {
    const foods = [powder, cheese, tuna, bread, chicken, food('egg', 'own', 143, 12.6, 50), food('skyr', 'own', 63, 11, 150)]
    const { proposals } = fillMacros({ proteinG: 46, kcal: 600 }, foods)
    expect(proposals.length).toBe(3)
    const main = mains(proposals)
    expect(new Set(main).size).toBe(main.length)
  })

  it('i njëjti ushqim dy herë në listë (dy burime) hyn një herë, burimi i parë mbahet', () => {
    const duplicate = { ...powder, source: 'own' as const }
    const { proposals } = fillMacros({ proteinG: 46, kcal: 520 }, [powder, duplicate])
    expect(proposals).toHaveLength(1)
    expect(proposals[0].source).toBe('supplement')
  })

  it('ushqimet pa proteinë nuk propozohen', () => {
    expect(fillMacros({ proteinG: 20, kcal: 500 }, [food('oil', 'own', 884, 0, 14)]).proposals).toEqual([])
  })

  it('proteina e mbushur ose kalorit e mbaruara: asnjë propozim dhe shkaku', () => {
    expect(fillMacros({ proteinG: 0, kcal: 500 }, [powder])).toEqual({ status: 'proteinDone', proposals: [] })
    expect(fillMacros({ proteinG: -12, kcal: 500 }, [powder])).toEqual({ status: 'proteinDone', proposals: [] })
    expect(fillMacros({ proteinG: 30, kcal: 0 }, [powder])).toEqual({ status: 'noKcal', proposals: [] })
    expect(fillMacros({ proteinG: 30, kcal: -250 }, [powder])).toEqual({ status: 'noKcal', proposals: [] })
  })

  it('pa ushqime: shkaku "noFoods"; proteina e mbushur ka përparësi', () => {
    expect(fillMacros({ proteinG: 30, kcal: 500 }, [])).toEqual({ status: 'noFoods', proposals: [] })
    expect(fillMacros({ proteinG: 0, kcal: 500 }, [])).toEqual({ status: 'proteinDone', proposals: [] })
  })

  it('numra jo të fundëm ose ushqime të prishura nuk e prishin llogaritjen', () => {
    expect(fillMacros({ proteinG: Number.NaN, kcal: 500 }, [powder]).status).toBe('proteinDone')
    const broken = food('broken', 'own', Number.NaN, 20, 100)
    expect(mains(fillMacros({ proteinG: 30, kcal: 500 }, [broken, powder]).proposals)).toEqual(['powder'])
    // Porcion zero ose negativ: hapa 10 g (20 g proteinë për 100 g = 2 g për hap, 15 hapa për 30 g).
    expect(fillMacros({ proteinG: 30, kcal: 500 }, [food('zero', 'own', 100, 20, 0)]).proposals.map((proposal) => proposal.items[0].grams)).toEqual([150])
  })

  it('mbetet e shpejtë me një listë të gjatë', () => {
    const foods = Array.from({ length: 40 }, (_, index) => food(`f${index}`, 'own', 80 + index * 3, 8 + (index % 9) * 2, index % 3 === 0 ? null : 40 + index))
    const started = performance.now()
    const { proposals } = fillMacros({ proteinG: 90, kcal: 700 }, foods)
    expect(performance.now() - started).toBeLessThan(2000)
    expect(proposals.length).toBeGreaterThan(0)
  })
})
