import { modelHint } from './model-hint'

describe('ndihma e gjesteve të modelit 3D', () => {
  afterEach(() => window.localStorage.clear())

  it('shfaqet derisa përdoruesi ta ketë kthyer ose zmadhuar modelin një herë; pastaj nuk kthehet', () => {
    expect(modelHint.seen()).toBe(false)
    modelHint.dismiss()
    expect(modelHint.seen()).toBe(true)
    // Mbahet në telefon, si tema: një hapje e re e app-it nuk e tregon më.
    expect(window.localStorage.getItem('th-model-hint')).toBe('1')
  })
})
