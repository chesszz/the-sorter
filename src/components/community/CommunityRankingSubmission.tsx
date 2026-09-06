import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, HStack, Stack } from 'styled-system/jsx';
import type { Song } from '~/types/songs';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Text } from '~/components/ui/text';
import { FormLabel } from '~/components/ui/form-label';
import { Link } from '~/components/ui/link';
import {
  getRankingFromOrder,
  deleteCommunityRanking,
  getSavedCommunitySubmission,
  isCommunityRankingsConfigured,
  saveCommunitySubmission,
  submitCommunityRanking,
  type SavedCommunitySubmission
} from '~/utils/communityRankings';

export function CommunityRankingSubmission({
  order,
  songs
}: {
  order?: string[][];
  songs: Song[];
}) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [saved, setSaved] = useState<SavedCommunitySubmission>();
  const [status, setStatus] = useState<string>();
  const [showStatsLink, setShowStatsLink] = useState(false);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const existing = getSavedCommunitySubmission();
    setSaved(existing);
    if (existing) setDisplayName(existing.displayName);
  }, []);

  const ranking = useMemo(() => (order ? getRankingFromOrder(order, songs) : []), [order, songs]);
  const isComplete =
    ranking.length >= 2 && new Set(ranking.map((entry) => entry.songId)).size === ranking.length;

  if (!isCommunityRankingsConfigured) return null;

  const submit = async () => {
    if (!isComplete || displayName.trim().length < 1) return;
    setLoading(true);
    setStatus(undefined);
    setShowStatsLink(false);
    setError(undefined);
    try {
      const submission = await submitCommunityRanking(displayName.trim(), ranking, saved);
      saveCommunitySubmission(submission);
      setSaved(submission);
      setStatus(saved ? t('community.updated') : t('community.submitted'));
      setShowStatsLink(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : t('community.submit_error')
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteRanking = async () => {
    if (!saved || !window.confirm(t('community.delete_confirm'))) return;
    setLoading(true);
    setError(undefined);
    setStatus(undefined);
    setShowStatsLink(false);
    try {
      await deleteCommunityRanking(saved);
      setSaved(undefined);
      setStatus(t('community.deleted'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('community.delete_error'));
    } finally {
      setLoading(false);
    }
  };

  const copyEditLink = async () => {
    if (!saved) return;
    await navigator.clipboard.writeText(saved.editUrl);
    setStatus(t('community.edit_link_copied'));
  };

  return (
    <Box border="1px solid" borderColor="border.default" rounded="l1" w="full" maxW="xl" p="4">
      <Stack gap="3">
        <Text fontSize="lg" fontWeight="bold">
          {t('community.submit_title')}
        </Text>
        <Text color="fg.muted" fontSize="sm">
          {t('community.submit_description')}
        </Text>
        <HStack alignItems="end" flexWrap="wrap">
          <Stack flex="1" gap="1" minW="220px">
            <FormLabel htmlFor="community-display-name" fontSize="sm" fontWeight="bold">
              {t('community.name_label')}
            </FormLabel>
            <Input
              id="community-display-name"
              value={displayName}
              maxLength={40}
              placeholder={t('community.name_placeholder')}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Stack>
          <Button
            onClick={() => void submit()}
            loading={loading}
            disabled={loading || !isComplete || displayName.trim().length < 1}
          >
            {saved ? t('community.update') : t('community.submit')}
          </Button>
        </HStack>
        {!isComplete && (
          <Text color="fg.muted" fontSize="sm">
            {t('community.complete_ranking')}
          </Text>
        )}
        {status && (
          <Stack gap="1">
            <Text role="status" color="green.600" fontSize="sm">
              {status}
            </Text>
            {showStatsLink && (
              <Link
                href={`${import.meta.env.BASE_URL.replace(/\/+$/, '')}/stats`}
                textDecoration="underline"
                fontWeight="bold"
              >
                {t('community.view_stats')}
              </Link>
            )}
          </Stack>
        )}
        {error && (
          <Text role="alert" color="red.600" fontSize="sm">
            {error}
          </Text>
        )}
        {saved && (
          <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
            <Text color="fg.muted" fontSize="xs">
              {t('community.keep_edit_link')}
            </Text>
            <Button size="xs" variant="outline" onClick={() => void copyEditLink()}>
              {t('community.copy_edit_link')}
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={loading}
              onClick={() => void deleteRanking()}
            >
              {t('community.delete')}
            </Button>
          </HStack>
        )}
      </Stack>
    </Box>
  );
}
