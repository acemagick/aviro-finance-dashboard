import { getInitials } from '../utils/income';

/** Theme-aware soft colours; the same person always gets the same colour. */
const AVATAR_TONES = [
  'bg-income/15 text-income',
  'bg-net/25 text-caution',
  'bg-margin/15 text-margin',
  'bg-expense/15 text-expense',
  'bg-cat-transport/15 text-cat-transport',
  'bg-cat-site/15 text-ink',
] as const;

function toneFor(id: string): string {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

interface PersonAvatarProps {
  id: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'size-7 text-[11px]', md: 'size-9 text-xs', lg: 'size-14 text-lg' } as const;

/** Round badge with a person's initials. */
export function PersonAvatar({ id, name, size = 'md', className }: PersonAvatarProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold ${SIZES[size]} ${className ?? toneFor(id)}`}
      aria-hidden="true"
    >
      {getInitials(name)}
    </span>
  );
}
