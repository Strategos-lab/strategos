interface ConfidenceControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function ConfidenceControl({
  value,
  onChange,
  min = 50,
  max = 99,
}: ConfidenceControlProps) {
  return (
    <div className="confidence" data-testid="confidence-control">
      <div className="confidence-header">
        <label htmlFor="confidence-slider">Prediction confidence (stub)</label>
        <span className="confidence-value" aria-live="polite">
          {value}%
        </span>
      </div>
      <input
        id="confidence-slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
      />
      <p className="muted small">
        Phase 0 stub — calibration scoring arrives in a later phase.
      </p>
    </div>
  );
}
