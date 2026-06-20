import React, { useRef, useState, useCallback } from 'react';

/**
 * Drag-and-drop + click-to-browse file upload zone.
 * Props:
 *   onFile(File)  — called when a file is selected or dropped
 *   file          — currently selected File (or null)
 *   accept        — file accept string (e.g. ".tsr,.json")
 *   disabled      — disables interaction
 *   icon          — emoji shown when empty
 *   emptyTitle    — text when no file selected
 *   emptySub      — sub-text when no file selected
 *   children      — rendered instead of default UI when file is set
 */
export default function DropZone({ onFile, file, accept, disabled, icon = '🗂️', emptyTitle, emptySub, children }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const processFile = useCallback((f) => {
    if (!f || disabled) return;
    onFile(f);
  }, [onFile, disabled]);

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (disabled) return;
    const dropped = e.dataTransfer.files[0];
    if (dropped) processFile(dropped);
  }

  function onClick() {
    if (!disabled) inputRef.current?.click();
  }

  function onChange(e) {
    processFile(e.target.files[0]);
    e.target.value = '';
  }

  const zoneClass = [
    'upload-zone',
    file ? 'has-file' : '',
    dragging ? 'dragging' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={zoneClass}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={onChange}
        disabled={disabled}
      />
      {file && children ? children : (
        file ? (
          <>
            <div className="upload-icon">📄</div>
            <div className="upload-title">{file.name}</div>
            <div className="upload-sub" style={{ color: 'var(--green)' }}>File selected ✓</div>
          </>
        ) : (
          <>
            <div className="upload-icon">{icon}</div>
            <div className="upload-title">{emptyTitle || 'Drop file here or click to browse'}</div>
            {emptySub && <div className="upload-sub">{emptySub}</div>}
          </>
        )
      )}
    </div>
  );
}
