import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EngineDebug } from '../EngineDebug';
import { DevPage } from '../../pages/DevPage';

describe('EngineDebug (engine integration probe)', () => {
  it('shows best replies computed by @strategos/engine', () => {
    render(
      <EngineDebug
        rowActions={['Clean', 'Leave it']}
        colActions={['Clean', 'Leave it']}
        payoffs={[
          [[3, 3], [0, 5]],
          [[5, 0], [1, 1]],
        ]}
      />,
    );
    expect(screen.getByTestId('engine-debug')).toHaveTextContent('Row best reply vs Clean: Leave it');
    expect(screen.getByTestId('engine-debug')).toHaveTextContent('Column best reply vs Leave it: Leave it');
    expect(screen.getByTestId('engine-debug')).not.toHaveTextContent(/nash|dilemma|dominan|equilibri/i);
  });

  it('is hidden until the debug toggle is switched on (developer mode only)', async () => {
    render(
      <MemoryRouter>
        <DevPage />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('engine-debug')).toBeNull();
    await userEvent.click(screen.getByTestId('engine-debug-toggle'));
    expect(screen.getByTestId('engine-debug')).toBeInTheDocument();
  });
});
