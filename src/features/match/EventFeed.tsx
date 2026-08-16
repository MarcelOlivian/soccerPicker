import { useState } from 'react';
import type { EventFeedEntry } from '../../lib/matchEvents';

interface EventFeedProps {
  /** Chronological, oldest first — matching match.events itself. */
  entries: EventFeedEntry[];
}

const TICKER_COUNT = 3;

/**
 * Combines two related asks into one control: by default it's a compact
 * ticker of the last few actions (glanceable, no tap needed, most-recent
 * first) so nobody has to second-guess whether a goal just registered;
 * tapping it opens the full chronological log (oldest first, like a real
 * running timeline) for settling a "wait, when did that happen" dispute
 * later in the half.
 */
export function EventFeed({ entries }: EventFeedProps) {
  const [expanded, setExpanded] = useState(false);
  if (entries.length === 0) return null;

  const ticker = entries.slice(-TICKER_COUNT).reverse();
  const visible = expanded ? entries : ticker;

  return (
    <div className="sp-event-feed">
      <div className="sp-event-feed__head">
        <h4>Event log</h4>
        {entries.length > TICKER_COUNT && (
          <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Show recent' : `Show all ${entries.length}`}
          </button>
        )}
      </div>
      <ul className="sp-event-feed__list">
        {visible.map((entry) => (
          <li key={entry.id}>{entry.text}</li>
        ))}
      </ul>
    </div>
  );
}
