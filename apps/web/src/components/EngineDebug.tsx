import { useMemo } from 'react';
import { bestResponseTable, ENGINE_VERSION, makeNormalGame } from '@strategos/engine';

export interface EngineDebugProps {
  rowActions: readonly string[];
  colActions: readonly string[];
  /** Payoffs as [rowPlayer, colPlayer] per cell [row][col]. */
  payoffs: readonly (readonly (readonly [number, number])[])[];
}

/**
 * Integration probe only (Phase 1): displays raw engine output for the demo matrix.
 * Not pedagogical; the UI computes nothing itself — every value shown comes from the engine.
 */
export function EngineDebug({ rowActions, colActions, payoffs }: EngineDebugProps) {
  const rows = useMemo(() => {
    const game = makeNormalGame(
      payoffs.map((r) => r.map((c) => c[0])),
      payoffs.map((r) => r.map((c) => c[1])),
      { rowActions: [...rowActions], colActions: [...colActions] },
    );
    return [0, 1].map((player) => {
      const own = player === 0 ? rowActions : colActions;
      const opp = player === 0 ? colActions : rowActions;
      return bestResponseTable(game, player).map((r) => ({
        against: opp[r.opponentAction]!,
        best: r.best.map((i) => own[i]!).join(' / '),
      }));
    });
  }, [rowActions, colActions, payoffs]);

  return (
    <section className="engine-debug" data-testid="engine-debug" aria-label="Engine debug output">
      <p className="muted small">Debug — engine {ENGINE_VERSION} output (integration check, not a lesson)</p>
      {rows.map((table, player) => (
        <ul key={player} className="small">
          {table.map((r) => (
            <li key={r.against}>
              {player === 0 ? 'Row' : 'Column'} best reply vs {r.against}: {r.best}
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
