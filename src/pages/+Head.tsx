import { Partytown } from '@builder.io/partytown/react';
import { Metadata } from '~/components/layout/Metadata';
import { useTranslation } from 'react-i18next';
import { usePageContext } from 'vike-react/usePageContext';

export function Head() {
  const { t } = useTranslation();
  const { urlPathname } = usePageContext();
  const basePath = (import.meta.env.BASE_URL ?? '').replace(/\/$/, '');
  const pagePath = urlPathname.replace(/\/$/, '');
  const isSongsPage = pagePath === '/songs' || pagePath === `${basePath}/songs`;
  const title = isSongsPage
    ? t('title', { titlePrefix: t('songs') })
    : t('title', { titlePrefix: t('defaultTitlePrefix') });

  return (
    <>
      <Metadata title={title} />

      <script
        type="text/partytown"
        src="https://www.googletagmanager.com/gtag/js?id=G-GWEPPCT889"
      ></script>

      <script
        type="text/partytown"
        dangerouslySetInnerHTML={{
          __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag() {
              dataLayer.push(arguments);
          }
          gtag("js", new Date());
          gtag("config", "G-GWEPPCT889");
          `
        }}
      />

      <Partytown lib={(import.meta.env.PUBLIC_ENV__BASE_URL ?? '') + '/~partytown/'} />
    </>
  );
}
