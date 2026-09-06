import { useEffect, useMemo, useRef, useState } from 'react';
import { FaChevronDown, FaCopy, FaDownload, FaShare } from 'react-icons/fa6';

import { useTranslation } from 'react-i18next';

import { uniq } from 'lodash-es';
import { SongRankingTable } from './SongRankingTable';
import { Tabs } from '~/components/ui/tabs';
import { Accordion } from '~/components/ui/accordion';
import { Box, HStack, Stack, Wrap } from 'styled-system/jsx';
import { FormLabel } from '~/components/ui/form-label';
import { Heading } from '~/components/ui/heading';
import { Input } from '~/components/ui/input';
import { Textarea } from '~/components/ui/textarea';
import { useToaster } from '~/context/ToasterContext';
import { useLocalStorage } from '~/hooks/useLocalStorage';
import type { WithRank } from '~/types';
import { Text } from '~/components/ui/text';
import type { Song } from '~/types/songs';
import { Button } from '~/components/ui/button';
import type { RootProps } from '~/components/ui/styled/tabs';
import { useArtistsData } from '~/hooks/useArtistsData';
import { useSeriesData } from '~/hooks/useSeriesData';
import { HeardleStatsDialog } from '~/components/sorter/HeardleStatsDialog';
import type { GuessResult } from '~/hooks/useHeardleState';
import type { PerformanceSortMeta } from '~/types/performance-sort';
import { PerformanceOrderView } from './PerformanceOrderView';
import { getFullPerformanceName } from '~/utils/names';
import { renderSongRankingScreenshot } from '~/utils/song-ranking-screenshot';
import { CommunityRankingSubmission } from '~/components/community/CommunityRankingSubmission';

