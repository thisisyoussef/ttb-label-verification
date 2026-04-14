import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';

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

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!options.interactive) {
      return;
    }

    if (options.trackDragState) {
      setIsDragOver(true);
    }
  };

  const onDragLeave = () => {
    if (options.trackDragState) {
      setIsDragOver(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (options.trackDragState) {
      setIsDragOver(false);
    }

    if (!options.interactive) {
      return;
    }

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
    onDragOver,
    onDragLeave,
    onDrop,
    onKeyDown
  };
}
