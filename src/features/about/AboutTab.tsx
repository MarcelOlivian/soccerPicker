/**
 * Static in-app documentation — no state, no props. Explains what each tab
 * does for the people actually using the app, since README.md only reaches
 * a developer reading the repo.
 */
export function AboutTab() {
  return (
    <div className="sp-about">
      <h2>About SquadRef</h2>

      <section className="sp-panel">
        <h3>What SquadRef is</h3>
        <p>
          SquadRef is a player-card database and team picker for pickup soccer. Build a roster of
          your regulars with a handful of stats and a photo, run a guided draft with a live
          balance meter, then arrange the two teams on a sketched pitch — solo on one screen, or
          live from two devices with the second captain picking on their own phone.
        </p>
      </section>

      <section className="sp-panel">
        <h3>Setup — building your roster</h3>
        <p>
          Every player gets a card: a photo (or an automatic monogram if there isn't one) and six
          FIFA-style stats — Pace, Shooting, Passing, Dribbling, Defending, Physicality — each
          1–5. Overall is computed automatically and depends on the position: the same player
          rates differently at GK, DEF, MID, or ATT. Click a card's flip icon to see a radar-chart
          view of its stats instead of the usual bar rows.
        </p>
        <ul>
          <li>Edit, duplicate, or delete any player from their card.</li>
          <li>
            <strong>Stats vote</strong> — start a planning-poker-style session: everyone secretly
            rates a player's six stats on their own device, then the host reveals and applies the
            averaged result. A verified player's card shows a "✓ Verified by vote" stamp.
          </li>
          <li>
            <strong>Import stats sheet (CSV)</strong> — bring in a spreadsheet of players at once.
            Rows are matched to existing players by name and shown in a review table before
            anything is written, so re-importing an updated sheet updates those players in place
            instead of creating duplicates.
          </li>
          <li>
            <strong>Export / Import roster (JSON)</strong> and <strong>Copy roster link</strong> —
            move a full roster (or just a link) to another device or browser.
          </li>
        </ul>
      </section>

      <section className="sp-panel">
        <h3>Match — attendance, draft, and the field</h3>
        <p>
          A match runs through three stages: <strong>Attendance</strong> → <strong>Draft</strong>{' '}
          → <strong>Field</strong>. Each stage unlocks the next only once it's actually finished —
          attendance must exactly match the chosen formation's headcount, and every attending
          player must be drafted before moving on to the field.
        </p>
        <ul>
          <li>
            <strong>Draft</strong> — captains alternate picks with a live balance meter showing
            how even the two teams are. Use <strong>Auto-draft teams</strong> for a quick
            best-player-available draft, or <strong>Suggest a swap</strong> to nudge an already
            -drafted pair of teams closer to even.
          </li>
          <li>
            <strong>Field</strong> — drag or tap players onto pitch positions, or use{' '}
            <strong>Auto-fill positions</strong> to place everyone at once. Captains get a subtle
            team-colored card tint.
          </li>
          <li>
            <strong>Live two-seat drafting</strong> — click "Go live" to open a peer-to-peer
            session; the second captain scans a QR code or opens the printed link to join and
            picks their own team's turns from their own device. If the connection can't be made,
            the draft still works fine on one screen.
          </li>
          <li>
            <strong>Match tracking</strong> — switch the Field stage from Setup to Tracking to
            start a running clock (with a pulsing recording indicator) and log what happens: goals
            (including own goals and assists), fouls, goalkeeper saves and concedes, corners and
            throw-ins, and mid-match position swaps — each recorded with a timestamp.
          </li>
        </ul>
      </section>

      <section className="sp-panel">
        <h3>History — saved matches</h3>
        <p>
          Once a match is finished, <strong>Save to history</strong> records the final teams,
          score, and full event log. Every saved match can be revisited later, and its score/
          summary or full event log can be copied to the clipboard to share in a chat.
        </p>
      </section>

      <section className="sp-panel">
        <h3>Compare — side-by-side radar charts</h3>
        <p>
          Select up to four players to overlay their six-stat radar shapes on one chart — a quick
          way to see how two or more players actually compare.
        </p>
      </section>

      <section className="sp-panel">
        <h3>Evolution — tracking a player over time</h3>
        <p>
          Pick a player to see their rating trajectory over time — a chart combining every stat
          change (from a vote, a manual edit, or an accepted suggestion) with every match they've
          played. Their match log highlights notable games (Hat-Trick, Clean Sheet, Match Winner),
          a suggestion engine proposes a stat change when recent performance clearly doesn't match
          their card, and a full audit log records exactly what changed and why.
        </p>
      </section>

      <section className="sp-panel">
        <h3>Everything stays on this device</h3>
        <p>
          SquadRef has no server and no accounts. The roster is stored in this browser's local
          storage, uploaded photos in its IndexedDB — nothing is sent anywhere. Exporting a JSON
          file or copying a roster link are the only ways data leaves the browser, and both are
          entirely under your control.
        </p>
      </section>
    </div>
  );
}
