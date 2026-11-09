import { recordPulse, savePulse } from './session-motion'

// Dridhjet e seancës (SPEC §0.3c, DESIGN.md › Lëvizja): e lehtë te çdo "Ruaj setin", e rëndë te rekordi.
// Plugin-i i Capacitor-it imitohet; në shfletues asnjë dridhje.

const native = vi.hoisted(() => ({ isNative: true, impact: vi.fn((_: { style: string }) => Promise.resolve()) }))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
}))

vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: native.impact },
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}))

describe('dridhjet e seancës', () => {
  beforeEach(() => {
    native.isNative = true
    native.impact.mockClear()
  })

  it('"Ruaj setin": e lehtë; rekordi: e rëndë', async () => {
    await savePulse()
    expect(native.impact.mock.calls).toEqual([[{ style: 'LIGHT' }]])
    await recordPulse()
    expect(native.impact.mock.calls.at(-1)).toEqual([{ style: 'HEAVY' }])
  })

  it('në shfletues asnjë dridhje; një dështim i plugin-it nuk e ndal ruajtjen', async () => {
    native.isNative = false
    await savePulse()
    expect(native.impact).not.toHaveBeenCalled()
    native.isNative = true
    native.impact.mockRejectedValueOnce(new Error('pa motor'))
    await expect(savePulse()).resolves.toBeUndefined()
  })
})
