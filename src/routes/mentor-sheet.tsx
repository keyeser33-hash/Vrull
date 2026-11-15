import { Sheet } from '@/components/layout/sheet'
import { store, useLocalQuery } from '@/data/app-data'
import { mentorNoteFor } from '@/data/mentor'
import { useI18n } from '@/i18n/use-i18n'

// Shënimi i mentorit (V55, V57): rrethi "Mentori" ose "Plani" te Sot hap titullin, tekstin dhe hapat e shënimit të javës.
// Mentori e shkruan; telefoni vetëm e lexon.

export function MentorSheet({ monday, onClose }: { monday: string; onClose: () => void }) {
  const { t } = useI18n()
  const note = useLocalQuery(() => mentorNoteFor(store, monday), [monday])
  if (!note) return null
  return (
    <Sheet title={note.title} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-4">
        <p className="type-body-l whitespace-pre-line text-foreground">{note.body}</p>
        {note.steps.length > 0 ? (
          <section aria-labelledby="mentor-steps" className="flex flex-col gap-2">
            <h3 id="mentor-steps" className="type-label text-muted-foreground">
              {t('sot.mentor.steps')}
            </h3>
            <ol className="m-0 flex list-decimal flex-col gap-1.5 pl-5 type-body">
              {note.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}
        {note.learnTitle && note.learnBody ? (
          <section aria-labelledby="mentor-learn" className="flex flex-col gap-1">
            <h3 id="mentor-learn" className="type-label text-muted-foreground">
              {t('sot.mentor.learn')}
            </h3>
            <p className="type-body-strong">{note.learnTitle}</p>
            <p className="type-body text-muted-foreground">{note.learnBody}</p>
          </section>
        ) : null}
      </div>
    </Sheet>
  )
}
