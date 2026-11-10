import { useTheme } from './themeContext';

/**
 * Recharts draws SVG and needs real colour values, so the chart colours
 * are kept here. Keep them in sync with the CSS tokens in src/index.css.
 */
export interface ChartPalette {
  income: string;
  expense: string;
  net: string;
  grid: string;
  axis: string;
  zeroLine: string;
  surface: string;
  /** Category colour series (mirror --cat-* in index.css, same order as categoryStyles.ts). */
  categorySeries: readonly string[];
  /** "No Category" (mirrors --ink-subtle). */
  noCategory: string;
}

const LIGHT_PALETTE: ChartPalette = {
  income: '#0f7a5c',
  expense: '#cf5230',
  net: '#ecbb45',
  grid: '#efede8',
  axis: '#83878f',
  zeroLine: '#c9c6bf',
  surface: '#ffffff',
  categorySeries: ['#c2482c', '#11866a', '#4957d6', '#e0a933', '#e8916d', '#25282e'],
  noCategory: '#83878f',
};

const DARK_PALETTE: ChartPalette = {
  income: '#3fbf95',
  expense: '#f07c5c',
  net: '#f2c24f',
  grid: '#262b33',
  axis: '#818896',
  zeroLine: '#434a56',
  surface: '#171a20',
  categorySeries: ['#e0674a', '#3fbf95', '#8d96f4', '#f2c24f', '#f0a585', '#cfd3da'],
  noCategory: '#818896',
};

/** Chart colour for a category (see categoryStyles.ts). */
export function categoryChartColor(palette: ChartPalette, colorIndex: number | null): string {
  return colorIndex === null ? palette.noCategory : palette.categorySeries[colorIndex % palette.categorySeries.length];
}

export function useChartPalette(): ChartPalette {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
}
