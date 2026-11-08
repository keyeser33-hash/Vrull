import { useNavigate, useOutletContext, useSearchParams } from 'react-router'

// Adresat e ndërtuesit të programit dhe fletët e tij (?ndrysho=...).
//
// Ndërtuesi hapet edhe nga hapat e parë ("Ndërto timin", V2-E1-10): aty jeton nën `/fillimi/programi`,
// brenda faqes së hapave, që i jep `finish` me Outlet context (pesha, ditët dhe oraret janë ende te
// ajo faqe). Te app-i (korniza) context-i mungon dhe adresat janë ato të `/programi/editori`.

export const editorPath = (programId: string) => `/programi/editori/${programId}`
export const dayPath = (programId: string, dayId: string) => `${editorPath(programId)}/dita/${dayId}`
export const slotPath = (programId: string, slotId: string) => `${editorPath(programId)}/sloti/${slotId}`

/** Hapat e parë, kur ndërtuesi hapet prej tyre: mbyll hapat me programin e ndërtuar si aktiv. */
export interface OnboardingBuild {
  finish: (programId: string) => Promise<void>
}

export const ONBOARDING_BUILD = '/fillimi/programi'

/** Adresat e ndërtuesit aty ku është hapur (app-i ose hapat e parë) dhe `finish` i hapave. */
export function useEditorPaths() {
  const onboarding = useOutletContext<OnboardingBuild | undefined>() ?? null
  const base = onboarding ? ONBOARDING_BUILD : '/programi/editori'
  return {
    onboarding,
    programmes: onboarding ? ONBOARDING_BUILD : '/programet',
    program: (programId: string) => `${base}/${programId}`,
    day: (programId: string, dayId: string) => `${base}/${programId}/dita/${dayId}`,
    slot: (programId: string, slotId: string) => `${base}/${programId}/sloti/${slotId}`,
  }
}

/** Hap një fletë duke ruajtur parametrat e tjerë (p.sh. nivelin e zgjedhur). */
export function useSheet() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  return {
    params,
    sheet: params.get('ndrysho'),
    open: (name: string, extra: Record<string, string> = {}) =>
      setParams((current) => {
        current.set('ndrysho', name)
        for (const [key, value] of Object.entries(extra)) current.set(key, value)
        return current
      }),
    close: () => navigate(-1),
  }
}
