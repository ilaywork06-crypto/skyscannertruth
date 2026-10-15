import { cva, type VariantProps } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all select-none ' +
    'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    '[&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-soft hover:brightness-110',
        secondary: 'bg-card text-foreground border border-border shadow-soft hover:bg-muted',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:brightness-[0.97] dark:hover:brightness-110',
        ghost: 'text-foreground hover:bg-muted',
        outline: 'border border-input bg-transparent hover:bg-muted',
        danger: 'bg-danger text-white shadow-soft hover:brightness-110',
        'danger-soft': 'bg-danger-soft text-danger hover:brightness-[0.97] dark:hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-xs': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5 whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-subtle text-muted-foreground',
        primary: 'bg-primary-soft text-primary-soft-foreground',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning-foreground',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        outline: 'border border-border text-muted-foreground',
        violet: 'bg-violet-500/[0.12] text-violet-600 dark:text-violet-300',
        teal: 'bg-teal-500/[0.12] text-teal-700 dark:text-teal-300',
        blue: 'bg-blue-500/[0.12] text-blue-600 dark:text-blue-300',
        orange: 'bg-orange-500/[0.12] text-orange-700 dark:text-orange-300',
        brown: 'bg-amber-700/[0.12] text-amber-800 dark:text-amber-300',
        slate: 'bg-slate-500/[0.12] text-slate-600 dark:text-slate-300',
        indigo: 'bg-indigo-500/[0.12] text-indigo-600 dark:text-indigo-300',
        pink: 'bg-pink-500/[0.12] text-pink-600 dark:text-pink-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)
export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>

/** The look of every text box, so a select, a combobox and a date box line up with an input. */
export const fieldClass =
  'w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/0.02)] ' +
  'placeholder:text-muted-foreground/70 transition-colors outline-none ' +
  'focus:border-primary focus:ring-[3px] focus:ring-ring disabled:opacity-60 disabled:bg-muted ' +
  'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/20'

export const panelClass = 'z-50 rounded-xl border border-border bg-popover text-sm shadow-pop animate-in'
