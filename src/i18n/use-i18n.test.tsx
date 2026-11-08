import { act, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { NBSP } from './format'
import { language } from './language'
import { useI18n } from './use-i18n'

// Numëron montimet: ndërrimi i gjuhës duhet të rivizatojë, jo të rinisë komponentin.
let mounts = 0

function Probe() {
  const { t, fmt } = useI18n()
  useEffect(() => {
    mounts += 1
  }, [])
  return (
    <p>
      {t('tab.programme')} · {t('sync.pending', { count: 2 })} · {fmt.unit(62.5, 'kg')}
    </p>
  )
}

describe('useI18n', () => {
  afterEach(() => language.set('sq'))

  it('ndërrimi i gjuhës ndryshon tekstet menjëherë, pa rinisje', () => {
    render(<Probe />)
    const text = screen.getByText(/Programi/)
    expect(text.textContent).toBe(`Programi · 2 ndryshime presin dërgimin · 62,5${NBSP}kg`)
    act(() => language.set('en'))
    expect(text.textContent).toBe(`Programme · 2 changes waiting to be sent · 62.5${NBSP}kg`)
    expect(mounts).toBe(1)
    expect(document.documentElement.lang).toBe('en-GB')
  })
})
