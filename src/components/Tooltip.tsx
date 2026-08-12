import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

interface TooltipProps {
  content: ReactNode;
  delayMs?: number;
  children: ReactNode;
}

/** Hover/focus-triggered text hint. Square corners, ink border, no shadow — matches the app's card styling. */
export function Tooltip({ content, delayMs = 300, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    timerRef.current = setTimeout(() => setVisible(true), delayMs);
  }

  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setVisible(false);
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <span className="sp-tooltip-wrap" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <span className="sp-tooltip" role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
