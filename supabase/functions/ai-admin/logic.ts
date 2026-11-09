// Kufiri i AI-së te Admini (V42, V2-E2-17; bordi V22-Admin-Kufiri), pa Deno dhe pa Supabase: përmbledhja e
// muajit për çdo person (kostoja sipas veçorisë, kufiri), kontrolli i një ndryshimi të kufirit dhe ruajtja e
// tij. index.ts e lidh me bazën; vetëm admini (app_metadata.vrull_admin) e thërret.

export const LIMIT_STEP_EUR = 5
export const MAX_LIMIT_EUR = 500

export const ADMIN_FEATURES = ['food_text', 'food_photo', 'supplement_label', 'program_pdf', 'explain'] as const
export type AdminFeature = (typeof ADMIN_FEATURES)[number]

export interface AdminPerson {
  id: string
  name: string
  isAdmin: boolean
  limitEur: number
  spentEur: number
  byFeature: Record<AdminFeature, { eur: number; count: number }>
}

export interface AuthPerson {
  id: string
  email: string | null
  name: string | null
  isAdmin: boolean
}

const round2 = (value: number) => Math.round(value * 100) / 100
/** Kostot e vogla (0,001 € për mesazh) mbahen me katër shifra; ekrani i formaton. */
const round4 = (value: number) => Math.round(value * 10_000) / 10_000
const isTestUser = (email: string | null) => !!email && /^e2e-.*@example\.invalid$/.test(email)

/** Personat e projektit me koston e muajit dhe kufirin; llogaritë e provës mbeten jashtë. */
export function summarize({
  people,
  usage,
  limits,
  defaultLimitEur,
}: {
  people: AuthPerson[]
  usage: { user_id: string; feature: string; cost_eur: number | string; input_tokens: number | string; output_tokens: number | string }[]
  limits: { user_id: string; monthly_eur: number | string }[]
  defaultLimitEur: number
}): AdminPerson[] {
  const limitBy = new Map(limits.map((row) => [row.user_id, Number(row.monthly_eur)]))
  return people
    .filter((person) => !isTestUser(person.email))
    .map((person) => {
      const byFeature = Object.fromEntries(ADMIN_FEATURES.map((feature) => [feature, { eur: 0, count: 0 }])) as AdminPerson['byFeature']
      let spent = 0
      for (const row of usage) {
        // Rezervimi i një thirrjeje që është ende në punë (pa tokena) nuk është shpenzim.
        if (row.user_id !== person.id || (!Number(row.input_tokens) && !Number(row.output_tokens))) continue
        const eur = Number(row.cost_eur) || 0
        spent += eur
        const feature = (ADMIN_FEATURES as readonly string[]).includes(row.feature) ? (row.feature as AdminFeature) : null
        if (feature) byFeature[feature] = { eur: byFeature[feature].eur + eur, count: byFeature[feature].count + 1 }
      }
      for (const feature of ADMIN_FEATURES) byFeature[feature].eur = round4(byFeature[feature].eur)
      const limit = limitBy.get(person.id)
      return {
        id: person.id,
        name: person.name?.trim() || person.email?.split('@')[0] || person.id.slice(0, 8),
        isAdmin: person.isAdmin,
        limitEur: limit !== undefined && Number.isFinite(limit) ? limit : defaultLimitEur,
        spentEur: round4(spent),
        byFeature,
      }
    })
    .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name))
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AdminRequest = { action: 'list' } | { action: 'set'; userId: string; limitEur: number }

/** Kërkesa e app-it: lista, ose një kufi i ri (0–500 €, me dy shifra pas presjes). */
export function parseAdminRequest(raw: unknown): AdminRequest | null {
  if (typeof raw !== 'object' || raw === null) return null
  const value = raw as Record<string, unknown>
  if (value.action === 'list') return { action: 'list' }
  if (value.action !== 'set' || typeof value.userId !== 'string' || !UUID.test(value.userId)) return null
  const limit = value.limitEur
  if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0 || limit > MAX_LIMIT_EUR) return null
  return { action: 'set', userId: value.userId, limitEur: round2(limit) }
}

/** Rreshtat e ai_limits (index.ts i lidh me bazën me çelësin sekret; një gabim hidhet si përjashtim). */
export interface LimitStore {
  /** Rreshti i gjallë i personit, në mos ka asnjë null. */
  find(userId: string): Promise<{ id: string } | null>
  update(id: string, limitEur: number): Promise<void>
  insert(userId: string, limitEur: number): Promise<void>
}

/** Kufiri i ri: ndryshon rreshtin e gjallë të personit, ose e shton kur nuk ka (një rresht për person). */
export async function saveLimit(store: LimitStore, userId: string, limitEur: number): Promise<void> {
  const existing = await store.find(userId)
  if (existing) await store.update(existing.id, limitEur)
  else await store.insert(userId, limitEur)
}

/** Përdoruesi i Auth-it siç e kthen listUsers. */
export interface AuthUser {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
  app_metadata?: Record<string, unknown> | null
}

const textOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * Personat për përmbledhjen: emri nga user_metadata (name, pastaj full_name; vetëm për t'u treguar, sepse
 * përdoruesi e ndryshon vetë), admini vetëm nga app_metadata, që e shkruan serveri.
 */
export function authPeople(users: readonly AuthUser[]): AuthPerson[] {
  return users.map((user) => ({
    id: user.id,
    email: user.email ?? null,
    name: textOf(user.user_metadata?.name) ?? textOf(user.user_metadata?.full_name),
    isAdmin: user.app_metadata?.vrull_admin === true,
  }))
}
