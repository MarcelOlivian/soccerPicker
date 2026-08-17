import { useEffect, useRef, useState } from 'react';
import { downloadRosterExport, parseRosterImportFile } from '../lib/exportImport';
import { buildShareLink, parseShareLink } from '../lib/shareLink';
import { useAppState } from '../state/AppContext';

/**
 * Export / import / share-link controls, shown in the app header so they're
 * reachable from either tab. Also handles importing a roster carried in an
 * incoming `#roster=...` link on first load.
 */
export function HeaderControls() {
  const { state, dispatch } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<'info' | 'danger'>('info');
  const handledIncomingLink = useRef(false);

  function announce(message: string, kind: 'info' | 'danger' = 'info') {
    setNotice(message);
    setNoticeKind(kind);
  }

  // Handle a roster carried in the URL (from "Copy roster link") on first load only.
  useEffect(() => {
    if (handledIncomingLink.current) return;
    handledIncomingLink.current = true;
    if (!location.hash.includes('#roster=')) return;

    parseShareLink(location.hash).then((players) => {
      if (!players || players.length === 0) {
        announce('That roster link looks corrupted — nothing was imported.', 'danger');
        return;
      }
      const replace = confirm(
        `This link carries a roster of ${players.length} player(s).\n\nOK to REPLACE your current roster, or Cancel to MERGE it into your existing one.`,
      );
      dispatch({ type: 'MERGE_PLAYERS', players, mode: replace ? 'replace' : 'merge' });
      announce(`Imported ${players.length} player(s) from the link (${replace ? 'replaced' : 'merged'}).`);
      history.replaceState(null, '', location.pathname + location.search);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleExport() {
    if (state.players.length === 0 && state.history.length === 0) {
      announce('Nothing to export yet.', 'danger');
      return;
    }
    await downloadRosterExport(state.players, state.history);
    announce(`Exported ${state.players.length} player(s) and ${state.history.length} match(es).`);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const { players, history } = await parseRosterImportFile(text);
      const replace = confirm(
        `This file has ${players.length} player(s) and ${history.length} match(es).\n\nOK to REPLACE your current roster and history, or Cancel to MERGE it into your existing data.`,
      );
      const mode = replace ? 'replace' : 'merge';
      dispatch({ type: 'MERGE_PLAYERS', players, mode });
      dispatch({ type: 'MERGE_HISTORY', entries: history, mode });
      announce(
        `Imported ${players.length} player(s) and ${history.length} match(es) from file (${replace ? 'replaced' : 'merged'}).`,
      );
    } catch (err) {
      announce(err instanceof Error ? err.message : 'Could not read that file.', 'danger');
    }
  }

  async function handleCopyLink() {
    if (state.players.length === 0) {
      announce('No players to share yet.', 'danger');
      return;
    }
    const { url, skippedPhotoCount } = await buildShareLink(state.players);
    try {
      await navigator.clipboard.writeText(url);
      announce(
        skippedPhotoCount > 0
          ? `Roster link copied. ${skippedPhotoCount} uploaded photo(s) were left out — URL photos still work.`
          : 'Roster link copied to clipboard.',
      );
    } catch {
      announce('Could not access the clipboard — link: ' + url, 'danger');
    }
  }

  return (
    <>
      {notice && (
        <span className={`sp-header-notice ${noticeKind === 'danger' ? 'sp-header-notice--danger' : ''}`}>
          {notice}
          <button type="button" className="sp-header-notice__close" onClick={() => setNotice(null)} aria-label="Dismiss">
            ×
          </button>
        </span>
      )}
      <button type="button" className="sp-btn sp-btn--sm" onClick={handleCopyLink}>
        Copy roster link
      </button>
      <button type="button" className="sp-btn sp-btn--sm" onClick={handleExport}>
        Export
      </button>
      <button type="button" className="sp-btn sp-btn--sm" onClick={handleImportClick}>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="sp-visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = '';
        }}
      />
    </>
  );
}
