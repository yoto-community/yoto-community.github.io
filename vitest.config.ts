import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'site/src/**/*.test.ts'],
    // The published core dist uses extensionless relative imports; inlining it
    // lets Vite resolve them instead of Node (same reason as astro.config).
    server: { deps: { inline: ['@yoto-community/pixel-editor-core'] } },
  },
});
