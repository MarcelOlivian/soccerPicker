import { useEffect, useRef, useState } from 'react';
import { deleteImage, downscaleImage, getImageUrl, putImage } from '../lib/imageStore';

interface PhotoValue {
  photoUrl?: string;
  photoKey?: string;
}

interface PhotoInputProps {
  value: PhotoValue;
  onChange: (next: PhotoValue) => void;
}

/** URL field + file upload (downscaled into IndexedDB) with a live preview. Either source clears the other. */
export function PhotoInput({ value, onChange }: PhotoInputProps) {
  const [preview, setPreview] = useState<string | undefined>(value.photoUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (value.photoUrl) {
      setPreview(value.photoUrl);
      return;
    }
    if (value.photoKey) {
      getImageUrl(value.photoKey).then((url) => {
        if (!cancelled) setPreview(url);
      });
    } else {
      setPreview(undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [value.photoUrl, value.photoKey]);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const thumb = await downscaleImage(file);
      const oldKey = value.photoKey;
      const key = await putImage(thumb);
      if (oldKey) await deleteImage(oldKey);
      onChange({ photoKey: key, photoUrl: undefined });
    } catch {
      setError('Could not read that image — try a different file.');
    } finally {
      setBusy(false);
    }
  }

  async function handleUrlChange(url: string) {
    if (value.photoKey) await deleteImage(value.photoKey);
    onChange({ photoUrl: url || undefined, photoKey: undefined });
  }

  async function handleClear() {
    if (value.photoKey) await deleteImage(value.photoKey);
    onChange({ photoUrl: undefined, photoKey: undefined });
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="sp-photo-input">
      <div className="sp-photo-input__preview">
        {preview ? <img src={preview} alt="" /> : <span className="sp-hint">NO PHOTO</span>}
      </div>
      <div className="sp-photo-input__controls">
        <div className="sp-field">
          <label htmlFor="photo-url">Photo URL</label>
          <input
            id="photo-url"
            type="url"
            placeholder="https://…"
            value={value.photoUrl ?? ''}
            onChange={(e) => handleUrlChange(e.target.value)}
          />
        </div>
        <div className="sp-photo-input__row">
          <button
            type="button"
            className="sp-btn sp-btn--sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? 'Processing…' : 'Upload photo'}
          </button>
          {(value.photoUrl || value.photoKey) && (
            <button type="button" className="sp-btn sp-btn--sm sp-btn--ghost" onClick={handleClear}>
              Clear
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sp-visually-hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {error && <p className="sp-hint" role="alert">{error}</p>}
        <p className="sp-hint">Uploads are resized and stored on this device only.</p>
      </div>
    </div>
  );
}
