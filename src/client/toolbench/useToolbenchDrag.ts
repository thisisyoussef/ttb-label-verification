import { useCallback, useRef } from 'react';
import type { DragEvent } from 'react';

export const TOOLBENCH_DRAG_MIME = 'application/x-toolbench-asset';
/** Prefix used in text/plain fallback so we can distinguish toolbench drops from normal text drops. */
export const TOOLBENCH_PLAIN_PREFIX = '__toolbench__:';

export async function fetchAsFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

export function useToolbenchDrag(assetUrl: string, filename: string) {
  const dragImageRef = useRef<HTMLElement | null>(null);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const payload = JSON.stringify({ url: assetUrl, filename });
      event.dataTransfer.setData(TOOLBENCH_DRAG_MIME, payload);
      // Safari doesn't support getData() with custom MIME types — set text/plain as fallback
      event.dataTransfer.setData('text/plain', TOOLBENCH_PLAIN_PREFIX + payload);
      event.dataTransfer.effectAllowed = 'copy';
      if (dragImageRef.current) {
        event.dataTransfer.setDragImage(dragImageRef.current, 40, 40);
      }
    },
    [assetUrl, filename]
  );

  return { onDragStart, dragImageRef };
}
