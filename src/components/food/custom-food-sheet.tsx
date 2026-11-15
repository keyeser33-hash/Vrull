import { useId, useState } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { store } from '@/data/app-data'
import { createCustomFood } from '@/data/foods'
import type { MessageKey } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { parseGrams } from '@/routes/nutrition-format'

// Ushqimi i ri (SPEC §9, TH-15): emri, kcal dhe makrot për 100 g, porcioni opsional. Fleta hapet nga "Ushqim i ri" te
// kërkimi dhe nga barkodi që nuk gjendet; pas ruajtjes ushqimi hapet te fleta e sasisë. Tekstet 'food.*'.

const FIELDS = [
  { key: 'kcal', label: 'food.field.kcal' },
  { key: 'proteinG', label: 'food.field.protein' },
  { key: 'carbsG', label: 'food.field.carbs' },
  { key: 'fatG', label: 'food.field.fat' },
] as const satisfies readonly { key: string; label: MessageKey }[]

type CustomProblem = 'food.error.name' | 'food.error.numbers' | 'food.error.range' | 'food.error.serving'

export function CustomFoodSheet({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(initialName)
  const [values, setValues] = useState<Record<(typeof FIELDS)[number]['key'], string>>({ kcal: '', proteinG: '', carbsG: '', fatG: '' })
  const [serving, setServing] = useState('')
  const [problem, setProblem] = useState<CustomProblem | null>(null)
  const nameId = useId()
  const servingId = useId()
  const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text.trim().replace(',', '.')))

  async function save() {
    if (!name.trim()) return setProblem('food.error.name')
    const numbers = Object.fromEntries(FIELDS.map((field) => [field.key, parse(values[field.key])])) as Record<(typeof FIELDS)[number]['key'], number>
    if (Object.values(numbers).some((value) => !Number.isFinite(value) || value < 0)) return setProblem('food.error.numbers')
    if (numbers.kcal > 900 || numbers.proteinG + numbers.carbsG + numbers.fatG > 100) return setProblem('food.error.range')
    const servingG = serving.trim() === '' ? null : parseGrams(serving)
    if (serving.trim() !== '' && servingG === null) return setProblem('food.error.serving')
    const id = await createCustomFood(store, { name, ...numbers, servingG })
    onCreated(id)
  }

  return (
    <Sheet
      title={t('food.new')}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" onClick={() => void save()}>
          {t('food.saveFood')}
        </Button>
      }
    >
      <label htmlFor={nameId} className="text-sm leading-5 font-medium">
        {t('food.name')}
      </label>
      <input id={nameId} value={name} maxLength={120} autoComplete="off" onChange={(event) => (setName(event.currentTarget.value), setProblem(null))} className={inputClass} />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm leading-5 font-semibold">{t('food.per100')}</legend>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map((field) => (
            <NumberInput key={field.key} label={t(field.label)} value={values[field.key]} onChange={(value) => (setValues((current) => ({ ...current, [field.key]: value })), setProblem(null))} />
          ))}
        </div>
      </fieldset>
      <label htmlFor={servingId} className="text-sm leading-5 font-medium">
        {t('food.servingField')}
      </label>
      <input id={servingId} inputMode="decimal" autoComplete="off" placeholder={t('food.noServing')} value={serving} onChange={(event) => setServing(event.currentTarget.value)} className={inputClass} />
      {problem ? (
        <p role="alert" className="type-caption text-danger">
          {t(problem)}
        </p>
      ) : null}
    </Sheet>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm leading-5 font-medium">
        {label}
      </label>
      <input id={id} inputMode="decimal" autoComplete="off" value={value} onChange={(event) => onChange(event.currentTarget.value)} className={inputClass} />
    </div>
  )
}
