import { useEffect, type Dispatch, type SetStateAction, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Group } from '../ui/styled/checkbox';
import { Text } from '../ui/text';

import series from '../../../data/series-info.json';
import songs from '../../../data/songs.json';

import { DualListSelector } from './DualListSelector';
import { Badge } from '~/components/ui/badge';
import { HStack, Stack, Wrap, Box } from 'styled-system/jsx';
import { isValidSongFilter } from '~/utils/song-filter';
import { getSongName } from '~/utils/names';
import { fuzzySearch, getSearchScore } from '~/utils/search';
import { getAllCommaSeparated } from '~/utils/share';

export type SongFilterType = {
  series: string[];
  artists: string[];
  types: ('group' | 'solo' | 'unit')[];
  characters: number[];

  discographies: number[];
  songs: number[];
  years: number[];
};

const years = Array.from(
  new Set(
    songs
      .map((s) => s.releasedOn?.substring(0, 4))
      .filter((y): y is string => !!y)
      .map(Number)
  )
).toSorted((a, b) => b - a);

const FILTER_VALUES = {
  series: series.map((s) => s.id),
  artists: [] as string[],
  types: ['group', 'solo', 'unit'],
  characters: [],
  discographies: [],
  songs: songs.map((s) => Number(s.id)),
  years: years
} satisfies Record<keyof SongFilterType, unknown>;

