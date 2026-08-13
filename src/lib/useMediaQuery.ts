import { useEffect, useState } from 'react';

/**
 * The phone breakpoint, shared between CSS and JS.
 *
 * Most of the responsive work is pure CSS, but the pitch also needs the
 * breakpoint in JS: slot positions are inline styles computed from normalized
 * coordinates, and the portrait pitch transposes them. Exporting the query
 * string from one place keeps the two from drifting apart — this must stay in
 * sync with the `@media (max-width: 700px)` blocks in the stylesheets.
 */
export const PHONE_QUERY = '(max-width: 700px)';

/**
 * Where the board drops to a single column and the pitch turns portrait.
 *
 * Wider than PHONE_QUERY on purpose: a landscape pitch stops having room for
 * its slots as soon as the board stacks, so tablets and split-screen windows
 * hit the same overlapping-slots problem phones do. Must stay in sync with the
 * `@media (max-width: 900px)` blocks in the stylesheets.
 */
export const BOARD_STACK_QUERY = '(max-width: 900px)';

/** Subscribes to a CSS media query. Returns false in environments without matchMedia (e.g. jsdom). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Re-read on subscribe: the query may have changed between render and effect.
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** True when the viewport is phone-sized and the layout should switch to its compact form. */
export function usePhoneLayout(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** True when the board is stacked into one column, so the pitch should render portrait. */
export function usePortraitPitch(): boolean {
  return useMediaQuery(BOARD_STACK_QUERY);
}

/**
 * True when the primary pointer is imprecise (touch), as opposed to a mouse
 * or trackpad. Distinct from `hover: none`: this answers "how precise is the
 * pointer," which is the relevant question for whether native HTML5
 * drag-and-drop should be offered at all — on touch it competes with the
 * OS's own long-press handling rather than working reliably.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery('(pointer: coarse)');
}
