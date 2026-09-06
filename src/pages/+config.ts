import vikeReact from 'vike-react/config';

const baseUrl = process.env.PUBLIC_ENV__BASE_URL ?? '';

export default {
  // ...
  // Setting to toggle SSR
  ssr: true,

  stream: true,

  redirects: {
    '/': `${baseUrl}/songs`
  },

  extends: [vikeReact]
};
