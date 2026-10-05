/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Fez's app and application policies remain on the chat product's site.
      ...['app', 'cli', 'extensions', 'judge', 'privacy', 'terms'].map((path) => ({
        source: `/${path}/:path*`,
        destination: `https://fez.chat/${path}/:path*`,
        permanent: true,
      })),
      // The Sidecar/agent-network page is the CLI page now.
      { source: '/network', destination: '/cli', permanent: true },
      // Retired pages: the front page carries the pitch now. Temporary, so
      // an old link lands somewhere useful without freezing the decision.
      ...['/bazaar', '/whitepaper', '/mine', '/roadmap'].map((source) => ({ source, destination: '/', permanent: false })),
    ];
  },
};

export default config;
