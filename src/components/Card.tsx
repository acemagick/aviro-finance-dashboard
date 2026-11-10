import type { ReactNode } from 'react';

interface CardProps {
  title: string;
  description?: string;
  /** Extra content on the right of the title, e.g. a legend. */
  actions?: ReactNode;
  /** Small content right after the title text, e.g. an info button (positioned within the title block). */
  titleAddon?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Rounded panel with a title, used to frame every dashboard section. */
export function Card({ title, description, actions, titleAddon, children, className = '' }: CardProps) {
  return (
    <section className={`flex min-w-0 flex-col rounded-2xl border border-line bg-surface ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
        <div className="relative min-w-0">
          <h2 className="flex items-center gap-1 text-base font-semibold text-ink">
            {title}
            {titleAddon}
          </h2>
          {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
        </div>
        {actions}
      </header>
      <div className="flex min-h-0 flex-1 flex-col p-5">{children}</div>
    </section>
  );
}
