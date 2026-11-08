import { Navigate, useLocation } from 'react-router'

/** Një rrugë e vjetër që ka kaluar diku tjetër, me parametrat e saj (p.sh. /trupi?pamja=volumi → /progresi/trupi). */
export function Moved({ to }: { to: string }) {
  const { search, hash } = useLocation()
  return <Navigate to={`${to}${search}${hash}`} replace />
}
