import { watchUpdates } from './watch'

describe('kur kontrollohet për version të ri', () => {
  it('në hapje, në rikthim te app-i dhe kur kthehet interneti; përgjigja e sistemit i kalon përditësuesit', () => {
    const check = vi.fn()
    const onInstallStatus = vi.fn()
    const listeners: Record<string, () => void> = {}
    let status: ((event: { status: 'failure'; aborted: boolean; message: null }) => void) | undefined
    const stop = watchUpdates(
      { check, onInstallStatus },
      {
        onResume: (listener) => ((listeners.resume = listener), () => delete listeners.resume),
        onOnline: (listener) => ((listeners.online = listener), () => delete listeners.online),
        onInstallStatus: (listener) => ((status = listener), () => (status = undefined)),
      },
    )
    expect(check).toHaveBeenCalledTimes(1)
    listeners.resume()
    listeners.online()
    expect(check).toHaveBeenCalledTimes(3)
    status?.({ status: 'failure', aborted: true, message: null })
    expect(onInstallStatus).toHaveBeenCalledWith({ status: 'failure', aborted: true, message: null })
    stop()
    expect(listeners).toEqual({})
    expect(status).toBeUndefined()
  })
})
