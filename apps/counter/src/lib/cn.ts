import clsx, { type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Tailwind class merger — clsx + tailwind-merge, taught about our custom tokens.
 *
 * Why extend: DESIGN.md emits `--text-display / --text-h1 / --text-body / ...`
 * (font-size group) AND `--color-fg / --color-primary-on / --color-accent / ...`
 * (text-color group). Stock tailwind-merge groups every `text-*` class as one
 * conflict bucket, so when a component writes `text-primary-on text-body` it
 * silently strips the color class. That left buttons with invisible text in
 * the original setup.
 *
 * Teach tailwind-merge that font-size and text-color are distinct groups,
 * keyed by the token names DESIGN.md actually defines.
 */
const FONT_SIZE_TOKENS = ['display', 'h1', 'body', 'body-sm', 'caption'];
const TEXT_COLOR_TOKENS = [
  'fg', 'fg-muted', 'fg-soft',
  'primary', 'primary-on', 'secondary', 'accent',
  'success', 'danger', 'surface', 'surface-2',
  'border', 'border-strong',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': FONT_SIZE_TOKENS.map((t) => `text-${t}`),
      'text-color': TEXT_COLOR_TOKENS.map((t) => `text-${t}`),
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
