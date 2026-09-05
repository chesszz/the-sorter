import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import { SongFilters, type SongFilterType } from '../SongFilters';

// Mock DualListSelector to simplify testing
vi.mock('../DualListSelector', () => ({
  DualListSelector: (props: {
    title: string;
    selectedIds: string[];
    onSelectionChange: (ids: string[]) => void;
  }) => (
    <div data-testid={`dual-list-${props.title}`}>
      <h3>{props.title}</h3>
      <span>Selected Count: {props.selectedIds.length}</span>
      <button onClick={() => props.onSelectionChange([...props.selectedIds, '999'])}>
        Add Mock Item
      </button>
    </div>
  )
}));

// Setup i18n for testing
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      translation: {
        'settings.series': 'Series',
        'settings.types': 'Types',
        'settings.artists': 'Artists',
        'settings.characters': 'Characters',
        'settings.character_solo_hint': 'Tip: enable Type → Solo for solo songs only.',
        'settings.discographies': 'Discographies',
        'settings.songs': 'Songs',
        'settings.years': 'Years',
        'settings.select_all': 'Select All',
        'settings.deselect_all': 'Deselect All',
        'settings.type.group': 'Group',
        'settings.type.solo': 'Solo',
        'settings.type.unit': 'Unit',
        'common.selected': 'Selected'
      }
    }
  }
});

const mockFilters: SongFilterType = {
  series: [],
  artists: [],
  types: [],
  characters: [],
  discographies: [],
  songs: [],
  years: []
};

describe('SongFilters Component', () => {
  it('renders only the song and year filters', () => {
    const setFilters = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <SongFilters filters={mockFilters} setFilters={setFilters} />
      </I18nextProvider>
    );

    expect(screen.getByText('Years')).toBeInTheDocument();
    expect(screen.getAllByText('Songs').length).toBeGreaterThan(0);
    expect(screen.queryByText('Series')).not.toBeInTheDocument();
    expect(screen.queryByText('Artists')).not.toBeInTheDocument();
    expect(screen.queryByText('Types')).not.toBeInTheDocument();
    expect(screen.queryByText('Characters')).not.toBeInTheDocument();
    expect(screen.queryByText('Discographies')).not.toBeInTheDocument();
  });

  it('updates the song selection', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <SongFilters filters={mockFilters} setFilters={setFilters} />
      </I18nextProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Add Mock Item' }));

    expect(setFilters).toHaveBeenCalled();
  });

  it('deselects all filters', async () => {
    const user = userEvent.setup();
    const setFilters = vi.fn();
    const activeFilters = { ...mockFilters, series: ['1'] };
    render(
      <I18nextProvider i18n={i18n}>
        <SongFilters filters={activeFilters} setFilters={setFilters} />
      </I18nextProvider>
    );

    const deselectBtns = screen.getAllByText('Deselect All');
    // The last button is the global "Deselect All" at the bottom
    await user.click(deselectBtns[deselectBtns.length - 1]);

    expect(setFilters).toHaveBeenCalled();
  });
});
