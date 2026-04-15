import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import {
  TOOLBENCH_DRAG_MIME,
  TOOLBENCH_PLAIN_PREFIX,
  fetchAsFile
} from './toolbench/useToolbenchDrag';

interface UseFileDropInputOptions {
  interactive: boolean;
  multiple?: boolean;
  trackDragState?: boolean;
  filterFiles?: (files: File[]) => File[];
  onSelect?: (files: File[]) => void;
}

export function useFileDropInput(options: UseFileDropInputOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const normalizeFiles = (files: File[]) =>
    (options.filterFiles ? options.filterFiles(files) : files).slice(
      0,
      options.multiple ? undefined : 1
    );

  const emitSelectedFiles = (files: File[]) => {
    const nextFiles = normalizeFiles(files);
    if (nextFiles.length > 0) {
      options.onSelect?.(nextFiles);
    }
  };

  const openPicker = () => {
    if (!options.interactive) {
      return;
    }

    inputRef.current?.click();
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    emitSelectedFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const onDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!options.interactive) return;
    if (options.trackDragState) setIsDragOver(true);
  };

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!options.interactive) return;
    if (options.trackDragState) setIsDragOver(true);
  };

  const onDragLeave = () => {
    if (options.trackDragState) setIsDragOver(false);
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (options.trackDragState) setIsDragOver(false);
    if (!options.interactive) return;

    // Check for toolbench asset drag — try custom MIME first, then text/plain fallback (Safari)
    const toolbenchPayload = extractToolbenchPayload(event);
    if (toolbenchPayload) {
      fetchAsFile(toolbenchPayload.url, toolbenchPayload.filename).then((file) => {
        emitSelectedFiles([file]);
      });
      return;
    }

    // Normal file drop
    emitSelectedFiles(Array.from(event.dataTransfer.files));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!options.interactive) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker();
    }
  };

  return {
    inputRef,
    isDragOver,
    openPicker,
    onInputChange,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    onKeyDown
  };
}

function extractToolbenchPayload(
  event: DragEvent<HTMLElement>
): { url: string; filename: string } | null {
  // Try the custom MIME type first (works in Chrome/Firefox)
  const custom = event.dataTransfer.getData(TOOLBENCH_DRAG_MIME);
  if (custom) {
    try {
      return JSON.parse(custom) as { url: string; filename: string };
    } catch {
      /* ignore */
    }
  }
  // Fallback: text/plain with prefix (Safari compat)
  const plain = event.dataTransfer.getData('text/plain');
  if (plain?.startsWith(TOOLBENCH_PLAIN_PREFIX)) {
    try {
      return JSON.parse(plain.slice(TOOLBENCH_PLAIN_PREFIX.length)) as {
        url: string;
        filename: string;
      };
    } catch {
      /* ignore */
    }
  }
  return null;
}
