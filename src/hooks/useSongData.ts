import type { Song } from '~/types/songs';
import songData from '../../data/songs.json';

export const useSongData = () => {
  return songData as unknown as Song[];
};
