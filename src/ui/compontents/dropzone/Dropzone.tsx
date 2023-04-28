/* eslint-disable no-await-in-loop */
/* eslint-disable no-plusplus */
/* eslint-disable no-continue */
import React, { useState, ReactNode } from 'react';

type FileDropZoneProps = {
  onFilesDroped: Function,
  children: ReactNode;
};

export default function FileDropZone({
  onFilesDroped,
  children,
}: FileDropZoneProps) {
  const [showOverlay, setShowOverlay] = useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setShowOverlay(true);
  };

  const handleDragLeave = () => {
    setShowOverlay(false);
  };

  const readFileContents = async (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file contents.'));
      }
    };
    reader.readAsText(file);
  });

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    const droppedFiles = {} as any;

    const { items } = event.dataTransfer;

    const contentPromises = [] as Promise<void>[];

    for (const item of items) {
      const entry = item.webkitGetAsEntry();
      if (entry?.isFile) {
        contentPromises.push((async () => {
          droppedFiles[entry.fullPath] = await readFileContents(item.getAsFile()!);
        })());
      } else if (entry?.isDirectory) {
        /* let r = new FileSystemDirectoryReader()
        
        let dirReader = (entry as FileSystemDirectoryEntry)!.createReader();
        dirReader.readEntries(console.log, console.log);
        */
      }
    }
    console.log(contentPromises);

    await Promise.all(contentPromises);

    setShowOverlay(false);
    onFilesDroped(droppedFiles);
  };

  const handleOverlayDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    return false;
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {children}
      {showOverlay
        && (
        <div
          onDragOver={handleOverlayDragOver}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <p>Drop files here to import</p>
        </div>
        )}
    </div>
  );
}
