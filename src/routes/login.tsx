import { type FormEvent, useEffect, useState, useSyncExternalStore } from 'react'
import { BodyFigure } from '@/components/body/body-figure'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Field } from '@/components/ui/field'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { auth } from '@/data/app-data'
import { cn } from '@/lib/cn'
import { applyPanelTop } from '@/lib/theme'

// Hyrja (SPEC §3a, hapi 1), varianti C i aprovuar më 07.11.2026: sipër `panel` me figurën e
// trupit (si te Sot), poshtë formulari si fletë, me veprimin kryesor 56 px në fund.
// Llogaria krijohet te paneli i Supabase; këtu vetëm hyhet. Pas hyrjes, porta (gate.tsx)
// e çon app-in te marrja e të dhënave dhe te hapat e para.

// Muskujt e Stërvitjes 1 të Shortcut to Size: gjoksi, tricepsi, pulpat.
const HERO_PRIMARY = ['pectoralis_major_sternocostal', 'pectoralis_major_clavicular', 'triceps_brachii', 'gastrocnemius', 'soleus']

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine)

  // Pjesa e sipërme është `panel` në çdo temë: ora dhe bateria mbeten të lexueshme.
  useEffect(() => {
    applyPanelTop(true)
    return () => applyPanelTop(false)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true)
    setProblem(null)
    const result = await auth.signIn(email.trim(), password)
    setBusy(false)
    if (!result.ok) setProblem(result.message)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-panel">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-panel" />
      <section className="flex min-h-0 flex-1 flex-col px-6 pt-[calc(var(--safe-top)+20px)] pb-12 text-panel-foreground [@media(max-height:640px)]:flex-none">
        <div className="mx-auto flex w-full max-w-[480px] items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-10 rounded-lg" />
          <span className="text-lg leading-7 font-semibold tracking-[-0.01em]">Training Hub</span>
        </div>
        {/* Me tastierën hapur ekrani ulet: figura dhe rreshti i saj fshihen, që fushat të mbeten në pamje. */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-6 [@media(max-height:640px)]:hidden">
          <BodyFigure primary={HERO_PRIMARY} scale={1.75} className="max-h-full" />
        </div>
        <p className="mx-auto w-full max-w-[480px] text-center text-sm leading-5 text-panel-muted-foreground [@media(max-height:640px)]:hidden">
          Shortcut to Size, peshat dhe ushqimi. Edhe pa internet.
        </p>
      </section>

      <form
        noValidate
        onSubmit={(event) => void submit(event)}
        className="relative -mt-6 rounded-t-xl border-t border-border bg-background px-4 pt-6 pb-[calc(var(--safe-bottom)+24px)] text-foreground"
      >
        <div className="mx-auto flex w-full max-w-[480px] flex-col gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Hyr</h1>
            <p className="mt-1 text-base leading-6 text-muted-foreground">
              Hyr me llogarinë tënde. Interneti duhet vetëm këtë herë.
            </p>
          </div>
          <Field label="Email">
            {(props) => (
              <input
                {...props}
                type="email"
                inputMode="email"
                autoComplete="username email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={problem ? true : undefined}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="Fjalëkalimi">
            {(props) => (
              <div className="relative">
                <input
                  {...props}
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={problem ? true : undefined}
                  className={cn(inputClass, 'pr-12')}
                />
                <button
                  type="button"
                  onClick={() => setVisible((value) => !value)}
                  aria-label={visible ? 'Fshih fjalëkalimin' : 'Shfaq fjalëkalimin'}
                  aria-pressed={visible}
                  className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'absolute top-0 right-0')}
                >
                  <Icon name="syri" size={20} />
                </button>
              </div>
            )}
          </Field>
          {problem ? (
            <p role="alert" className="text-sm leading-5 text-destructive">
              {problem}
            </p>
          ) : !online ? (
            <p className="text-sm leading-5 text-muted-foreground">Pa internet. Hyrja kërkon internet vetëm herën e parë.</p>
          ) : null}
          <Button type="submit" variant="brand" size="xl" disabled={busy || !email.trim() || !password}>
            {busy ? 'Po hyn' : 'Hyr'}
          </Button>
        </div>
      </form>
    </div>
  )
}
