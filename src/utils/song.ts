import { uniq } from 'lodash-es';
import seriesInfo from '../../data/series-info.json';
import type { HasuSong, Song } from '~/types/songs';
import { token } from 'styled-system/tokens';

export const getHasuSongColor = (song: HasuSong) => {
  switch (song.unit) {
    case 'スリーズブーケ':
      return 'rgb(229,162,193)';
    case 'DOLLCHESTRA':
      return 'rgb(20,48,139)';
    case 'みらくらぱーく!':
      return 'rgb(246,211,75)';
    default:
      return '#fb8a9b';
  }
};

export const getSongColor = (song: Song) => {
  const series = uniq(song.seriesIds);
  if (series.length > 1) return token('colors.phantom.default');
  return seriesInfo.find((s) => s.id === series[0] + '')?.color ?? token('colors.phantom.default');
};
