/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy Fez product routes remain on the chat product's site.
      // Zils serves its own Privacy and Terms pages locally.
      ...['app', 'extensions', 'judge'].map((path) => ({
        source: `/${path}/:path*`,
        destination: `https://fez.chat/${path}/:path*`,
        permanent: true,
      })),
      // Keep Zils account approval local; older CLI product links still belong to Fez.
      { source: '/cli', destination: 'https://fez.chat/cli', permanent: true },
      { source: '/cli/:path((?!authorize$).*)', destination: 'https://fez.chat/cli/:path', permanent: true },
      // The Sidecar/agent-network page is the CLI page now.
      { source: '/network', destination: '/cli', permanent: true },
      // Retired pages: the front page carries the pitch now. Temporary, so
      // an old link lands somewhere useful without freezing the decision.
      ...['/bazaar', '/whitepaper', '/mine', '/roadmap'].map((source) => ({ source, destination: '/', permanent: false })),
    ];
  },
};

export default config;
