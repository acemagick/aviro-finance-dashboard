/**
 * Category colours (theme-aware tokens from index.css). Categories come from Bitrix24,
 * so each one gets the colour at its position in the Bitrix24 option order (repeating
 * after six); "No Category" is grey. Full class names are written out so Tailwind
 * includes them in the build. Keep in the same order as `categorySeries` in chartPalette.ts.
 */
const CATEGORY_COLOR_CLASSES = [
  'bg-cat-material',
  'bg-cat-transport',
  'bg-cat-admin',
  'bg-cat-other',
  'bg-cat-manpower',
  'bg-cat-site',
] as const;

const NO_CATEGORY_CLASS = 'bg-ink-subtle';

export function categoryColorClass(colorIndex: number | null): string {
  return colorIndex === null ? NO_CATEGORY_CLASS : CATEGORY_COLOR_CLASSES[colorIndex % CATEGORY_COLOR_CLASSES.length];
}
