import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, HStack, Stack } from 'styled-system/jsx';
import { Metadata } from '~/components/layout/Metadata';
import { Heading } from '~/components/ui/heading';
import { Text } from '~/components/ui/text';
import { Table } from '~/components/ui/table';
import { Button } from '~/components/ui/button';
import { useSongData } from '~/hooks/useSongData';
import { getSongName } from '~/utils/names';
import { getAssetUrl } from '~/utils/assets';
import {
  fetchCommunityStats,
  isCommunityRankingsConfigured,
  type CommunityStats
} from '~/utils/communityRankings';

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatCorrelation(value: number) {
  return value.toFixed(2);
}

export function Page() {
  const { t, i18n } = useTranslation();
  const songs = useSongData();
  const [stats, setStats] = useState<CommunityStats>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [expandedParticipants, setExpandedParticipants] = useState<Set<number>>(new Set());
  const names = useMemo(
    () =>
      new Map(
        songs.map((song) => [song.id, getSongName(song.name, song.englishName, i18n.language)])
      ),
    [songs, i18n.language]
  );
  const thumbnails = useMemo(
    () => new Map(songs.map((song) => [song.id, song.thumbnail])),
    [songs]
  );

  useEffect(() => {
    if (!isCommunityRankingsConfigured) {
      setLoading(false);
      return;
    }
    fetchCommunityStats(songs.map((song) => song.id))
      .then((data) => {
        setStats(data);
        setLoading(false);
        return data;
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : t('community.stats_error'));
        setLoading(false);
      });
  }, [songs, t]);

  const songName = (id: string) => names.get(id) ?? id;
  const divisiveMatchups = [...(stats?.matchups ?? [])]
    .filter((matchup) => matchup.total > 0)
    .toSorted((a, b) => {
      const aSplit = Math.max(a.leftWins, a.rightWins) / a.total;
      const bSplit = Math.max(b.leftWins, b.rightWins) / b.total;
      return aSplit - bSplit;
    })
    .slice(0, 10);
  const oneSidedMatchups = [...(stats?.matchups ?? [])]
    .filter((matchup) => matchup.total > 0)
    .toSorted((a, b) => {
      const aSplit = Math.max(a.leftWins, a.rightWins) / a.total;
      const bSplit = Math.max(b.leftWins, b.rightWins) / b.total;
      return bSplit - aSplit;
    })
    .slice(0, 10);
  const positiveCorrelations = [...(stats?.correlations ?? [])]
    .filter((pair) => pair.correlation > 0)
    .toSorted((a, b) => b.correlation - a.correlation)
    .slice(0, 10);
  const negativeCorrelations = [...(stats?.correlations ?? [])]
    .filter((pair) => pair.correlation < 0)
    .toSorted((a, b) => a.correlation - b.correlation)
    .slice(0, 10);
  const participantLimit = Math.min(10, Math.floor((stats?.participants.length ?? 0) / 2));
  const mainstream = [...(stats?.participants ?? [])]
    .toSorted((a, b) => b.similarity - a.similarity)
    .slice(0, participantLimit);
  const contrarian = [...(stats?.participants ?? [])]
    .toSorted((a, b) => a.similarity - b.similarity)
    .slice(0, participantLimit);
  const individualParticipants = [...(stats?.participants ?? [])].toSorted(
    (a, b) => b.similarity - a.similarity
  );
  return (
    <>
      <Metadata title={t('community.stats_title')} helmet />
      <Stack gap="6" alignItems="center" w="full">
        <Stack gap="1" alignItems="center">
          <Heading fontSize="3xl">{t('community.stats_title')}</Heading>
          <Text color="fg.muted">
            {stats?.submissionCount ?? 0} {t('community.submissions')}
          </Text>
        </Stack>
        {!isCommunityRankingsConfigured && <Text>{t('community.stats_not_configured')}</Text>}
        {loading && <Text>{t('community.loading')}</Text>}
        {error && (
          <Text role="alert" color="red.600">
            {error}
          </Text>
        )}
        {error && (
          <Text color="fg.muted" textAlign="center">
            {t('community.stats_help')}{' '}
            <a href="https://discord.com/app" target="_blank" rel="noreferrer">
              {t('community.discord_link')}
            </a>
          </Text>
        )}
        {stats && (
          <Stack gap="8" w="full">
            <StatsSection
              title={t('community.consensus')}
              alignSelf="center"
              w={{ base: 'full', md: '75%' }}
            >
              <Table.Root size="sm">
                <Table.Head>
                  <Table.Row>
                    <Table.Header>{t('community.rank')}</Table.Header>
                    <Table.Header>{t('community.song')}</Table.Header>
                    <Table.Header>{t('community.sentiment')}</Table.Header>
                    <Table.Header>{t('community.sample_size')}</Table.Header>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {[...stats.songs]
                    .toSorted((a, b) => b.sentiment - a.sentiment)
                    .map((song, index) => (
                      <Table.Row key={song.songId}>
                        <Table.Cell>{index + 1}</Table.Cell>
                        <Table.Cell>
                          <SongLabel
                            name={songName(song.songId)}
                            thumbnail={thumbnails.get(song.songId)}
                          />
                        </Table.Cell>
                        <Table.Cell>{formatPercent(song.sentiment)}</Table.Cell>
                        <Table.Cell>{song.sampleSize}</Table.Cell>
                      </Table.Row>
                    ))}
                </Table.Body>
              </Table.Root>
            </StatsSection>

            <HStack gap="8" alignItems="start" flexWrap="wrap">
              <StatsSection
                title={t('community.matchups')}
                flex="1"
                minW={{ base: 'full', md: '0' }}
              >
                <MatchupTable
                  matchups={divisiveMatchups}
                  songName={songName}
                  thumbnails={thumbnails}
                  songLabel={t('community.song')}
                  splitLabel={t('community.split')}
                />
              </StatsSection>

              <StatsSection
                title={t('community.one_sided_matchups')}
                flex="1"
                minW={{ base: 'full', md: '0' }}
              >
                <MatchupTable
                  matchups={oneSidedMatchups}
                  songName={songName}
                  thumbnails={thumbnails}
                  songLabel={t('community.song')}
                  splitLabel={t('community.split')}
                />
              </StatsSection>
            </HStack>

            <HStack gap="8" alignItems="start" flexWrap="wrap">
              <StatsSection
                title={t('community.positive_correlations')}
                flex="1"
                minW={{ base: 'full', md: '0' }}
              >
                <CorrelationTable
                  pairs={positiveCorrelations}
                  songName={songName}
                  thumbnails={thumbnails}
                  songLabel={t('community.song')}
                  correlationLabel={t('community.correlation')}
                />
              </StatsSection>

              <StatsSection
                title={t('community.negative_correlations')}
                flex="1"
                minW={{ base: 'full', md: '0' }}
              >
                <CorrelationTable
                  pairs={negativeCorrelations}
                  songName={songName}
                  thumbnails={thumbnails}
                  songLabel={t('community.song')}
                  correlationLabel={t('community.correlation')}
                />
              </StatsSection>
            </HStack>

            <HStack gap="8" alignItems="start" flexWrap="wrap">
              <StatsSection title={t('community.mainstream')} flex="1" minW="280px">
                <ParticipantTable participants={mainstream} />
              </StatsSection>
              <StatsSection title={t('community.contrarian')} flex="1" minW="280px">
                <ParticipantTable participants={contrarian} />
              </StatsSection>
            </HStack>

            <StatsSection title={t('community.individual_rankings')}>
              <Table.Root size="sm">
                <Table.Head>
                  <Table.Row>
                    <Table.Header>Name</Table.Header>
                    <Table.Header>Similarity</Table.Header>
                    <Table.Header>{t('community.ranked_songs')}</Table.Header>
                    <Table.Header>{t('community.ranking')}</Table.Header>
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {individualParticipants.map((participant, index) => {
                    const ranking = Object.entries(participant.ranks ?? {}).toSorted(
                      ([, leftRank], [, rightRank]) => leftRank - rightRank
                    );
                    const isExpanded = expandedParticipants.has(index);
                    const topRanking = ranking.slice(0, 3);
                    const topSongIds = new Set(topRanking.map(([songId]) => songId));
                    const bottomRanking = ranking
                      .slice(-3)
                      .filter(([songId]) => !topSongIds.has(songId));
                    const canExpand = ranking.length > 10;

                    return (
                      <Table.Row key={`${participant.displayName}-${index}`}>
                        <Table.Cell style={{ whiteSpace: 'nowrap' }}>
                          {participant.displayName}
                        </Table.Cell>
                        <Table.Cell>{Math.round(participant.similarity)}%</Table.Cell>
                        <Table.Cell>{participant.rankedSongCount}</Table.Cell>
                        <Table.Cell>
                          <Stack gap="1" minW="260px">
                            {isExpanded ? (
                              <RankingEntries entries={ranking} songName={songName} />
                            ) : (
                              <Box
                                display="grid"
                                gap="6"
                                gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                                w="full"
                              >
                                <Stack gap="1" minW="0">
                                  <Text fontWeight="bold">{t('community.top_songs')}</Text>
                                  <RankingEntries entries={topRanking} songName={songName} />
                                </Stack>
                                {bottomRanking.length > 0 && (
                                  <Stack gap="1" minW="0">
                                    <Text fontWeight="bold">{t('community.bottom_songs')}</Text>
                                    <RankingEntries entries={bottomRanking} songName={songName} />
                                  </Stack>
                                )}
                              </Box>
                            )}
                            {canExpand && (
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => {
                                  setExpandedParticipants((expanded) => {
                                    const next = new Set(expanded);
                                    if (next.has(index)) next.delete(index);
                                    else next.add(index);
                                    return next;
                                  });
                                }}
                                alignSelf="start"
                              >
                                {isExpanded
                                  ? t('community.show_fewer_songs')
                                  : t('community.show_all_songs')}
                              </Button>
                            )}
                          </Stack>
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            </StatsSection>
          </Stack>
        )}
      </Stack>
    </>
  );
}

function StatsSection({
  title,
  children,
  action,
  ...props
}: { title: string; children: React.ReactNode; action?: React.ReactNode } & Record<
  string,
  unknown
>) {
  return (
    <Stack gap="2" {...props}>
      <HStack gap="3" justifyContent="space-between" alignItems="center">
        <Heading fontSize="xl">{title}</Heading>
        {action}
      </HStack>
      <Box w="full" overflowX="auto">
        {children}
      </Box>
    </Stack>
  );
}

function RankingEntries({
  entries,
  songName
}: {
  entries: [string, number][];
  songName: (id: string) => string;
}) {
  return (
    <HStack gap="3" alignItems="start" flexWrap="wrap">
      {entries.map(([songId, rank]) => (
        <HStack key={songId} gap="2">
          <Text color="fg.muted">{rank}.</Text>
          <Text>{songName(songId)}</Text>
        </HStack>
      ))}
    </HStack>
  );
}

function SongLabel({ name, thumbnail }: { name: string; thumbnail?: string }) {
  return (
    <HStack gap="2" alignItems="center" minW="0">
      {thumbnail && (
        <img
          src={getAssetUrl(thumbnail)}
          alt=""
          aria-hidden="true"
          style={{
            width: '1.5rem',
            height: '1.5rem',
            objectFit: 'cover',
            flexShrink: 0,
            borderRadius: '0.15rem'
          }}
        />
      )}
      <Text>{name}</Text>
    </HStack>
  );
}

function MatchupTable({
  matchups,
  songName,
  thumbnails,
  songLabel,
  splitLabel
}: {
  matchups: CommunityStats['matchups'];
  songName: (id: string) => string;
  thumbnails: Map<string, string | undefined>;
  songLabel: string;
  splitLabel: string;
}) {
  return (
    <Table.Root size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Header>{songLabel}</Table.Header>
          <Table.Header>{songLabel}</Table.Header>
          <Table.Header>{splitLabel}</Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {matchups.map((matchup) => {
          const orderedMatchup = winnerFirstMatchup(matchup);
          return (
            <Table.Row key={`${matchup.leftSongId}-${matchup.rightSongId}`}>
              <Table.Cell>
                <SongLabel
                  name={songName(orderedMatchup.leftSongId)}
                  thumbnail={thumbnails.get(orderedMatchup.leftSongId)}
                />
              </Table.Cell>
              <Table.Cell>
                <SongLabel
                  name={songName(orderedMatchup.rightSongId)}
                  thumbnail={thumbnails.get(orderedMatchup.rightSongId)}
                />
              </Table.Cell>
              <Table.Cell>
                {orderedMatchup.leftWins}–{orderedMatchup.rightWins}
              </Table.Cell>
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}

function winnerFirstMatchup(matchup: CommunityStats['matchups'][number]) {
  const isTie = matchup.leftWins === matchup.rightWins;
  const rightWinsFirst = matchup.rightWins > matchup.leftWins;
  const rightIdFirstOnTie = isTie && compareSongIds(matchup.rightSongId, matchup.leftSongId) < 0;
  if (!rightWinsFirst && !rightIdFirstOnTie) return matchup;

  return {
    ...matchup,
    leftSongId: matchup.rightSongId,
    rightSongId: matchup.leftSongId,
    leftWins: matchup.rightWins,
    rightWins: matchup.leftWins
  };
}

function compareSongIds(leftId: string, rightId: string) {
  const leftNumber = Number(leftId);
  const rightNumber = Number(rightId);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return leftId.localeCompare(rightId);
}

function CorrelationTable({
  pairs,
  songName,
  thumbnails,
  songLabel,
  correlationLabel
}: {
  pairs: CommunityStats['correlations'];
  songName: (id: string) => string;
  thumbnails: Map<string, string | undefined>;
  songLabel: string;
  correlationLabel: string;
}) {
  return (
    <Table.Root size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Header>{songLabel}</Table.Header>
          <Table.Header>{songLabel}</Table.Header>
          <Table.Header>{correlationLabel}</Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {pairs.map((pair) => (
          <Table.Row key={`${pair.leftSongId}-${pair.rightSongId}`}>
            <Table.Cell>
              <SongLabel
                name={songName(pair.leftSongId)}
                thumbnail={thumbnails.get(pair.leftSongId)}
              />
            </Table.Cell>
            <Table.Cell>
              <SongLabel
                name={songName(pair.rightSongId)}
                thumbnail={thumbnails.get(pair.rightSongId)}
              />
            </Table.Cell>
            <Table.Cell>{formatCorrelation(pair.correlation)}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}

function ParticipantTable({ participants }: { participants: CommunityStats['participants'] }) {
  return (
    <Table.Root size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Header>Name</Table.Header>
          <Table.Header>Similarity</Table.Header>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {participants.map((participant, index) => (
          <Table.Row key={`${participant.displayName}-${index}`}>
            <Table.Cell>{participant.displayName}</Table.Cell>
            <Table.Cell>{Math.round(participant.similarity)}%</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
