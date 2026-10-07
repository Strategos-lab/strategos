import { useState } from 'react';

export type CellCoord = { row: number; col: number };

type PayoffValue = string | number;

export interface PayoffMatrixProps {
  rowPlayerLabel: string;
  colPlayerLabel: string;
  rowActions: readonly string[];
  colActions: readonly string[];
  /** Payoffs as [rowPlayer, colPlayer] for each cell [row][col]. */
  payoffs: readonly (readonly (readonly [PayoffValue, PayoffValue])[])[];
  /**
   * 'select' (developer spike only): cells are buttons. 'read-only' (learner): a plain table;
   * nothing can be chosen from the matrix.
   */
  mode?: 'select' | 'read-only';
  selected?: CellCoord | null;
  onSelect?: (cell: CellCoord) => void;
  /** read-only: cell to highlight (resolved by the engine, never by this component). */
  highlight?: CellCoord | null;
  /** read-only: marker text for the highlighted row / column headers. */
  rowMark?: string;
  colMark?: string;
  /** read-only: accessible label for the highlighted cell. */
  highlightLabel?: string;
  demoNote?: string;
  ariaLabel?: string;
}

export function PayoffMatrix(props: PayoffMatrixProps) {
  return props.mode === 'read-only' ? <ReadOnlyMatrix {...props} /> : <SelectMatrix {...props} />;
}

function ReadOnlyMatrix({
  rowPlayerLabel,
  colPlayerLabel,
  rowActions,
  colActions,
  payoffs,
  highlight,
  rowMark,
  colMark,
  highlightLabel,
  ariaLabel = 'Payoff table',
}: PayoffMatrixProps) {
  return (
    <section className="matrix-panel" aria-label={ariaLabel} data-testid="payoff-matrix">
      <div className="matrix-scroll">
        <table className="payoff-matrix read-only">
          <caption className="sr-only">
            Rows are {rowPlayerLabel}&apos;s choices; columns are {colPlayerLabel}&apos;s choices. Each cell
            shows {rowPlayerLabel}&apos;s number first, then {colPlayerLabel}&apos;s.
          </caption>
          <thead>
            <tr>
              <td className="corner" />
              <th scope="colgroup" colSpan={colActions.length} className="player-head">
                {colPlayerLabel}
              </th>
            </tr>
            <tr>
              <th scope="col" className="corner player-head">
                {rowPlayerLabel}
              </th>
              {colActions.map((action, col) => (
                <th key={action} scope="col" className={highlight?.col === col ? 'marked' : undefined}>
                  {action}
                  {highlight?.col === col && colMark ? <span className="mark">{colMark}</span> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowActions.map((rowAction, row) => (
              <tr key={rowAction}>
                <th scope="row" className={highlight?.row === row ? 'marked' : undefined}>
                  {rowAction}
                  {highlight?.row === row && rowMark ? <span className="mark">{rowMark}</span> : null}
                </th>
                {colActions.map((_, col) => {
                  const [r, c] = payoffs[row]![col]!;
                  const isHit = highlight?.row === row && highlight?.col === col;
                  return (
                    <td key={col} className={`matrix-value${isHit ? ' realised' : ''}`} data-testid={isHit ? 'realised-cell' : undefined}>
                      <span className="payoff-pair">
                        <span className="payoff-row">{r}</span>
                        <span className="payoff-sep">,</span>
                        <span className="payoff-col">{c}</span>
                      </span>
                      {isHit && highlightLabel ? <span className="sr-only"> ({highlightLabel})</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Developer spike only: tap-to-select matrix (not part of the learner experience). */
function SelectMatrix({
  rowPlayerLabel,
  colPlayerLabel,
  rowActions,
  colActions,
  payoffs,
  selected: controlledSelected,
  onSelect,
  demoNote,
  ariaLabel = 'Payoff matrix demo',
}: PayoffMatrixProps) {
  const [internal, setInternal] = useState<CellCoord | null>(null);
  const selected = controlledSelected !== undefined ? controlledSelected : internal;

  function select(row: number, col: number) {
    const cell = { row, col };
    if (controlledSelected === undefined) setInternal(cell);
    onSelect?.(cell);
  }

  return (
    <section className="matrix-panel" aria-label={ariaLabel}>
      {demoNote ? <p className="demo-note">{demoNote}</p> : null}
      <div className="matrix-labels">
        <span className="matrix-label row-label">
          <span className="label-role">Row</span> {rowPlayerLabel}
        </span>
        <span className="matrix-label col-label">
          <span className="label-role">Column</span> {colPlayerLabel}
        </span>
      </div>
      <div className="matrix-scroll">
        <table className="payoff-matrix">
          <caption className="sr-only">
            Payoff matrix. Each cell shows payoffs for row player then column player.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="corner" />
              {colActions.map((action) => (
                <th key={action} scope="col">
                  {action}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowActions.map((rowAction, row) => (
              <tr key={rowAction}>
                <th scope="row">{rowAction}</th>
                {colActions.map((_, col) => {
                  const [r, c] = payoffs[row]![col]!;
                  const isSelected = selected?.row === row && selected?.col === col;
                  return (
                    <td key={col}>
                      <button
                        type="button"
                        className={`matrix-cell${isSelected ? ' selected' : ''}`}
                        aria-pressed={isSelected}
                        aria-label={`${rowAction} vs ${colActions[col]}: ${r}, ${c}`}
                        onClick={() => select(row, col)}
                      >
                        <span className="payoff-pair">
                          <span className="payoff-row">{r}</span>
                          <span className="payoff-sep">,</span>
                          <span className="payoff-col">{c}</span>
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <p className="selection-readout" data-testid="selection-readout">
          Selected: {rowActions[selected.row]} × {colActions[selected.col]} → (
          {payoffs[selected.row]![selected.col]!.join(', ')})
        </p>
      ) : (
        <p className="selection-readout muted">Tap a cell to select an outcome.</p>
      )}
    </section>
  );
}
