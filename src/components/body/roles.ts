import type { Tone } from '@/body/model-math'

// Roli i një muskuli te një ushtrim (SPEC §11, funksioni 1): kryesorët me brand, ndihmësit gri.
// Një burim i vetëm për figurën 2D (`fill`), modelin 3D (`tone`) dhe legjendën (`swatch`).

export type MuscleRole = 'primary' | 'secondary'

export const MUSCLE_ROLE: Record<MuscleRole, { label: string; fill: string; swatch: string; tone: Tone }> = {
  primary: { label: 'Kryesor', fill: 'fill-brand', swatch: 'bg-brand', tone: { token: '--brand', alpha: 1 } },
  secondary: {
    label: 'Ndihmës',
    fill: 'fill-panel-muted-foreground/60',
    swatch: 'bg-panel-muted-foreground/60',
    tone: { token: '--panel-muted-foreground', alpha: 0.6 },
  },
}

/** Roli i një çelësi te një ushtrim; null kur muskuli nuk punon aty. */
export function roleOf(key: string, primary: string[], secondary: string[]): MuscleRole | null {
  return primary.includes(key) ? 'primary' : secondary.includes(key) ? 'secondary' : null
}
