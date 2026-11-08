import { cn } from './cn'

describe('cn me temën e Vrullit', () => {
  it('madhësitë me emër zëvendësohen nga klasa e dhënë nga jashtë', () => {
    expect(cn('h-touch', 'h-12')).toBe('h-12')
    expect(cn('size-touch', 'size-12')).toBe('size-12')
    expect(cn('h-button-l w-full', 'h-touch')).toBe('w-full h-touch')
    expect(cn('min-h-row', 'min-h-14')).toBe('min-h-14')
    expect(cn('rounded-sm', 'rounded-pill')).toBe('rounded-pill')
  })

  it('një stil tipografie zëvendëson tjetrin', () => {
    expect(cn('type-caption', 'type-label')).toBe('type-label')
  })

  it('familja e fontit nuk ngatërrohet me peshën', () => {
    expect(cn('font-display font-bold', 'font-extrabold')).toBe('font-display font-extrabold')
  })

  it('ngjyrat e tokenave zëvendësojnë njëra-tjetrën', () => {
    expect(cn('text-ember-text', 'text-muted-foreground')).toBe('text-muted-foreground')
    expect(cn('bg-surface-2', 'bg-surface')).toBe('bg-surface')
  })
})
