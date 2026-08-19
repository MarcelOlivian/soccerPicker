import { useState } from 'react';
import type { CsvImportRow } from '../lib/csvImport';
import { STAT_KEYS, STAT_LABELS } from '../types';
import { Modal } from './Modal';

interface CsvImportReviewModalProps {
  rows: CsvImportRow[];
  onConfirm: (acceptedRows: CsvImportRow[]) => void;
  onCancel: () => void;
}

/**
 * Shown after a CSV file is parsed, before anything is written — lets the
 * user exclude a bad name match or an unwanted row (checkboxes default to
 * accepted) and shows which rows will update an existing player vs. create
 * a new one.
 */
export function CsvImportReviewModal({ rows, onConfirm, onCancel }: CsvImportReviewModalProps) {
  const [acceptedKeys, setAcceptedKeys] = useState<Set<string>>(() => new Set(rows.map((r) => r.key)));

  const existingCount = rows.filter((r) => r.existingPlayer).length;
  const newCount = rows.length - existingCount;
  const allAccepted = acceptedKeys.size === rows.length;

  function toggleRow(key: string) {
    setAcceptedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setAcceptedKeys(allAccepted ? new Set() : new Set(rows.map((r) => r.key)));
  }

  function handleConfirm() {
    onConfirm(rows.filter((r) => acceptedKeys.has(r.key)));
  }

  return (
    <Modal onClose={onCancel} ariaLabel="Review CSV import" className="sp-modal-panel--wide">
      <p className="sp-modal-panel__title">Review CSV import</p>
      <p className="sp-hint">
        {existingCount} existing player{existingCount === 1 ? '' : 's'} will be updated, {newCount} new player
        {newCount === 1 ? '' : 's'} will be created.
      </p>
      <div className="sp-vote-panel__table-wrap">
        <table className="sp-vote-panel__table">
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allAccepted} onChange={toggleAll} aria-label="Select all rows" />
              </th>
              <th>Name</th>
              <th>Position</th>
              {STAT_KEYS.map((key) => (
                <th key={key}>{STAT_LABELS[key]}</th>
              ))}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <input
                    type="checkbox"
                    checked={acceptedKeys.has(row.key)}
                    onChange={() => toggleRow(row.key)}
                    aria-label={`Import ${row.name || 'unnamed row'}`}
                  />
                </td>
                <td>
                  {row.name || '—'}
                  {row.nickname && <span className="sp-card__nickname"> ({row.nickname})</span>}
                </td>
                <td>{row.position}</td>
                {STAT_KEYS.map((key) => (
                  <td key={key}>{row.stats[key]}</td>
                ))}
                <td>
                  {row.existingPlayer ? (
                    <span className="sp-badge sp-badge--existing">Existing</span>
                  ) : (
                    <span className="sp-badge sp-badge--new">New</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="sp-modal-panel__actions">
        <button type="button" className="sp-btn sp-btn--primary" disabled={acceptedKeys.size === 0} onClick={handleConfirm}>
          Import selected ({acceptedKeys.size})
        </button>
        <button type="button" className="sp-btn sp-btn--ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
