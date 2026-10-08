// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import tailwindcss from '@tailwindcss/postcss';
import { expect, it } from 'vitest';

it('builds the existing theme, responsive layout, and accessible focus styles', async () => {
  const from = fileURLToPath(new URL('./index.css', import.meta.url));
  const source = await readFile(from, 'utf8');
  const { css } = await postcss([tailwindcss()]).process(
    `${source}\n.theme-check { @apply bg-brand-500; }`,
    { from }
  );

  expect(css).toContain('background-color: #6366f1');
  expect(css).toContain('.sm\\:px-6');
  expect(css).toContain('.backdrop\\:backdrop-blur-xs');
  expect(css).toContain('@media (forced-colors: active)');
  expect(css).toContain('outline: 2px solid transparent');
});
