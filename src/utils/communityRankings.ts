import type { Song } from '~/types/songs';

export const COMMUNITY_RANKING_VERSION = 'phantom-siita-v1';
const API_URL = import.meta.env.PUBLIC_ENV__RANKINGS_API_URL?.trim() ?? '';
const BROWSER_ID_KEY = 'community-ranking-browser-id';
const SAVED_SUBMISSION_KEY = 'community-ranking-submission';

export type CommunityRankingEntry = {
  songId: string;
  rank: number;
};

export type SavedCommunitySubmission = {
  submissionId: string;
  editToken: string;
  displayName: string;
  editUrl: string;
};

export type CommunitySongStats = {
  songId: string;
  averageRank: number;
  medianRank: number;
  firstPlacePercent: number;
  lastPlacePercent: number;
  sampleSize: number;
};

export type CommunityMatchupStats = {
  leftSongId: string;
  rightSongId: string;
  leftWins: number;
  rightWins: number;
  ties: number;
  total: number;
};

export type CommunityCorrelationStats = {
  leftSongId: string;
  rightSongId: string;
  correlation: number;
  sampleSize: number;
};

export type CommunityParticipantStats = {
  displayName: string;
  similarity: number;
  distance: number;
};

export type CommunityStats = {
  version: string;
  submissionCount: number;
  songs: CommunitySongStats[];
  matchups: CommunityMatchupStats[];
  correlations: CommunityCorrelationStats[];
  participants: CommunityParticipantStats[];
};

type ApiResponse<T> = {
  ok: boolean;
  message?: string;
  data?: T;
  submissionId?: string;
  editToken?: string;
};

export const isCommunityRankingsConfigured = API_URL.length > 0;

function getBrowserId() {
  if (typeof window === 'undefined') return '';

  const existing = window.localStorage.getItem(BROWSER_ID_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(BROWSER_ID_KEY, id);
  return id;
}

export function getSavedCommunitySubmission(): SavedCommunitySubmission | undefined {
  if (typeof window === 'undefined') return undefined;

  const value = window.localStorage.getItem(SAVED_SUBMISSION_KEY);
  if (!value) {
    const prefix = '#community-edit=';
    if (!window.location.hash.startsWith(prefix)) return undefined;
    const [submissionId, editToken] = decodeURIComponent(
      window.location.hash.slice(prefix.length)
    ).split('.', 2);
    if (!submissionId || !editToken) return undefined;
    return {
      submissionId,
      editToken,
      displayName: '',
      editUrl: window.location.href
    };
  }

  try {
    return JSON.parse(value) as SavedCommunitySubmission;
  } catch {
    window.localStorage.removeItem(SAVED_SUBMISSION_KEY);
    return undefined;
  }
}

export function saveCommunitySubmission(submission: SavedCommunitySubmission) {
  window.localStorage.setItem(SAVED_SUBMISSION_KEY, JSON.stringify(submission));
}

export function getRankingFromOrder(order: string[][], songs: Song[]): CommunityRankingEntry[] {
  return order
    .flatMap((group, groupIndex) =>
      group.map((songId) => ({
        songId: `${songId}`,
        rank: groupIndex + 1
      }))
    )
    .filter((entry) => songs.some((song) => song.id === entry.songId));
}

function createToken() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function submitWithForm(payload: Record<string, unknown>) {
  if (!isCommunityRankingsConfigured) {
    throw new Error('Community rankings are not configured.');
  }

  return new Promise<void>((resolve, reject) => {
    const requestId = createToken();
    const frameName = `community-ranking-${Date.now()}`;
    const frame = document.createElement('iframe');
    frame.name = frameName;
    frame.title = 'Community ranking submission';
    frame.hidden = true;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = API_URL;
    form.target = frameName;
    form.hidden = true;
    const input = document.createElement('input');
    input.name = 'payload';
    input.value = JSON.stringify({ ...payload, requestId });
    form.appendChild(input);
    document.body.append(frame, form);
    const handleMessage = (
      event: MessageEvent<{ type?: string; requestId?: string; ok?: boolean; message?: string }>
    ) => {
      if (event.data?.type !== 'community-ranking-response' || event.data.requestId !== requestId)
        return;
      cleanup();
      if (event.data.ok) resolve();
      else
        reject(
          new Error(event.data.message ?? 'The community rankings service rejected the ranking.')
        );
    };
    window.addEventListener('message', handleMessage);
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('The community rankings service timed out.'));
    }, 15000);
    const cleanup = () => {
      window.removeEventListener('message', handleMessage);
      window.clearTimeout(timeout);
      window.setTimeout(() => {
        frame.remove();
        form.remove();
      }, 1000);
    };
    frame.addEventListener(
      'error',
      () => {
        cleanup();
        reject(new Error('The community rankings service could not be reached.'));
      },
      { once: true }
    );
    form.submit();
  });
}

export async function submitCommunityRanking(
  displayName: string,
  ranking: CommunityRankingEntry[],
  saved?: SavedCommunitySubmission
) {
  const browserId = getBrowserId();
  const submissionId = saved?.submissionId ?? `${browserId}:${COMMUNITY_RANKING_VERSION}`;
  const editToken = saved?.editToken ?? createToken();
  await submitWithForm({
    action: 'submit',
    version: COMMUNITY_RANKING_VERSION,
    displayName,
    browserId,
    ranking,
    submissionId,
    editToken
  });

  const editUrl = `${window.location.origin}${import.meta.env.BASE_URL}songs#community-edit=${encodeURIComponent(submissionId)}.${encodeURIComponent(editToken)}`;
  return {
    submissionId,
    editToken,
    displayName,
    editUrl
  } satisfies SavedCommunitySubmission;
}

export async function fetchCommunityStats() {
  if (!isCommunityRankingsConfigured) {
    throw new Error('Community rankings are not configured.');
  }

  const url = new URL(API_URL);
  url.searchParams.set('action', 'stats');
  url.searchParams.set('version', COMMUNITY_RANKING_VERSION);
  return new Promise<CommunityStats>((resolve, reject) => {
    const callbackName = `communityStats_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    url.searchParams.set('callback', callbackName);
    const cleanup = () => {
      delete (window as unknown as Record<string, unknown>)[callbackName];
      script.remove();
    };
    (window as unknown as Record<string, unknown>)[callbackName] = (
      result: ApiResponse<CommunityStats>
    ) => {
      cleanup();
      if (!result.ok || !result.data) {
        reject(new Error(result.message ?? 'The community stats service returned an error.'));
        return;
      }
      resolve(result.data);
    };
    script.src = url.toString();
    script.addEventListener('error', () => {
      cleanup();
      reject(new Error('The community stats service could not be reached.'));
    });
    document.head.appendChild(script);
  });
}
