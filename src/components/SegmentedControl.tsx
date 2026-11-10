import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Read by screen readers, e.g. "Period". */
  ariaLabel: string;
  /** Stretch across the full width with equal-size buttons. */
  fullWidth?: boolean;
  /** Show only icons on small screens (labels stay available to screen readers). */
  iconOnlyOnMobile?: boolean;
}

/** A row of toggle buttons where exactly one is selected (e.g. Day | Month | Year). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  iconOnlyOnMobile = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // Full-width rows may wrap on very narrow phones (< 360px) instead of running off the screen.
      className={`${fullWidth ? 'flex w-full max-[359px]:flex-wrap' : 'inline-flex'} rounded-lg border border-line bg-surface-muted p-1`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => onChange(option.value)}
            className={`${fullWidth ? 'min-w-0 flex-1 px-1.5 min-[400px]:px-3' : 'px-3'} inline-flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none ${
              active ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.icon}
            <span className={iconOnlyOnMobile ? 'sr-only sm:not-sr-only' : ''}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
