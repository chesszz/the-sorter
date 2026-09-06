import artists from '../../data/artists-info.json';
import schools from '../../data/school.json';
import series from '../../data/series.json';
import units from '../../data/units.json';
import type { Locale } from '~/i18n';

export const getSchoolName = (school: string, locale: Locale | undefined) => {
  if (isEnglishLocale(locale) && school in schools) return schools[school as keyof typeof schools];
  return school;
};
export const getSeriesName = (serie: string, locale: Locale | undefined) => {
  if (isEnglishLocale(locale) && serie in series) return series[serie as keyof typeof series];
  return serie;
};
export const getUnitName = (unit: string, locale: Locale | undefined) => {
  const tmp = units.find((u) => u.name === unit);
  if (isEnglishLocale(locale) && tmp?.englishName) return tmp.englishName;
  return unit;
};
export const getArtistName = (artist: string, locale: Locale | undefined) => {
  const found = artists.find((a) => a.name === artist);
  if (isEnglishLocale(locale) && found?.englishName) return found.englishName;
  return artist;
};

const getLanguage = (locale: Locale | undefined) => locale?.toLowerCase().split(/[-_]/)[0];

export const isEnglishLocale = (locale: Locale | undefined) => getLanguage(locale) === 'en';

export const isJapaneseLocale = (locale: Locale | undefined) => getLanguage(locale) === 'ja';

export const getSongName = (
  name: string,
  englishName: string | undefined,
  locale: Locale | undefined
): string => {
  return isJapaneseLocale(locale) ? name : (englishName ?? name);
};

export const getSongSecondaryName = (
  name: string,
  englishName: string | undefined,
  locale: Locale | undefined
): string | undefined => {
  if (!englishName) return undefined;
  return isJapaneseLocale(locale) ? englishName : name;
};

export function getFullPerformanceName(perf: {
  tourName: string;
  performanceName?: string;
  selectionLabel?: string;
}): string {
  if (perf.selectionLabel) return perf.selectionLabel;
  if (!perf.performanceName) return perf.tourName;
  return `${perf.tourName} - ${perf.performanceName}`;
}
