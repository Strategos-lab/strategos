interface ConfidenceControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  /** 'hero' (learner): large percentage, quiet slider, label for screen readers only. */
  variant?: 'default' | 'hero';
}

export function ConfidenceControl({
  value,
  onChange,
  min = 50,
  max = 100,
  step = 5,
  label = 'Confidence',
  variant = 'default',
}: ConfidenceControlProps) {
  const hero = variant === 'hero';
  return (
    <div className={`confidence${hero ? ' confidence-hero' : ''}`} data-testid="confidence-control">
      <div className="confidence-header">
        <label htmlFor="confidence-slider" className={hero ? 'sr-only' : undefined}>
          {label}
        </label>
        <span className="confidence-value" aria-live="polite">
          {value}%
        </span>
      </div>
      <input
        id="confidence-slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value}%`}
        style={hero ? ({ '--fill': `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties) : undefined}
      />
      <div className="confidence-scale" aria-hidden="true">
        {hero ? (
          <>
            <span>Not sure</span>
            <span>Very sure</span>
          </>
        ) : (
          <>
            <span>{min}% · a guess</span>
            <span>{max}% · certain</span>
          </>
        )}
      </div>
    </div>
  );
}
