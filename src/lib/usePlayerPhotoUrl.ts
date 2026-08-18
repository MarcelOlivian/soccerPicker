import { useEffect, useState } from 'react';
import { getImageUrl } from './imageStore';
import type { Player } from '../types';

/** Resolves a player's photo to a displayable URL, whether it's an external link or an uploaded IndexedDB blob. */
export function usePlayerPhotoUrl(player: Player): string | undefined {
  const [url, setUrl] = useState<string | undefined>(player.photoUrl);

  useEffect(() => {
    let cancelled = false;
    if (player.photoUrl) {
      setUrl(player.photoUrl);
      return;
    }
    if (player.photoKey) {
      getImageUrl(player.photoKey).then((resolved) => {
        if (!cancelled) setUrl(resolved);
      });
    } else {
      setUrl(undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [player.photoUrl, player.photoKey]);

  return url;
}
