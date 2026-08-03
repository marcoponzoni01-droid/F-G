// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
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
	// MDX is here for one reason: an issue's chart belongs at a specific point in
	// the argument, not in a fixed slot the layout chooses. Everything else in an
	// issue is ordinary Markdown, and `extendMarkdownConfig` (the default) means
	// .mdx files inherit the settings below rather than needing their own.
	integrations: [mdx(), sitemap()],
	markdown: {
		shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
