import { useNavigate, useSearchParams } from 'react-router'

// Adresat e editorit të programit dhe fletët e tij (?ndrysho=...).

export const editorPath = (programId: string) => `/programi/editori/${programId}`
export const dayPath = (programId: string, dayId: string) => `${editorPath(programId)}/dita/${dayId}`
export const slotPath = (programId: string, slotId: string) => `${editorPath(programId)}/sloti/${slotId}`

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

