import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FieldLabel } from './FieldLabel';
import { ChevronDownIcon, SearchIcon } from './icons';
import type { SelectOption } from './SelectField';
import { matchesSearch, searchWords } from '../utils/search';

interface SearchableSelectFieldProps {
  label: string;
  value: string;
  /** The first option is the "All ..." choice; it always stays at the top of the list. */
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  searchPlaceholder?: string;
}

/** Long lists (e.g. 6,000+ deals) only render this many matches; typing narrows them down. */
const MAX_VISIBLE_OPTIONS = 200;


/**
 * Labelled dropdown with a search box, styled like `SelectField`.
 * Use it for long lists (people, departments, pipelines, stages, deals, sites);
 * short fixed lists keep the plain `SelectField`.
 */
export function SearchableSelectField({
  label,
  value,
  options,
  onChange,
  searchPlaceholder = 'Type to search…',
}: SearchableSelectFieldProps) {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value) ?? options[0];

  const { visible, matchCount } = useMemo(() => {
    const words = searchWords(query);
    const [first, ...rest] = options;
    const matches = words.length === 0 ? rest : rest.filter((option) => matchesSearch(option.label, words));
    return {
      visible: [...(first ? [first] : []), ...matches.slice(0, MAX_VISIBLE_OPTIONS)],
      matchCount: matches.length,
    };
  }, [options, query]);
  // While searching, the first match (after "All ...") is highlighted; never point past the list.
  const active = Math.min(activeIndex, visible.length - 1);

  // Close when clicking anywhere outside the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Keep the highlighted option in view while using the arrow keys.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    setQuery('');
    setActiveIndex(Math.max(0, options.indexOf(selected)));
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    close(true);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openList();
    }
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(Math.min(active + 1, visible.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(Math.max(active - 1, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (visible[active]) choose(visible[active]);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  }

  const hiddenCount = matchCount - (visible.length - 1);

  return (
    <div ref={rootRef} className="relative flex min-w-0 flex-col gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onTriggerKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm max-sm:min-h-11 text-ink focus:border-ink-subtle focus:ring-2 focus:ring-ink/15 focus:outline-none"
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDownIcon className="size-4 shrink-0 text-ink-subtle" />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-40 mt-1 min-w-56 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
          <div className="flex items-center gap-2 rounded-md border border-line px-2 focus-within:border-ink-subtle focus-within:ring-2 focus-within:ring-ink/15">
            <SearchIcon className="size-4 shrink-0 text-ink-subtle" />
            <input
              autoFocus
              type="text"
              role="combobox"
              aria-label={`Search ${label}`}
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={visible[active] ? optionId(active) : undefined}
              value={query}
              placeholder={searchPlaceholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(event.target.value.trim() ? 1 : 0);
              }}
              onKeyDown={onSearchKeyDown}
              className="w-full bg-transparent py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
            />
          </div>

          <ul ref={listRef} id={listId} role="listbox" aria-label={label} className="mt-1.5 max-h-64 overflow-y-auto">
            {visible.map((option, index) => {
              const isSelected = option.value === selected?.value;
              const isActive = index === active;
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  title={option.label}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  onPointerMove={() => setActiveIndex(index)}
                  className={`cursor-pointer truncate rounded-md px-2.5 py-1.5 text-sm ${
                    isActive ? 'bg-surface-muted text-ink' : 'text-ink'
                  } ${isSelected ? 'font-semibold' : ''}`}
                >
                  {option.label}
                </li>
              );
            })}
            {matchCount === 0 && <li className="px-2.5 py-1.5 text-sm text-ink-muted">No matches</li>}
            {hiddenCount > 0 && (
              <li className="px-2.5 py-1.5 text-xs text-ink-subtle">
                {hiddenCount.toLocaleString('en-IN')} more — type to narrow the list
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
