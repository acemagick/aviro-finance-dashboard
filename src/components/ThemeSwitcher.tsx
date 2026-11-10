import { useTheme } from '../theme/themeContext';
import type { ThemePreference } from '../theme/themeStorage';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Light', icon: <SunIcon /> },
  { value: 'dark', label: 'Dark', icon: <MoonIcon /> },
  { value: 'system', label: 'System', icon: <MonitorIcon /> },
];

/** Compact Light / Dark / System switch for the header. */
export function ThemeSwitcher() {
  const { preference, setPreference } = useTheme();
  return (
    <SegmentedControl
      ariaLabel="Colour theme"
      options={THEME_OPTIONS}
      value={preference}
      onChange={setPreference}
      iconOnlyOnMobile
    />
  );
}
