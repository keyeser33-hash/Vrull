import type { VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { buttonVariants } from './button-variants'

type Variants = VariantProps<typeof buttonVariants>

/** `variant` është i detyrueshëm: pa të cva jep variantin e v1 `default`, që kod i ri nuk e përdor. */
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  Omit<Variants, 'variant'> & { variant: NonNullable<Variants['variant']> }

export function Button({ className, variant, size, ground, tired, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size, ground, tired }), className)} {...props} />
}
