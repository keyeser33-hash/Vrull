import { fireEvent, render, screen } from '@testing-library/react'
import { language } from '@/i18n'
import { TimeField } from './time-field'

describe('TimeField', () => {
  afterEach(() => language.set('sq'))

  it('shfaq orën me 24 orë, të plotë, në të dyja gjuhët; input-i i vërtetë mban vlerën', () => {
    const change = vi.fn()
    const { rerender } = render(<TimeField label="Ora" value="18:00" onChange={change} />)
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.queryByText(/PM/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Ora')).toHaveValue('18:00')
    language.set('en')
    rerender(<TimeField label="Time" value="07:05" onChange={change} />)
    expect(screen.getByText('07:05')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '09:30' } })
    expect(change).toHaveBeenCalledWith('09:30')
  })

  it('input-i mbulon gjithë kutinë 44 px, pa e prerë tekstin', () => {
    const { container } = render(<TimeField label="Ora" value="07:00" onChange={() => {}} className="w-[84px]" />)
    expect(container.firstElementChild).toHaveClass('h-touch')
    expect(screen.getByLabelText('Ora')).toHaveClass('absolute', 'inset-0', 'opacity-0')
    expect(container.querySelector('[data-time-text]')).toHaveClass('whitespace-nowrap')
  })
})
