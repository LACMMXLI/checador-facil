// Utilidades de estilo SIN 'use client': pueden usarse en Server Components.
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...i: ClassValue[]) => twMerge(clsx(i));

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-brand-600 text-white shadow-glow hover:bg-brand-700',
        dark: 'bg-ink-900 text-white hover:bg-ink-800',
        outline: 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50',
        ghost: 'text-ink-700 hover:bg-ink-100',
        danger: 'bg-red-600 text-white hover:bg-red-700',
        soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        light: 'bg-white text-ink-900 hover:bg-ink-50',
      },
      size: { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-14 px-7 text-base', icon: 'h-10 w-10' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
