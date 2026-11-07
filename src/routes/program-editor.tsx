import { useId, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { LibraryPicker } from '@/components/forms/library-picker'
import { ValueStepper } from '@/components/forms/value-stepper'
import { Group, LinkRow, Row } from '@/components/layout/list-group'
import { BackButton } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { Icon } from '@/components/ui/icons'
import { store, useLocalQuery } from '@/data/app-data'
import {
  addBlock,
  addDay,
  addSlotFromLibrary,
  copyBlock,
  copyWeek,
  deleteProgram,
  duplicateProgram,
  moveBlock,
  moveDay,
  programEditor,
  programList,
  type ProgramEditorView,
  removeBlock,
  removeDay,
  renameDay,
  renameProgram,
  startProgram,
  updateBlock,
} from '@/data/program-editor'
import { switchProgram } from '@/data/training'
import { dayPath, editorPath, slotPath, useSheet } from './editor-nav'

// Editori i programeve (TH-11), varianti A (07.11.2026; referencat nga Mobbin: Tonal për
// blloqet, Hevy dhe Bevel për ditën me ushtrimet). Tri nivele ekranesh: lista e programeve,
// programi (blloqet dhe ditët), dita (ushtrimet). Ushtrimi në program ka ekranin e vet
// (slot-editor.tsx). Fletët hapen me ?ndrysho=..., që butoni mbrapa i Android-it t'i mbyllë.

const weeksText = (weeks: number) => (weeks === 1 ? '1 javë' : `${weeks} javë`)
const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`

export function NotFound({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-4">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu" />
      </header>
      <p className="text-sm leading-5 text-muted-foreground">{text}</p>
    </div>
  )
}

export function ProgramsPage() {
  const programs = useLocalQuery(() => programList(store), [])
  const { sheet, open, close } = useSheet()
  const navigate = useNavigate()
  return (
    <div className="flex flex-col gap-5">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te programi" />
      </header>
      <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em]">Programet</h1>
      {programs === undefined ? (
        <div aria-hidden className="h-40 rounded-xl bg-skeleton" />
      ) : programs.length === 0 ? (
        <p className="text-sm leading-5 text-muted-foreground">Ende pa programe. Krijo të parin.</p>
      ) : (
        <Group title="Programet e tua">
          {programs.map((program) => (
            <LinkRow
              key={program.id}
              to={editorPath(program.id)}
              label={program.name}
              detail={[program.active ? 'Aktiv' : null, count(program.blocks, 'bllok', 'blloqe'), count(program.days, 'ditë', 'ditë')]
                .filter(Boolean)
                .join(' · ')}
            />
          ))}
        </Group>
      )}
      <Button variant="outline" className="w-full" onClick={() => open('i-ri')}>
        <Icon name="shto" size={20} />
        Program i ri
      </Button>
      {sheet === 'i-ri' ? (
        <NameSheet
          title="Program i ri"
          label="Emri i programit"
          initial=""
          action="Krijo"
          note="Nis me një bllok 4-javor dhe një ditë; i shton ushtrimet pas krijimit."
          onClose={close}
          onSave={async (name) => {
            const programId = await startProgram(store, name)
            navigate(editorPath(programId), { replace: true })
          }}
        />
      ) : null}
    </div>
  )
}

export function ProgramEditorPage() {
  const { programId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const { params, sheet, open, close } = useSheet()
  const navigate = useNavigate()
  if (view === undefined) return <h1 className="sr-only">Editori i programit</h1>
  if (view === null) return <NotFound text="Ky program nuk gjendet më." />
  const totalWeeks = view.blocks.reduce((total, block) => total + block.weeks, 0)
  const block = view.blocks.find((candidate) => candidate.id === params.get('blloku'))

  async function newBlock(current: ProgramEditorView) {
    const last = current.blocks.at(-1)
    const blockId = await addBlock(store, current.id, { name: `Blloku ${current.blocks.length + 1}`, weeks: last?.weeks ?? 4 })
    open('blloku', { blloku: blockId })
  }

  async function newDay(current: ProgramEditorView) {
    const dayId = await addDay(store, current.id, `Dita ${current.days.length + 1}`)
    navigate(dayPath(current.id, dayId))
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu" />
      </header>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm leading-5 text-muted-foreground">{view.active ? 'Programi aktiv' : 'Program'}</span>
          <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em] break-words">{view.name}</h1>
          <span className="text-sm leading-5 text-muted-foreground tabular-nums">
            {count(view.blocks.length, 'bllok', 'blloqe')} · {weeksText(totalWeeks)} · {count(view.days.length, 'ditë', 'ditë')}
          </span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Riemërto programin" className="text-foreground" onClick={() => open('emri')}>
          <Icon name="edito" size={22} />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Group title="Blloqet">
          {view.blocks.map((entry) => (
            <Row key={entry.id} label={entry.name} value={weeksText(entry.weeks)} onClick={() => open('blloku', { blloku: entry.id })} />
          ))}
        </Group>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => void newBlock(view)}>
            <Icon name="shto" size={20} />
            Shto bllok
          </Button>
          <Button variant="outline" onClick={() => open('kopjo-javen')}>
            <Icon name="kopjo" size={20} />
            Kopjo javën
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Group title="Ditët">
          {view.days.map((day) => (
            <LinkRow
              key={day.id}
              to={dayPath(view.id, day.id)}
              label={day.name}
              detail={`Dita ${day.number} · ${count(day.slots.length, 'ushtrim', 'ushtrime')}`}
            />
          ))}
        </Group>
        <Button variant="outline" className="w-full" onClick={() => void newDay(view)}>
          <Icon name="shto" size={20} />
          Shto ditë
        </Button>
      </div>

      <Group title="Programi">
        {view.active ? null : (
          <Row label="Bëje programin aktiv" detail="Stërvitja e radhës vjen nga ky program" onClick={() => void switchProgram(store, view.id)} action />
        )}
        <Row
          label="Kopjo programin"
          detail="Një kopje për ta ndryshuar pa prekur këtë"
          onClick={() =>
            void duplicateProgram(store, view.id, `${view.name} (kopje)`).then((copyId) => navigate(editorPath(copyId)))
          }
          action
        />
        <Row
          label="Fshi programin"
          detail={view.active ? 'Programi aktiv nuk fshihet' : 'Seancat e kaluara mbeten te historia'}
          disabled={view.active}
          onClick={() => open('fshi')}
          action
        />
      </Group>

      {sheet === 'emri' ? (
        <NameSheet
          title="Emri i programit"
          label="Emri"
          initial={view.name}
          action="Ruaj"
          onClose={close}
          onSave={async (name) => {
            await renameProgram(store, view.id, name)
            close()
          }}
        />
      ) : null}
      {sheet === 'blloku' && block ? <BlockSheet view={view} blockId={block.id} onClose={close} /> : null}
      {sheet === 'kopjo-javen' ? <CopyWeekSheet view={view} onClose={close} /> : null}
      {sheet === 'fshi' && !view.active ? (
        <ConfirmSheet
          title="Fshi programin"
          text={`${view.name} fshihet me blloqet, ditët dhe ushtrimet e tij. Seancat e kaluara mbeten te historia.`}
          action="Fshi programin"
          onClose={close}
          onConfirm={async () => {
            await deleteProgram(store, view.id)
            navigate(-2)
          }}
        />
      ) : null}
    </div>
  )
}

function BlockSheet({ view, blockId, onClose }: { view: ProgramEditorView; blockId: string; onClose: () => void }) {
  const index = view.blocks.findIndex((candidate) => candidate.id === blockId)
  const block = view.blocks[index]
  const [name, setName] = useState(block.name)
  const [weeks, setWeeks] = useState(block.weeks)
  const [confirm, setConfirm] = useState(false)
  const nameId = useId()
  const only = view.blocks.length === 1
  const clampWeeks = (value: number) => Math.min(12, Math.max(1, value))

  async function save() {
    await updateBlock(store, blockId, { name: name.trim() || block.name, weeks })
    onClose()
  }

  return (
    <Sheet title={block.name} onClose={onClose}>
      <label htmlFor={nameId} className="text-sm leading-5 font-medium">
        Emri
      </label>
      <input id={nameId} value={name} maxLength={40} autoComplete="off" onChange={(event) => setName(event.currentTarget.value)} className={inputClass} />
      <ValueStepper
        label="Javët"
        text={String(weeks)}
        inputMode="numeric"
        minusLabel="Një javë më pak"
        plusLabel="Një javë më shumë"
        onMinus={() => setWeeks((value) => clampWeeks(value - 1))}
        onPlus={() => setWeeks((value) => clampWeeks(value + 1))}
        onCommit={(text) => {
          const value = Number(text)
          if (Number.isInteger(value) && value >= 1 && value <= 12) setWeeks(value)
        }}
      />
      <Button onClick={() => void save()}>Ruaj</Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => void moveBlock(store, blockId, -1)}>
          <Icon name="chevron-lart" size={20} />
          Lart
        </Button>
        <Button variant="outline" disabled={index === view.blocks.length - 1} onClick={() => void moveBlock(store, blockId, 1)}>
          <Icon name="chevron-poshte" size={20} />
          Poshtë
        </Button>
      </div>
      <Button variant="outline" onClick={() => void copyBlock(store, blockId).then(onClose)}>
        <Icon name="kopjo" size={20} />
        Kopjo bllokun
      </Button>
      {confirm ? (
        <div role="alert" className="flex flex-col gap-2 rounded-md border border-destructive p-3">
          <p className="text-sm leading-5">Ndryshimet e ushtrimeve vetëm për {block.name} fshihen bashkë me të.</p>
          <Button variant="destructive" onClick={() => void removeBlock(store, blockId).then(onClose)}>
            Po, fshije
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="text-destructive" disabled={only} onClick={() => setConfirm(true)}>
          {only ? 'Blloku i vetëm nuk fshihet' : 'Fshi bllokun'}
        </Button>
      )}
    </Sheet>
  )
}

function CopyWeekSheet({ view, onClose }: { view: ProgramEditorView; onClose: () => void }) {
  const weeks = view.blocks.flatMap((block) =>
    Array.from({ length: block.weeks }, (_, index) => ({ value: `${block.id}:${index + 1}`, label: `${block.name} · Java ${index + 1}` })),
  )
  const [from, setFrom] = useState(weeks[0]?.value ?? '')
  const [to, setTo] = useState(weeks[1]?.value ?? weeks[0]?.value ?? '')
  const fromId = useId()
  const toId = useId()
  const parse = (value: string) => {
    const [blockId, week] = value.split(':')
    return { blockId, week: Number(week) }
  }
  return (
    <Sheet title="Kopjo javën" onClose={onClose}>
      <p className="text-sm leading-5 text-muted-foreground">
        Ndryshimet e një jave (ushtrimi, setet, receta, teknika) kalojnë te java tjetër dhe zëvendësojnë ato që kishte.
      </p>
      <label htmlFor={fromId} className="text-sm leading-5 font-medium">
        Nga
      </label>
      <select id={fromId} value={from} onChange={(event) => setFrom(event.currentTarget.value)} className={inputClass}>
        {weeks.map((week) => (
          <option key={week.value} value={week.value}>
            {week.label}
          </option>
        ))}
      </select>
      <label htmlFor={toId} className="text-sm leading-5 font-medium">
        Te
      </label>
      <select id={toId} value={to} onChange={(event) => setTo(event.currentTarget.value)} className={inputClass}>
        {weeks.map((week) => (
          <option key={week.value} value={week.value}>
            {week.label}
          </option>
        ))}
      </select>
      <Button disabled={from === to} onClick={() => void copyWeek(store, view.id, parse(from), parse(to)).then(onClose)}>
        Kopjo
      </Button>
    </Sheet>
  )
}

export function DayEditorPage() {
  const { programId = '', dayId = '' } = useParams()
  const view = useLocalQuery(() => programEditor(store, programId), [programId])
  const { sheet, open, close } = useSheet()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if (view === undefined) return <h1 className="sr-only">Dita</h1>
  const index = view?.days.findIndex((candidate) => candidate.id === dayId) ?? -1
  const day = view?.days[index]
  if (!view || !day) return <NotFound text="Kjo ditë nuk gjendet më." />
  const only = view.days.length === 1

  return (
    <div className="flex flex-col gap-6">
      <header className="flex min-h-11 items-center">
        <BackButton label="Kthehu te programi" />
      </header>
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-sm leading-5 text-muted-foreground">
            {view.name} · Dita {day.number}
          </span>
          <h1 className="text-3xl leading-9 font-bold tracking-[-0.025em] break-words">{day.name}</h1>
        </div>
        <Button variant="ghost" size="icon" aria-label="Riemërto ditën" className="text-foreground" onClick={() => open('emri')}>
          <Icon name="edito" size={22} />
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {day.slots.length === 0 ? (
          <p className="text-sm leading-5 text-muted-foreground">Ende pa ushtrime. Shto të parin nga biblioteka.</p>
        ) : (
          <Group title="Ushtrimet">
            {day.slots.map((slot, position) => (
              <LinkRow
                key={slot.id}
                to={slotPath(view.id, slot.id)}
                label={`${position + 1}. ${slot.name}`}
                detail={`${count(slot.sets, 'set', 'sete')} · pushim ${slot.restSeconds} s`}
              />
            ))}
          </Group>
        )}
        <Button variant="outline" className="w-full" onClick={() => open('shto')}>
          <Icon name="shto" size={20} />
          Shto ushtrim
        </Button>
      </div>

      <Group title="Dita">
        <Row label="Zhvendose lart" disabled={index === 0} onClick={() => void moveDay(store, day.id, -1)} action />
        <Row label="Zhvendose poshtë" disabled={index === view.days.length - 1} onClick={() => void moveDay(store, day.id, 1)} action />
        <Row
          label="Fshi ditën"
          detail={only ? 'Dita e vetme nuk fshihet' : undefined}
          disabled={only}
          onClick={() => open('fshi')}
          action
        />
      </Group>

      {sheet === 'emri' ? (
        <NameSheet
          title="Emri i ditës"
          label="Emri"
          initial={day.name}
          action="Ruaj"
          onClose={close}
          onSave={async (name) => {
            await renameDay(store, day.id, name)
            close()
          }}
        />
      ) : null}
      {sheet === 'shto' ? (
        <Sheet title="Shto ushtrim" onClose={close}>
          <p className="text-sm leading-5 text-muted-foreground">Del i fundit në {day.name}, me 3 sete. Setet, receta dhe teknika ndryshohen pas shtimit.</p>
          <LibraryPicker
            busy={busy}
            onPick={(item) => {
              setBusy(true)
              void addSlotFromLibrary(store, day.id, item).then(() => {
                setBusy(false)
                close()
              })
            }}
          />
        </Sheet>
      ) : null}
      {sheet === 'fshi' && !only ? (
        <ConfirmSheet
          title="Fshi ditën"
          text={`${day.slots.length > 0 ? `${day.name} fshihet me ushtrimet e saj.` : `${day.name} fshihet.`} Seancat e kaluara mbeten te historia.`}
          action="Fshi ditën"
          onClose={close}
          onConfirm={async () => {
            await removeDay(store, day.id)
            navigate(-2)
          }}
        />
      ) : null}
    </div>
  )
}

export function NameSheet({
  title,
  label,
  initial,
  action,
  note,
  onSave,
  onClose,
}: {
  title: string
  label: string
  initial: string
  action: string
  note?: string
  onSave: (name: string) => Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState(initial)
  const [problem, setProblem] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputId = useId()
  const problemId = useId()
  async function save() {
    if (!name.trim()) {
      setProblem('Shkruaj një emër.')
      return
    }
    setBusy(true)
    await onSave(name.trim())
  }
  return (
    <Sheet title={title} onClose={onClose}>
      {note ? <p className="text-sm leading-5 text-muted-foreground">{note}</p> : null}
      <label htmlFor={inputId} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <input
        id={inputId}
        value={name}
        maxLength={60}
        autoComplete="off"
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? problemId : undefined}
        onChange={(event) => (setName(event.currentTarget.value), setProblem(null))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void save()
        }}
        className={inputClass}
      />
      {problem ? (
        <p id={problemId} role="alert" className="text-sm leading-5 text-destructive">
          {problem}
        </p>
      ) : null}
      <Button disabled={busy} onClick={() => void save()}>
        {action}
      </Button>
    </Sheet>
  )
}

export function ConfirmSheet({
  title,
  text,
  action,
  onConfirm,
  onClose,
}: {
  title: string
  text: string
  action: string
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-base leading-6">{text}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onClose}>
          Anulo
        </Button>
        <Button
          variant="destructive"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void onConfirm()
          }}
        >
          {action}
        </Button>
      </div>
    </Sheet>
  )
}
