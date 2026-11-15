import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/use-i18n'

// Adresa e panjohur (brenda kornizës) dhe gabimi i vizatimit (`errorElement` në rrënjë): një fjali e madhe,
// një rresht shpjegimi dhe veprimi kryesor, me tokenat e Vrullit; pa faqen e React Router.

function Message({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return (
    <section className="flex min-h-[60dvh] flex-1 flex-col justify-center gap-[18px]">
      <div className="flex flex-col gap-3">
        <h1 className="type-display-l">{title}</h1>
        <p className="type-body text-muted-foreground">{text}</p>
      </div>
      <Button variant="primary" size="xl" onClick={onAction}>
        {action}
      </Button>
    </section>
  )
}

export function NotFoundPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return <Message title={t('notFound.title')} text={t('notFound.text')} action={t('notFound.action')} onAction={() => navigate('/', { replace: true })} />
}

/** `errorElement` i rrënjës: një gabim vizatimi nuk tregon më faqen e React Router. */
export function CrashPage() {
  const { t } = useI18n()
  return (
    <main className="flex min-h-dvh flex-col bg-background px-5 py-8 text-foreground">
      <Message title={t('crash.title')} text={t('crash.text')} action={t('crash.action')} onAction={() => window.location.assign('/')} />
    </main>
  )
}
