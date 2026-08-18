import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

interface ModalProps {
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

/**
 * Portals its content to document.body so `position: fixed` always resolves against the
 * viewport. Several ancestors in this app now use backdrop-filter, which — like transform/
 * filter — creates a new containing block for fixed-position descendants, silently breaking an
 * in-tree modal's positioning whenever it happens to render inside one of them.
 */
export function Modal({ onClose, ariaLabel, children, className }: ModalProps) {
  return createPortal(
    <div className="sp-modal-backdrop" onClick={onClose}>
      <div
        className={`sp-modal-panel${className ? ` ${className}` : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
