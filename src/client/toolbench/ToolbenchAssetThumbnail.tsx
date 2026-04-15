import { useState } from 'react';
import { fetchAsFile, useToolbenchDrag } from './useToolbenchDrag';

interface ToolbenchAssetThumbnailProps {
  name: string;
  description: string;
  url: string;
  filename: string;
  onLoad: (file: File) => void;
  kind: 'image' | 'csv';
}

export function ToolbenchAssetThumbnail({
  name,
  description,
  url,
  filename,
  onLoad,
  kind,
}: ToolbenchAssetThumbnailProps) {
  const [loading, setLoading] = useState(false);
  const { onDragStart, dragImageRef } = useToolbenchDrag(url, filename);

  async function handleLoad() {
    if (loading) return;
    setLoading(true);
    try {
      const file = await fetchAsFile(url, filename);
      onLoad(file);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      ref={dragImageRef as React.RefObject<HTMLDivElement>}
      aria-label={`Asset: ${name} — ${description}`}
      className="group relative flex flex-col gap-1 rounded border border-outline-variant/30 bg-surface-container-lowest p-1.5 cursor-grab active:cursor-grabbing"
    >
      <div className="relative overflow-hidden rounded bg-surface-dim aspect-square flex items-center justify-center">
        {kind === 'image' ? (
          <img
            src={url}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant text-3xl">
            table_chart
          </span>
        )}

        <button
          onClick={handleLoad}
          disabled={loading}
          aria-label={`Load ${name}`}
          className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-surface-container-lowest border border-outline-variant/40 text-on-surface opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <span className="material-symbols-outlined text-[14px] animate-spin">
              progress_activity
            </span>
          ) : (
            <span className="material-symbols-outlined text-[14px]">
              arrow_downward
            </span>
          )}
        </button>
      </div>

      <p className="text-[10px] font-label font-semibold text-on-surface leading-tight line-clamp-1">
        {name}
      </p>
    </div>
  );
}
