import { createContext, useContext } from 'react';
import type { ResolvedTheme, ThemePreference } from './themeStorage';

export interface ThemeContextValue {
  /** What the user picked: light, dark or system. */
  preference: ThemePreference;
  /** What is actually showing right now: light or dark. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside <ThemeProvider>.');
  return value;
}
