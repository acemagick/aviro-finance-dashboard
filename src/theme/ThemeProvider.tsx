import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext } from './themeContext';
import {
  applyTheme,
  getSystemPrefersDark,
  readThemePreference,
  resolveTheme,
  subscribeToSystemTheme,
  writeThemePreference,
  type ThemePreference,
} from './themeStorage';

// Apply the saved theme as soon as this file loads, before React draws
// anything, to avoid a flash of the wrong theme.
applyTheme(resolveTheme(readThemePreference(), getSystemPrefersDark()));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(getSystemPrefersDark);

  // Follow the operating system when it switches between light and dark.
  useEffect(() => subscribeToSystemTheme(setSystemPrefersDark), []);

  const resolvedTheme = resolveTheme(preference, systemPrefersDark);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
