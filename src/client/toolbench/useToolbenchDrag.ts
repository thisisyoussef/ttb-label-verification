import { useCallback, useRef } from 'react';
import type { DragEvent } from 'react';

export const TOOLBENCH_DRAG_MIME = 'application/x-toolbench-asset';

export async function fetchAsFile(url: string, filename: string): Promise<File> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], filename, { type: blob.type });
}

export function useToolbenchDrag(assetUrl: string, filename: string) {
  const dragImageRef = useRef<HTMLElement | null>(null);

  const onDragStart = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.dataTransfer.setData(TOOLBENCH_DRAG_MIME, JSON.stringify({ url: assetUrl, filename }));
      event.dataTransfer.effectAllowed = 'copy';
      if (dragImageRef.current) {
        event.dataTransfer.setDragImage(dragImageRef.current, 40, 40);
      }
    },
    [assetUrl, filename]
  );

  return { onDragStart, dragImageRef };
}
