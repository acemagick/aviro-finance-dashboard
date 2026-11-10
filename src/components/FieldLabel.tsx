import type { ReactNode } from 'react';

const LABEL_CLASSES = 'text-[11px] font-semibold tracking-wider text-ink-subtle uppercase';

/** Small uppercase label used above filter controls. */
export function FieldLabel({ htmlFor, id, children }: { htmlFor?: string; id?: string; children: ReactNode }) {
  if (htmlFor) {
    return (
      <label htmlFor={htmlFor} id={id} className={LABEL_CLASSES}>
        {children}
      </label>
    );
  }
  return (
    <span id={id} className={LABEL_CLASSES}>
      {children}
    </span>
  );
}