export function SongFilters({
  filters,
  setFilters
}: {
  filters: SongFilterType | null | undefined;
  setFilters: Dispatch<SetStateAction<SongFilterType | null | undefined>>;
}) {
  const { t, i18n: _i18n } = useTranslation();

  const selectAll = (key: keyof SongFilterType) => () => {
    setFilters((f) => {
      // If any items are selected, this action acts as "Clear"
      // If NO items are selected, it acts as "Select All"
      const hasSelection = f?.[key]?.length && f[key].length > 0;
      const res = hasSelection ? [] : FILTER_VALUES[key];
      return {
        ...f,
        [key]: res
      } as SongFilterType;
    });
  };

  const clearSection = (key: keyof SongFilterType) => () => {
    setFilters((f) => {
      return {
        ...f,
        [key]: []
      } as SongFilterType;
    });
  };

  const deselectAll = () => {
    setFilters(() => {
      return {
        series: [],
        artists: [],
        types: [],
        characters: [],

        discographies: [],
        songs: [],
        years: []
      };
    });
  };

  const initFilters = useCallback(() => {
    const params = new URLSearchParams(location.search);
    const urlSeries = getAllCommaSeparated(params, 'series');
    const urlArtists = getAllCommaSeparated(params, 'artists');
    const urlTypes = getAllCommaSeparated(params, 'types');
    const urlCharacters = getAllCommaSeparated(params, 'characters');
    const urlDiscographies = getAllCommaSeparated(params, 'discographies');
    const urlSongs = getAllCommaSeparated(params, 'songs');
    const urlYears = getAllCommaSeparated(params, 'years');

    if (
      urlSeries.length > 0 ||
      urlArtists.length > 0 ||
      urlTypes.length > 0 ||
      urlCharacters.length > 0 ||
      urlDiscographies.length > 0 ||
      urlSongs.length > 0 ||
      urlYears.length > 0
    ) {
      setFilters({
        series: urlSeries.filter((s) => FILTER_VALUES.series.includes(s) || s === 'cross'),
        artists: urlArtists.filter((s) => FILTER_VALUES.artists.includes(s)),
        types: urlTypes.filter((s) =>
          FILTER_VALUES.types.includes(s as 'group' | 'solo' | 'unit')
        ) as ('group' | 'solo' | 'unit')[],
        characters: urlCharacters.map(Number).filter((c) => !isNaN(c)),
        discographies: urlDiscographies.map(Number).filter((d) => !isNaN(d)),
        songs: urlSongs.map(Number).filter((s) => !isNaN(s)),
        years: urlYears.map(Number).filter((y) => !isNaN(y))
      });
      return;
    }

    setFilters({
      series: [],
      artists: [],
      types: [],
      characters: [],
      discographies: [],
      songs: [],
      years: []
    });
  }, [setFilters]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (
      params.has('series') ||
      params.has('artists') ||
      params.has('types') ||
      params.has('characters') ||
      params.has('discographies') ||
      params.has('songs') ||
      params.has('years') ||
      filters === undefined ||
      !isValidSongFilter(filters)
    ) {
      initFilters();
    }

    // oxlint-disable-next-line exhaustive-deps
  }, [initFilters]);

  const seriesMap = useMemo(
    () =>
      series.reduce(
        (acc, s) => {
          acc[s.id] = s.name;
          return acc;
        },
        {} as Record<string, string>
      ),
    []
  );

  // Helper for series color mapping
  const seriesColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    series.forEach((s) => {
      map[String(s.id)] = s.color;
    });
    return map;
  }, []);

  const filteredSongs = songs;

  const songItems = useMemo(
    () =>
      filteredSongs
        .map((s) => ({
          id: Number(s.id),
          name: getSongName(s.name, s.englishName, _i18n.language),
          category: s.seriesIds.map((sid) => seriesMap[String(sid)]).join(', '),
          color: seriesColorMap[String(s.seriesIds[0])],
          phoneticName: s.phoneticName,
          englishName: s.englishName
        }))
        .sort((a, b) => a.name.localeCompare(b.name, _i18n.language)),
    [filteredSongs, seriesMap, seriesColorMap, _i18n.language]
  );

  // Helper for Adaptive Header
  const renderHeader = (
    title: string,
    count: number,
    sectionKey: keyof SongFilterType,
    isModal = false
  ) => {
    const hasSelection = count > 0;

    // For Series/Types (isModal=false): Button is "Select All" (if empty) or "Clear" (if selected)
    // For Modals (isModal=true): Button is "Clear" (only if selected)

    let button = null;

    if (!isModal) {
      // Toggle logic for Series/Types
      button = (
        <Button size="sm" onClick={selectAll(sectionKey)}>
          {hasSelection ? t('settings.deselect_all') : t('settings.select_all')}
        </Button>
      );
    } else {
      // Clear button for Modals (Always render to reserve space, but hide if no selection)
      button = (
        <Button
          size="xs"
          variant="outline"
          onClick={clearSection(sectionKey)}
          disabled={!hasSelection}
          style={{ visibility: hasSelection ? 'visible' : 'hidden' }}
        >
          {t('settings.deselect_all')}
        </Button>
      );
    }

    return (
      <HStack justifyContent="space-between" alignItems="center" h="8">
        <Text fontWeight="bold">
          {title} {hasSelection && `(${count})`}
        </Text>
        {button}
      </HStack>
    );
  };

  const songsCount = filters?.songs?.length ?? 0;
  const yearsCount = filters?.years?.length ?? 0;

  return (
    <Stack border="1px solid" borderColor="border.default" rounded="l1" p="4">
      {/* Years */}
      <Stack>
        {renderHeader(t('settings.years'), yearsCount, 'years', false)}
        <Group
          asChild
          defaultValue={[]}
          value={filters?.years?.map(String) ?? []}
          onValueChange={(years) => {
            if (!filters) return;
            setFilters({ ...filters, years: years.map(Number) });
          }}
        >
          <Wrap>
            {years.map((year) => (
              <Checkbox size="sm" key={year} value={String(year)}>
                {year}
              </Checkbox>
            ))}
          </Wrap>
        </Group>
      </Stack>

      <Box height="1px" bg="border.subtle" />

      {/* Songs */}
      <Stack>
        {renderHeader(t('settings.songs') || 'Songs', songsCount, 'songs', true)}
        <DualListSelector
          title={t('settings.songs') || 'Songs'}
          triggerLabel={t('settings.songs') || 'Songs'}
          items={songItems}
          selectedIds={filters?.songs ?? []}
          onSelectionChange={(ids) => {
            if (!filters) return;
            setFilters({ ...filters, songs: ids.map(Number) });
          }}
          searchFilter={fuzzySearch}
          getSearchScore={getSearchScore}
        />
        {filters?.songs && filters.songs.length > 0 && (
          <HStack gap="2" pt="2" flexWrap="wrap">
            <Badge variant="subtle" size="sm">
              {filters.songs.length} {t('common.selected')}
            </Badge>
          </HStack>
        )}
      </Stack>

      <HStack justifyContent="center">
        <Button onClick={deselectAll}>{t('settings.deselect_all')}</Button>
      </HStack>
    </Stack>
  );
}
