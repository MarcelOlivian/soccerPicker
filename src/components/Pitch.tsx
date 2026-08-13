import type { ReactNode } from 'react';

/**
 * Inline SVG pitch drawn in the theme's ink-on-greige style — no green fill,
 * no gradients, just hairline strokes. Children are absolutely positioned
 * slot markers, placed by the caller using each slot's normalized x/y.
 *
 * `portrait` turns the pitch a quarter turn clockwise for phones, where a
 * landscape pitch is too short to keep the slots from overlapping. The shapes
 * below stay authored in landscape coordinates either way — the group
 * transform maps (x, y) -> (60 - y, x), matching `slotCoords` in
 * `lib/formations.ts` so the lines and the slots agree.
 */
export function Pitch({ children, portrait = false }: { children: ReactNode; portrait?: boolean }) {
  return (
    <div className={`sp-pitch ${portrait ? 'sp-pitch--portrait' : ''}`}>
      <svg
        className="sp-pitch__lines"
        viewBox={portrait ? '0 0 60 100' : '0 0 100 60'}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g transform={portrait ? 'translate(60 0) rotate(90)' : undefined}>
          <rect x="1" y="1" width="98" height="58" fill="none" stroke="var(--sp-line)" strokeWidth="0.5" />
          <line x1="50" y1="1" x2="50" y2="59" stroke="var(--sp-line)" strokeWidth="0.4" />
          <circle cx="50" cy="30" r="8" fill="none" stroke="var(--sp-line)" strokeWidth="0.4" />
          <circle cx="50" cy="30" r="0.6" fill="var(--sp-line)" />
          {/* Team A penalty + six-yard box */}
          <rect x="1" y="14" width="16" height="32" fill="none" stroke="var(--sp-line)" strokeWidth="0.4" />
          <rect x="1" y="22" width="6" height="16" fill="none" stroke="var(--sp-line)" strokeWidth="0.4" />
          {/* Team B penalty + six-yard box (mirrored) */}
          <rect x="83" y="14" width="16" height="32" fill="none" stroke="var(--sp-line)" strokeWidth="0.4" />
          <rect x="93" y="22" width="6" height="16" fill="none" stroke="var(--sp-line)" strokeWidth="0.4" />
        </g>
      </svg>
      <div className="sp-pitch__slots">{children}</div>
    </div>
  );
}
