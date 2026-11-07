import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Release, UpdateState } from '@/update/updater'

const fake = vi.hoisted(() => ({
  state: { status: 'idle' } as UpdateState,
  update: vi.fn(async () => {}),
  allowInstall: vi.fn(async () => {}),
  check: vi.fn(async () => {}),
}))
vi.mock('@/data/app-data', () => ({
  useAppUpdate: () => fake.state,
  updater: { update: fake.update, allowInstall: fake.allowInstall, check: fake.check },
}))

const release: Release = {
  version: '0.16.0',
  apk: 'TrainingHub-0.16.0.apk',
  sha256: 'a'.repeat(64),
  bytes: 28_336_570,
  notes: ['Trupi: muskujt e ushtrimit në 3D', 'Përditësimi brenda app-it'],
  publishedAt: '2026-11-08T10:00:00Z',
}

async function renderNotice() {
  const { UpdateNotice } = await import('./app-update')
  const router = createMemoryRouter([{ path: '/', element: <UpdateNotice /> }], { initialEntries: ['/'] })
  render(<RouterProvider router={router} />)
  return router
}

async function renderSheet() {
  const { UpdateSheet } = await import('./app-update')
  const onClose = vi.fn()
  const { unmount } = render(<UpdateSheet onClose={onClose} />)
  return { onClose, unmount, sheet: screen.getByRole('dialog') }
}

describe('përditësimi brenda app-it', () => {
  beforeEach(() => {
    fake.state = { status: 'idle' }
    vi.clearAllMocks()
  })

  it('te Sot: pa version të ri nuk shfaqet asgjë; me version të ri, një rresht që hap fletën', async () => {
    const { container } = render(<div />)
    await renderNotice()
    expect(container.ownerDocument.body).not.toHaveTextContent('është gati')

    fake.state = { status: 'available', release }
    const router = await renderNotice()
    await userEvent.click(screen.getByRole('button', { name: /Versioni 0\.16\.0 është gati/ }))
    expect(router.state.location.search).toBe('?perditesimi=1')
    expect(screen.getByRole('dialog', { name: 'Versioni 0.16.0' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mbyll' }))
    expect(router.state.location.search).toBe('')
  })

  it('te Sot: shkarkimi tregon përqindjen', async () => {
    fake.state = { status: 'downloading', release, progress: 0.456 }
    await renderNotice()
    expect(screen.getByRole('button', { name: /Versioni 0\.16\.0 është gati/ })).toHaveTextContent('Po shkarkohet · 46%')
  })

  it('fleta: çfarë ka të re, madhësia dhe "Përditëso"', async () => {
    fake.state = { status: 'available', release }
    const { sheet } = await renderSheet()
    expect(sheet).toHaveAccessibleName('Versioni 0.16.0')
    expect(within(sheet).getByRole('list', { name: 'Çfarë ka të re' })).toHaveTextContent('Përditësimi brenda app-it')
    expect(sheet).toHaveTextContent('27 MB')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Përditëso' }))
    expect(fake.update).toHaveBeenCalledTimes(1)
  })

  it('fleta: pa lejen e instalimit shpjegon lejen dhe e hap', async () => {
    fake.state = { status: 'permission', release }
    const { sheet } = await renderSheet()
    expect(sheet).toHaveTextContent('Instalo app të panjohura')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Lejo instalimin' }))
    expect(fake.allowInstall).toHaveBeenCalledTimes(1)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Përditëso' }))
    expect(fake.update).toHaveBeenCalledTimes(1)
  })

  it('fleta: shkarkimi ka shiritin e përparimit; instalimi thotë që app-i mbyllet', async () => {
    fake.state = { status: 'downloading', release, progress: 0.25 }
    const first = await renderSheet()
    expect(within(first.sheet).getByRole('progressbar', { name: 'Shkarkimi' })).toHaveAttribute('aria-valuenow', '25')
    expect(first.sheet).toHaveTextContent('Po shkarkohet · 25%')
    expect(within(first.sheet).queryByRole('button', { name: 'Përditëso' })).not.toBeInTheDocument()
    first.unmount()
    fake.state = { status: 'installing', release }
    const second = await renderSheet()
    expect(second.sheet).toHaveTextContent('Training Hub mbyllet për pak')
    expect(within(second.sheet).queryByRole('button')).toHaveAccessibleName('Mbyll')
  })

  it('fleta: çdo dështim thuhet me fjalë dhe provohet përsëri', async () => {
    fake.state = { status: 'failed', reason: 'mismatch', release }
    const { sheet } = await renderSheet()
    expect(sheet).toHaveTextContent('nuk përputhet')
    await userEvent.click(within(sheet).getByRole('button', { name: 'Provo përsëri' }))
    expect(fake.update).toHaveBeenCalledTimes(1)
  })

  it('fleta: me versionin e fundit, "Kontrollo tani" kontrollon pa pritur', async () => {
    fake.state = { status: 'current' }
    const { sheet } = await renderSheet()
    expect(sheet).toHaveAccessibleName('Përditësimi')
    expect(sheet).toHaveTextContent(`Ke versionin e fundit, ${__APP_VERSION__}.`)
    await userEvent.click(within(sheet).getByRole('button', { name: 'Kontrollo tani' }))
    expect(fake.check).toHaveBeenCalledWith({ force: true })
  })
})
