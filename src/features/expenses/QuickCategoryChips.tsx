import type { ExpenseCategoryOption } from '../../types/finance';
import { categoryColorClass } from './categoryStyles';

interface QuickCategoryChipsProps {
  /** Categories counted as expenses, in Bitrix24 order. */
  categories: readonly ExpenseCategoryOption[];
  selected: string | null;
  /** Called with the chosen Category option ID, or null for "All categories". */
  onSelect: (categoryId: string | null) => void;
}

const chipBase =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ink/30 focus-visible:outline-none';

/** One-click category filter. Clicking the selected chip again clears it. */
export function QuickCategoryChips({ categories, selected, onSelect }: QuickCategoryChipsProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 text-[11px] font-semibold tracking-wider text-ink-subtle uppercase">Quick category</span>
      <div role="group" aria-label="Quick category filter" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
          className={`${chipBase} ${selected === null ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink-muted hover:text-ink'}`}
        >
          All
        </button>
        {categories.map((category) => {
          const active = selected === category.id;
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(active ? null : category.id)}
              className={`${chipBase} ${active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink hover:bg-surface-muted'}`}
            >
              <span className={`size-2 rounded-full ${categoryColorClass(category.colorIndex)}`} aria-hidden="true" />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
