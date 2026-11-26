import { FOOD_ICONS, type FoodIconKey, type FoodShape } from '@/catalog/food-icons'

// Ilustrimi me ngjyra i një ushqimi (SPEC V67): vizaton format e `food-icons.ts` në rrjetën 32. Dekorativ:
// emri i ushqimit është gjithnjë pranë.
function shape(s: FoodShape, i: number) {
  switch (s[0]) {
    case 'p':
      return <path key={i} d={s[1]} fill={s[2]} />
    case 's':
      return <path key={i} d={s[1]} fill="none" stroke={s[2]} strokeWidth={s[3]} strokeLinecap="round" strokeLinejoin="round" />
    case 'c':
      return <circle key={i} cx={s[1]} cy={s[2]} r={s[3]} fill={s[4]} />
    case 'e':
      return <ellipse key={i} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} fill={s[5]} transform={`rotate(${s[6]} ${s[1]} ${s[2]})`} />
    case 'r':
      return <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} fill={s[6]} />
  }
}

export function FoodIcon({ name, size }: { name: FoodIconKey; size: number }) {
  const shapes: readonly FoodShape[] = FOOD_ICONS[name]
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 32 32">
      {shapes.map(shape)}
    </svg>
  )
}
