import { type FormEvent, useState } from 'react'
import { FocusLayout } from '@/components/layout/focus-layout'
import { Button } from '@/components/ui/button'
import { buttonVariants } from '@/components/ui/button-variants'
import { Field } from '@/components/ui/field'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { auth } from '@/data/app-data'
import { cn } from '@/lib/cn'

// Hyrja (SPEC §3a, hapi 1). Llogaria krijohet te paneli i Supabase; këtu vetëm hyhet.
// Pas hyrjes, porta (gate.tsx) e çon app-in te marrja e të dhënave dhe te hapat e para.
export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setProblem(null)
    const result = await auth.signIn(email, password)
    setBusy(false)
    if (!result.ok) setProblem(result.message)
  }

  return (
    <FocusLayout>
      <div className="mt-10 mb-8">
        <img src="/favicon.svg" alt="" className="size-12 rounded-xl" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">Training Hub</h1>
        <p className="mt-2 text-base leading-6 text-muted-foreground">
          Hyr me llogarinë që krijove te Supabase. Interneti duhet vetëm këtë herë.
        </p>
      </div>
      <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
        <Field label="Email">
          {(props) => (
            <input
              {...props}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
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
        ) : null}
        <Button type="submit" variant="brand" disabled={busy} className="w-full">
          {busy ? 'Po hyn' : 'Hyr'}
        </Button>
      </form>
    </FocusLayout>
  )
}