export function SongResultsView({
  titlePrefix,
  performanceMeta,
  songsData,
  order,
  failedSongs,
  guessResults,
  maxAttempts,
  onShareResults,
  readOnly,
  ...props
}: RootProps & {
  titlePrefix?: string;
  performanceMeta?: PerformanceSortMeta;
  songsData: Song[];
  order?: string[][];
  failedSongs?: Song[];
  guessResults?: Record<string, GuessResult>;
  maxAttempts?: number;
  onShareResults?: () => void;
  readOnly?: boolean;
}) {
  const artists = useArtistsData();
  const seriesData = useSeriesData();
  const { toast } = useToaster();
  const [title, setTitle] = useState<string>('My LoveLive! Song Ranking');
  const [description, setDescription] = useState<string>();
  const [currentTab, setCurrentTab] = useLocalStorage<string>('songs-result-tab-v2', 'table');
  const [timestamp, setTimestamp] = useState(new Date());
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  const screenshotCache = useRef<{ key: string; blob: Blob } | undefined>(undefined);
  const { t, i18n: _i18n } = useTranslation();

  const effectiveTitlePrefix = performanceMeta
    ? getFullPerformanceName(performanceMeta)
    : titlePrefix;

  const tabs = useMemo(() => {
    const result = [{ id: 'table', label: t('results.table') }];
    if (performanceMeta) {
      result.push({ id: 'performance-order', label: t('results.performance_order') });
    }
    return result;
  }, [t, performanceMeta]);

  useEffect(() => {
    if (!tabs.find((t) => t.id === currentTab)) {
      setCurrentTab('table');
    }
  }, [currentTab, setCurrentTab, tabs]);

  const failedSongIds = useMemo(() => new Set(failedSongs?.map((s) => s.id) ?? []), [failedSongs]);

  const songs = useMemo(() => {
    // Filter out failed songs from the order before computing ranks
    const filteredOrder = order
      ?.map((ids) =>
        Array.isArray(ids)
          ? ids.filter((id) => !failedSongIds.has(`${id}`))
          : failedSongIds.has(`${ids}`)
            ? []
            : [ids]
      )
      .filter((ids) => ids.length > 0);

    return (
      filteredOrder
        ?.map((ids, idx, arr) => {
          const startRank = arr.slice(0, idx).reduce((p, c) => p + c.length, 1);
          return ids
            .map((id) => {
              const song = songsData.find((s) => s.id === `${id}`);
              return song ? { rank: startRank, ...song } : null;
            })
            .filter((d): d is WithRank<Song> => d !== null);
        })
        .filter((c): c is WithRank<Song>[] => !!c) ?? []
    ).flatMap((s) => s);
  }, [order, songsData, failedSongIds]);

  const makeScreenshot = async () => {
    const cacheKey = [
      title,
      description ?? '',
      currentTab,
      _i18n.language,
      songs.map((song) => song.id).join(','),
      order?.map((group) => group.join(',')).join('|') ?? '',
      failedSongs?.map((song) => song.id).join(',') ?? ''
    ].join('\u0000');
    if (screenshotCache.current?.key === cacheKey) return screenshotCache.current.blob;

    setIsGeneratingScreenshot(true);
    toast?.({ description: t('toast.generating_screenshot') });
    try {
      const generatedAt = new Date();
      setTimestamp(generatedAt);
      const style = getComputedStyle(document.body);
      const blob = await renderSongRankingScreenshot({
        title,
        description,
        songs,
        locale: _i18n.language,
        labels: {
          ranking: t('ranking'),
          title: t('song-name'),
          thumbnail: t('thumbnail'),
          attribution: t('results.generated_by'),
          timestamp: `${t('results.generated_at')}: ${generatedAt.toLocaleString()}`
        },
        colors: {
          background: style.backgroundColor,
          text: style.color
        }
      });
      screenshotCache.current = { key: cacheKey, blob };
      return blob;
    } finally {
      setIsGeneratingScreenshot(false);
    }
  };

  const screenshot = async () => {
    try {
      const shareImage = await makeScreenshot();
      if (!shareImage) return;

      const shareFile = new File([shareImage], 'll-sorted.png');
      if (
        typeof navigator.share === 'function' &&
        (!navigator.canShare || navigator.canShare({ files: [shareFile] }))
      ) {
        try {
          await navigator.share({
            text: t('share.copy_text'),
            files: [shareFile]
          });
          return;
        } catch (error) {
          console.warn('Image sharing is unavailable; trying the clipboard instead.', error);
        }
      }

      if (
        typeof ClipboardItem !== 'undefined' &&
        typeof navigator.clipboard?.write === 'function'
      ) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': shareImage }, { presentationStyle: 'attachment' })
          ]);
          toast?.({ description: t('toast.screenshot_copied') });
          return;
        } catch (error) {
          console.warn('Image clipboard is unavailable; downloading instead.', error);
        }
      }

      await saveScreenshot(shareImage);
      toast?.({ description: t('toast.screenshot_downloaded') });
    } catch (error) {
      console.error(error);
      toast?.({ description: t('toast.screenshot_failed') });
    }
  };

  const exportText = async () => {
    const filteredOrder = order
      ?.map((ids) => ids.filter((id) => !failedSongIds.has(`${id}`)))
      .filter((ids) => ids.length > 0);
    await navigator.clipboard.writeText(
      filteredOrder
        ?.flatMap((item, idx) =>
          item.map((i) => {
            const s = songsData.find((s) => s.id === `${i}`);
            const artist = s?.artists.map((art) => artists.find((a) => a.id === art.id));
            return `${idx + 1}. ${s?.name} - ${artist?.[0]?.name ?? 'unknown'}`;
          })
        )
        .join('\n') ?? ''
    );
    toast?.({ description: t('toast.text_copied') });
  };

  const exportJSON = async () => {
    const filteredOrder = order
      ?.map((ids) => ids.filter((id) => !failedSongIds.has(`${id}`)))
      .filter((ids) => ids.length > 0);
    await navigator.clipboard.writeText(
      JSON.stringify(
        filteredOrder?.flatMap((item, idx) =>
          item.map((i) => {
            const s = songsData.find((s) => s.id === `${i}`);
            const artist = s?.artists.map((art) => artists.find((a) => a.id === art.id));
            const series = uniq(s?.seriesIds).map((id) => seriesData.find((a) => a.id === `${id}`));
            return {
              rank: idx + 1,
              title: s?.name,
              series: series.map((a) => a?.name)?.join(', '),
              unit: artist?.map((a) => a?.name)?.join(', ')
            };
          })
        )
      )
    );
    toast?.({ description: t('toast.text_copied') });
  };

  const saveScreenshot = async (blob: Blob) => {
    const saveAs = (await import('file-saver')).saveAs;
    saveAs(new File([blob], `${effectiveTitlePrefix ?? 'll'}-sorted-${timestamp.valueOf()}.png`));
  };

  const download = async () => {
    try {
      const blob = await makeScreenshot();
      if (!blob) return;
      await saveScreenshot(blob);
    } catch (error) {
      console.error(error);
      toast?.({ description: t('toast.screenshot_failed') });
    }
  };

  useEffect(() => {
    const sortType = t('songs');
    const type = t('results.ranking');
    setTitle(
      effectiveTitlePrefix
        ? t('results.results_title', { titlePrefix: effectiveTitlePrefix, sortType, type })
        : t('results.default_results_title', {
            titlePrefix: effectiveTitlePrefix,
            sortType,
            type
          })
    );
  }, [effectiveTitlePrefix, currentTab, t]);
  return (
    <>
      <Stack alignItems="center" w="full" textAlign="center">
        <Heading fontSize="2xl" fontWeight="bold">
          {t('results.sort_results')}
        </Heading>

        <Stack w="full">
          <Accordion.Root size="md" collapsible>
            <Accordion.Item value="default" width="100%">
              <Accordion.ItemTrigger>
                <Text fontSize="lg" fontWeight="bold">
                  {t('results.export_settings')}
                </Text>
                <Accordion.ItemIndicator>
                  <FaChevronDown />
                </Accordion.ItemIndicator>
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Stack>
                  <Stack w="full" textAlign="start">
                    <Wrap>
                      <FormLabel htmlFor="title">{t('results.title')}</FormLabel>
                      <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </Wrap>
                    <Wrap>
                      <FormLabel htmlFor="description">{t('results.description')}</FormLabel>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </Wrap>
                  </Stack>
                </Stack>
              </Accordion.ItemContent>
            </Accordion.Item>
          </Accordion.Root>
          {!readOnly && currentTab !== 'performance-order' && (
            <HStack justifyContent="space-between" w="full">
              <Wrap justifyContent="flex-end" w="full">
                {onShareResults && (
                  <Button variant="subtle" onClick={onShareResults}>
                    <FaShare /> {t('results.share')}
                  </Button>
                )}
                <Button variant="subtle" onClick={() => void exportJSON()}>
                  <FaCopy /> {t('results.export_json')}
                </Button>
                <Button variant="subtle" onClick={() => void exportText()}>
                  <FaCopy /> {t('results.copy_text')}
                </Button>
                <Button
                  variant="subtle"
                  loading={isGeneratingScreenshot}
                  loadingText={t('toast.generating_screenshot')}
                  onClick={() => void screenshot()}
                >
                  <FaCopy /> {t('results.copy')}
                </Button>
                <Button onClick={() => void download()}>
                  <FaDownload /> {t('results.download')}
                </Button>
              </Wrap>
            </HStack>
          )}
        </Stack>

        {!readOnly && currentTab !== 'performance-order' && (
          <CommunityRankingSubmission songs={songsData} order={order} />
        )}

        <Tabs.Root
          lazyMount
          defaultValue="table"
          value={currentTab}
          onValueChange={(d) => setCurrentTab(d.value)}
          {...props}
        >
          <Tabs.List>
            {tabs.map((option) => (
              <Tabs.Trigger key={option.id} value={option.id}>
                {option.label}
              </Tabs.Trigger>
            ))}
            <Tabs.Indicator />
          </Tabs.List>
          <Box w="full" p="4" overflowX="auto">
            <Tabs.Content value="table">
              <SongRankingTable
                songs={songs}
                guessResults={guessResults}
                maxAttempts={maxAttempts}
              />
            </Tabs.Content>
            {performanceMeta && order && (
              <Tabs.Content value="performance-order">
                <PerformanceOrderView performanceMeta={performanceMeta} order={order} />
              </Tabs.Content>
            )}
          </Box>
        </Tabs.Root>

        {guessResults && Object.keys(guessResults).length > 0 && maxAttempts && (
          <HeardleStatsDialog
            guessResults={guessResults}
            songs={songsData}
            lang={_i18n.language}
            maxAttempts={maxAttempts}
          />
        )}

        {failedSongs && failedSongs.length > 0 && (
          <Stack w="full" mt="8">
            <Heading color="red.500" fontSize="xl" fontWeight="bold">
              {t('heardle.failed_section')}
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              {t('heardle.failed_description', { count: maxAttempts ?? 5 })}
            </Text>
            <Box
              border="1px solid"
              borderColor="red.200"
              borderRadius="md"
              w="full"
              p="4"
              bg="bg.subtle"
            >
              <Stack gap={1}>
                {failedSongs.map((song) => {
                  const songArtists = song.artists
                    .map((art) => artists.find((a) => a.id === art.id))
                    .filter(Boolean);
                  return (
                    <HStack key={song.id} justifyContent="space-between">
                      <Text color="fg.muted">{song.name}</Text>
                      <Text color="fg.muted" fontSize="sm">
                        {songArtists.map((a) => a?.name).join(', ')}
                      </Text>
                    </HStack>
                  );
                })}
              </Stack>
            </Box>
          </Stack>
        )}
      </Stack>
    </>
  );
}
