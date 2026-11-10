interface SparklineProps {
  values: readonly number[];
  /** Tailwind text colour class; the line uses currentColor. */
  className?: string;
  label: string;
}

const WIDTH = 96;
const HEIGHT = 28;

/** Tiny trend line for KPI cards. Hidden when there are fewer than two points. */
export function Sparkline({ values, className = '', label }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * WIDTH;
      const y = HEIGHT - 2 - ((value - min) / range) * (HEIGHT - 4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={`h-7 w-24 shrink-0 ${className}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
