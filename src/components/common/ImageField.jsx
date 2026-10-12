import { useState } from 'react';
import Icon from './Icon';
import { uploadService } from '../../services/uploadService';
import { useUiStore } from '../../store/uiStore';
import { resolveImg } from '../../utils/media';

/**
 * Single-image picker: preview + upload (stores the relative /uploads/... path)
 * + optional "paste a URL" input + remove. Controlled via value/onChange.
 */
export default function ImageField({ value, onChange, onUploadingChange, previewWidth = 120, previewHeight = 80 }) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const setBusy = (v) => {
    setUploading(v);
    onUploadingChange?.(v);
  };

  const handleFile = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadService.upload(file));
    } catch (err) {
      pushToast({ title: 'Upload failed', subtitle: err.message, kind: 'err' });
    } finally {
      setBusy(false);
      input.value = '';
    }
  };

  return (
    <div className="img-field">
      {value ? (
        <span className="img-field-preview" style={{ width: previewWidth, height: previewHeight }}>
          <img src={resolveImg(value)} alt="" />
          <button type="button" className="img-field-rm" aria-label="Remove image" onClick={() => onChange('')} disabled={uploading}>
            <Icon name="x" className="icon icon-sm" />
          </button>
        </span>
      ) : null}
      <label className={`dropzone img-field-drop ${uploading ? 'busy' : ''}`}>
        {uploading ? 'Uploading…' : value ? 'Change photo' : 'Click to upload a photo'}
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={handleFile} disabled={uploading} />
      </label>
      <div className="row gap-2 wrap">
        <button type="button" className="link-underline tiny" onClick={() => setShowUrl((v) => !v)}>
          {showUrl ? 'Hide URL field' : 'Or paste an image URL'}
        </button>
        <span className="tiny muted">JPG, PNG, WebP or GIF, up to 5 MB.</span>
      </div>
      {showUrl && (
        <input
          className="input"
          value={value || ''}
          placeholder="https://… or /uploads/…"
          onChange={(e) => onChange(e.target.value.trim())}
        />
      )}
    </div>
  );
}
