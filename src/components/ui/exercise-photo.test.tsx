import { act, render, screen } from '@testing-library/react'
import { language } from '@/i18n/language'
import { ExercisePhoto } from './exercise-photo'

// Foto e ushtrimit sipas ID-së së free-exercise-db (SPEC §0.3a): bardh e zi, nga app-i për Shortcut to
// Size; pa foto, "Pa foto" (kurrë një imazh i shpikur).

describe('ExercisePhoto', () => {
  afterEach(() => act(() => language.set('sq')))

  it('foto e paketuar në app, bardh e zi', () => {
    const { container } = render(<ExercisePhoto libraryId="Barbell_Bench_Press_-_Medium_Grip" />)
    const image = container.querySelector('img')
    expect(image).toHaveAttribute('src', '/exercise-photos/Barbell_Bench_Press_-_Medium_Grip.jpg')
    expect(image).toHaveClass('grayscale')
  })

  it('pa ID në bibliotekë: "Pa foto", edhe në madhësinë katrore, dhe në anglisht', () => {
    const { rerender } = render(<ExercisePhoto libraryId={null} />)
    expect(screen.getByText('Pa foto')).toBeInTheDocument()
    rerender(<ExercisePhoto libraryId={null} size="square" className="size-12" />)
    expect(screen.getByText('Pa foto').parentElement?.parentElement).toHaveClass('size-12')
    act(() => language.set('en'))
    expect(screen.getByText('No photo')).toBeInTheDocument()
  })
})
