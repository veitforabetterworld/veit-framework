import type { ButtonHTMLAttributes, ReactNode } from 'react';

type VeitDeleteButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  icon?: ReactNode;
};

export function VeitDeleteButton({ children, className = '', icon, ...props }: VeitDeleteButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 btn-destructive ${className}`.trim()}
      {...props}
    >
      {icon ?? <span aria-hidden>🗑</span>}
      {children}
    </button>
  );
}

export type { VeitDeleteButtonProps };
