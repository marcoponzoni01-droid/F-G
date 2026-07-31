// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Hosting is deliberately undecided. Both values are read from the environment so
// that choosing a host later is a build-time variable, never a code change.
//   GitHub Pages (project site): SITE_URL=https://<user>.github.io BASE_PATH=/F-G
//   Vercel / custom domain:      SITE_URL=https://thedossier.example
// See docs/DEPLOYING.md.
const SITE_URL = process.env.SITE_URL ?? 'http://localhost:4321';
const BASE_PATH = process.env.BASE_PATH ?? '/';

export default defineConfig({
	site: SITE_URL,
	base: BASE_PATH,
	trailingSlash: 'ignore',
	integrations: [sitemap()],
	markdown: {
		shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
