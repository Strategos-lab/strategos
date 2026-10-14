import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAY_CONTENT } from '@strategos/content/play';
import { ModulesPage } from '../ModulesPage';

const DEV_LABELS = /Phase 0 stub|calibration scoring|Demo only|Debug: show engine output|Tap a cell|Nash|equilibri/i;

describe('ModulesPage (lesson menu)', () => {
  afterEach(() => cleanup());

  it('lists every module and lesson, linking each playable lesson to its route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ModulesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'STRATEGOS' })).toBeInTheDocument();
    expect(screen.getByTestId('intro-cadence')).toHaveTextContent('A few exercises a day');
    expect(document.body.textContent).not.toMatch(DEV_LABELS);

    for (const m of PLAY_CONTENT.curriculum.modules) {
      for (const l of m.lessons) {
        const link = screen.getByTestId(`lesson-${l.id}`);
        expect(link).toHaveAttribute('href', `/lesson/${l.id}`);
        expect(link).toHaveTextContent(l.workingTitle);
      }
    }
  });
});
