import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yoto-community.github.io',
  base: '/',
  outDir: './dist',
  build: { format: 'directory' },
  vite: {
    watch: {
      polling: true,
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    fs: {
      strict: false,
    },
  },
  integrations: [
    sitemap({
      // The French status page is flattened to /fr/404.html by scripts/postbuild.ts.
      filter: (page) => !page.endsWith('/fr/404/'),
    }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: { prefixDefaultLocale: false },
  },
});
