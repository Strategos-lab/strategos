interface ConfidenceControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
}

export function ConfidenceControl({
  value,
  onChange,
  min = 50,
  max = 100,
  step = 5,
  label = 'Confidence',
}: ConfidenceControlProps) {
  return (
    <div className="confidence" data-testid="confidence-control">
      <div className="confidence-header">
        <label htmlFor="confidence-slider">{label}</label>
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
      />
      <div className="confidence-scale muted small" aria-hidden="true">
        <span>{min}% · a guess</span>
        <span>{max}% · certain</span>
      </div>
    </div>
  );
}
