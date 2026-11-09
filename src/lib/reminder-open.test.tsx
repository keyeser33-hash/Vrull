import { act, render } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { useReminderOpen } from './reminder-open'

// Prekja e "Java jote është gati" (V43, SPEC §0.3c): në nisje (`consumeOpen`), kur njoftimi vjen me app-in
// të hapur (ngjarja `open`) dhe kur app-i kthehet në plan të parë, app-i hap përmbledhjen e asaj jave.
// Plugin-i RemindersPlugin dhe Capacitor-i imitohen.

const native = vi.hoisted(() => ({
  isNative: true,
  keys: [] as (string | null)[],
  consume: vi.fn(),
  open: null as (() => void) | null,
  resume: null as (() => void) | null,
  stopOpen: vi.fn(),
  removeResume: vi.fn(),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
}))

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: (event: string, listener: () => void) => {
      if (event === 'resume') native.resume = listener
      return Promise.resolve({ remove: native.removeResume })
    },
  },
}))

vi.mock('./reminders-native', () => ({
  reminderOpen: {
    consume: async () => {
      native.consume()
      return native.keys.shift() ?? null
    },
    listen: (listener: () => void) => {
      native.open = listener
      return native.stopOpen
    },
  },
}))

/** Si porta e app-it (`routes/gate.tsx`): rri e montuar sipër çdo rruge. */
function Gate({ ready }: { ready: boolean }) {
  useReminderOpen(ready)
  return <Outlet />
}

function renderAt(ready = true) {
  const router = createMemoryRouter(
    [
      {
        element: <Gate ready={ready} />,
        children: [
          { path: '/', element: <p>Sot</p> },
          { path: '/progresi/java/:monday', element: <p>Java</p> },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  const view = render(<RouterProvider router={router} />)
  return { router, view }
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)))

describe('prekja e njoftimit të javës', () => {
  beforeEach(() => {
    native.isNative = true
    native.keys = []
    native.consume.mockClear()
    native.stopOpen.mockClear()
    native.removeResume.mockClear()
    native.open = null
    native.resume = null
  })

  it('në nisje: çelësi i ruajtur nga plugin-i hap përmbledhjen e asaj jave', async () => {
    native.keys = ['week|2026-11-02|']
    const { router } = renderAt()
    await flush()
    expect(native.consume).toHaveBeenCalledTimes(1)
    expect(router.state.location.pathname).toBe('/progresi/java/2026-11-02')
  })

  it('me app-in të hapur (ngjarja "open") dhe pas kthimit në plan të parë', async () => {
    const { router } = renderAt()
    await flush()
    expect(router.state.location.pathname).toBe('/')
    native.keys = ['week|2026-11-09|']
    act(() => native.open?.())
    await flush()
    expect(router.state.location.pathname).toBe('/progresi/java/2026-11-09')
    native.keys = ['week|2026-11-16|']
    act(() => native.resume?.())
    await flush()
    expect(router.state.location.pathname).toBe('/progresi/java/2026-11-16')
  })

  it('pa çelës ose me një çelës tjetër nuk lëviz; dëgjuesit hiqen kur ekrani ikën', async () => {
    native.keys = ['meal|lunch|']
    const { router, view } = renderAt()
    await flush()
    act(() => native.open?.())
    await flush()
    expect(native.consume).toHaveBeenCalledTimes(2)
    expect(router.state.location.pathname).toBe('/')
    view.unmount()
    await flush()
    expect(native.stopOpen).toHaveBeenCalled()
    expect(native.removeResume).toHaveBeenCalled()
  })

  it('para se app-i të jetë gati dhe në shfletues nuk lexon asgjë', async () => {
    native.keys = ['week|2026-11-02|']
    renderAt(false)
    await flush()
    expect(native.consume).not.toHaveBeenCalled()
    native.isNative = false
    renderAt(true)
    await flush()
    expect(native.consume).not.toHaveBeenCalled()
  })
})
