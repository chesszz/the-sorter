import { useTranslation } from 'react-i18next';
import type { WithRank } from '~/types';
import { Table } from '~/components/ui/table';
import { Text } from '~/components/ui/text';
import type { Song } from '~/types/songs';
import { getSongColor } from '~/utils/song';
import { MiniDots } from '~/components/sorter/MiniDots';
import { getSongName } from '~/utils/names';
import { getAssetUrl } from '~/utils/assets';
import type { GuessResult } from '~/hooks/useHeardleState';

export function SongRankingTable({
  songs,
  onSelectSong,
  guessResults,
  maxAttempts
}: {
  songs: WithRank<Song>[];
  onSelectSong?: (character: WithRank<Song>) => void;
  guessResults?: Record<string, GuessResult>;
  maxAttempts?: number;
}) {
  const { t, i18n } = useTranslation();

  const lang = i18n.language;

  return (
    <Table.Root size="sm">
      <Table.Head>
        <Table.Row>
          <Table.Header textAlign={'center'}>{t('ranking')}</Table.Header>
          <Table.Header textAlign={'center'}>{t('song-name')}</Table.Header>
          <Table.Header textAlign={'center'}>{t('thumbnail')}</Table.Header>
          {guessResults && (
            <Table.Header textAlign={'center'}>{t('heardle.heardle_column')}</Table.Header>
          )}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {songs.map((c, idx) => {
          const { rank, name, englishName, thumbnail } = c;
          const colorCode = getSongColor(c);

          return (
            <Table.Row
              key={idx}
              style={{ ['--color' as 'color']: colorCode }}
              onClick={onSelectSong && (() => onSelectSong(c))}
              cursor="pointer"
              borderLeft="8px solid"
              borderLeftColor="var(--color)"
              borderBottomColor="var(--color)"
            >
              <Table.Cell>{rank}</Table.Cell>
              <Table.Cell>
                <Text layerStyle="textStroke" color="var(--color)" fontSize="md" fontWeight="bold">
                  {getSongName(name, englishName, lang)}
                </Text>
              </Table.Cell>
              <Table.Cell textAlign="center">
                {thumbnail && (
                  <img
                    src={getAssetUrl(thumbnail)}
                    alt={getSongName(name, englishName, lang)}
                    loading="lazy"
                    style={{ width: '96px', height: '96px', objectFit: 'cover', margin: 'auto' }}
                  />
                )}
              </Table.Cell>
              {guessResults && maxAttempts && (
                <Table.Cell>
                  {guessResults[c.id] && guessResults[c.id].result !== 'no-audio' && (
                    <MiniDots result={guessResults[c.id]} maxAttempts={maxAttempts} />
                  )}
                </Table.Cell>
              )}
            </Table.Row>
          );
        })}
      </Table.Body>
    </Table.Root>
  );
}
