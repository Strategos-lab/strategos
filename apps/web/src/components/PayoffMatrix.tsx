import { useState } from 'react';

export type CellCoord = { row: number; col: number };

export interface PayoffMatrixProps {
  rowPlayerLabel: string;
  colPlayerLabel: string;
  rowActions: [string, string];
  colActions: [string, string];
  /** Payoffs as [rowPlayer, colPlayer] for each cell [row][col]. */
  payoffs: [[[number, number], [number, number]], [[number, number], [number, number]]];
  selected?: CellCoord | null;
  onSelect?: (cell: CellCoord) => void;
  demoNote?: string;
}

export function PayoffMatrix({
  rowPlayerLabel,
  colPlayerLabel,
  rowActions,
  colActions,
  payoffs,
  selected: controlledSelected,
  onSelect,
  demoNote,
}: PayoffMatrixProps) {
  const [internal, setInternal] = useState<CellCoord | null>(null);
  const selected = controlledSelected !== undefined ? controlledSelected : internal;

  function select(row: number, col: number) {
    const cell = { row, col };
    if (controlledSelected === undefined) setInternal(cell);
    onSelect?.(cell);
  }

  return (
    <section className="matrix-panel" aria-label="Payoff matrix demo">
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
            2 by 2 payoff matrix. Each cell shows payoffs for row player then column player.
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
                  const [r, c] = payoffs[row as 0 | 1][col as 0 | 1];
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
          {payoffs[selected.row as 0 | 1][selected.col as 0 | 1].join(', ')})
        </p>
      ) : (
        <p className="selection-readout muted">Tap a cell to select an outcome.</p>
      )}
    </section>
  );
}
