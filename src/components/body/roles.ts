import type { Tone } from '@/body/model-math'

// Roli i një muskuli te një ushtrim (SPEC §11, funksioni 1): kryesorët me prush, ndihmësit gri.
// Një burim i vetëm për figurën 2D (`fill`), modelin 3D (`tone`) dhe legjendën (`swatch`); emri i
// rolit vjen nga katalogu.

export type MuscleRole = 'primary' | 'secondary'

export const MUSCLE_ROLE: Record<MuscleRole, { fill: string; swatch: string; tone: Tone }> = {
  primary: { fill: 'fill-ember', swatch: 'bg-ember', tone: { token: '--ember', alpha: 1 } },
  secondary: {
    fill: 'fill-muted-foreground/60',
    swatch: 'bg-muted-foreground/60',
    tone: { token: '--muted-foreground', alpha: 0.6 },
  },
}

/** Roli i një çelësi te një ushtrim; null kur muskuli nuk punon aty. */
export function roleOf(key: string, primary: string[], secondary: string[]): MuscleRole | null {
  return primary.includes(key) ? 'primary' : secondary.includes(key) ? 'secondary' : null
}
