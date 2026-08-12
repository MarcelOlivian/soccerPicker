function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface MonogramProps {
  name: string;
}

/** Fallback square photo tile: initials on the theme's well colour, used when a player has no photo. */
export function Monogram({ name }: MonogramProps) {
  return (
    <div className="sp-monogram" aria-hidden="true">
      {initials(name)}
    </div>
  );
}
