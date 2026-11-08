import { type FormEvent, type ReactNode, useId, useLayoutEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { VrullMark } from '@/components/ui/logo'
import { auth } from '@/data/app-data'
import { followDeviceLanguage, language } from '@/i18n/language'
import { useI18n } from '@/i18n/use-i18n'
import { APP_NAME } from '@/lib/app-name'
import { cn } from '@/lib/cn'
import { useOnline } from '@/lib/use-online'

// Hyrja (SPEC §3a, bordi "Hyrja · Hyr", V2-E1-17): logoja me emrin, titulli, emaili dhe fjalëkalimi,
// "Hyr" në fund. Llogaria krijohet nga admini; "Kam një kod ftese" vjen me Etapën 4 (bordi
// "Hyrja · Ftesa"). Pas hyrjes, porta (gate.tsx) e çon app-in te marrja e të dhënave dhe te hapat e parë.

const fieldClass = cn(inputClass, 'h-button text-[17px]')

export function LoginPage() {
  const { t } = useI18n()
  const errorId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const online = useOnline()

  // Para se të ketë llogari, gjuha ndjek telefonin (kur s'është zgjedhur më parë); para vizatimit, pa dridhje.
  useLayoutEffect(() => {
    followDeviceLanguage(language)
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

  const invalid = problem ? true : undefined
  const describedBy = problem ? errorId : undefined

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground">
      <div aria-hidden className="fixed inset-x-0 top-0 z-30 h-[var(--safe-top)] bg-background" />
      <form noValidate onSubmit={(event) => void submit(event)} className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <div className="flex flex-1 flex-col gap-7 px-4 pt-6">
          <div className="flex items-center gap-3">
            <VrullMark size={44} />
            <span className="type-display-s">{APP_NAME}</span>
          </div>

          <div className="flex flex-col gap-2.5 pt-7">
            <h1 className="type-display-m">{t('entry.login.title')}</h1>
            <p className="type-body text-muted-foreground">{t('entry.login.intro')}</p>
          </div>

          <div className="flex flex-col gap-[18px]">
            <LabelledField label={t('entry.login.email')}>
              {(id) => (
                <input
                  id={id}
                  type="email"
                  inputMode="email"
                  autoComplete="username email"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={invalid}
                  aria-describedby={describedBy}
                  className={fieldClass}
                />
              )}
            </LabelledField>
            <LabelledField label={t('entry.login.password')}>
              {(id) => (
                <div className="relative">
                  <input
                    id={id}
                    type={visible ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="go"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={describedBy}
                    className={cn(fieldClass, 'pr-14')}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setVisible((value) => !value)}
                    aria-label={t(visible ? 'entry.login.hidePassword' : 'entry.login.showPassword')}
                    aria-pressed={visible}
                    className="absolute top-1 right-1 text-muted-foreground"
                  >
                    <Icon name="syri" size={22} />
                  </Button>
                </div>
              )}
            </LabelledField>
            {problem ? (
              <p id={errorId} role="alert" className="flex items-start gap-2 type-caption text-danger">
                <Icon name="paralajmerim" size={18} />
                {problem}
              </p>
            ) : (
              <p className="type-caption text-muted-foreground">{t(online ? 'entry.login.firstTime' : 'entry.login.offline')}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 px-4 pt-3 pb-7">
          <Button type="submit" variant="primary" size="xl" disabled={busy || !email.trim() || !password}>
            {t(busy ? 'entry.login.busy' : 'entry.login.submit')}
          </Button>
          <p className="mt-2.5 text-center type-caption text-muted-foreground">{t('entry.login.inviteOnly')}</p>
        </div>
      </form>
    </div>
  )
}

/** Etiketa e bordit (`label`, gri) mbi fushën; fusha merr id-në nga etiketa. */
function LabelledField({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="type-label text-muted-foreground">
        {label}
      </label>
      {children(id)}
    </div>
  )
}
