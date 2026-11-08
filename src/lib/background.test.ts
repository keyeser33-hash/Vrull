import { BACKGROUNDS, createBackgroundStore, DEFAULT_BACKGROUND, readBackground } from './background'

// Sfondi i faqes (DESIGN.md › Sfondet): "I plotë" ose "Vija shpejtësie", me çdo temë.
describe('sfondi në telefon', () => {
  beforeEach(() => window.localStorage.clear())

  it('dy sfondet, "I plotë" parazgjedhje', () => {
    expect(BACKGROUNDS).toEqual(['solid', 'speed_lines'])
    expect(DEFAULT_BACKGROUND).toBe('solid')
    expect(readBackground()).toBe('solid')
  })

  it('ndërrimi njofton dëgjuesit dhe ruhet në telefon; e njëjta vlerë nuk bën asgjë', () => {
    const phone = createBackgroundStore()
    const listener = vi.fn()
    const stop = phone.subscribe(listener)
    phone.set('speed_lines')
    expect(phone.get()).toBe('speed_lines')
    expect(listener).toHaveBeenCalledOnce()
    expect(window.localStorage.getItem('th-background')).toBe('speed_lines')
    expect(readBackground()).toBe('speed_lines')
    phone.set('speed_lines')
    expect(listener).toHaveBeenCalledOnce()
    stop()
    phone.set('solid')
    expect(listener).toHaveBeenCalledOnce()
  })

  it('injoron vlera të panjohura dhe ruajtjen që hedh gabim', () => {
    window.localStorage.setItem('th-background', 'natë')
    expect(readBackground()).toBe('solid')
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bllokuar')
    })
    expect(readBackground()).toBe('solid')
    spy.mockRestore()
  })
})
