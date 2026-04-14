import { useState, useRef } from 'react';
import type { DoubleFacePattern, GTTFile } from './types/gtt';
import { newDoubleFacePattern, defaultPalette } from './types/gtt';
import { parseGTTFile } from './lib/parser';
import { serialiseGTTFile } from './lib/serialiser';
import { DoubleFaceEditor } from './components/DoubleFaceEditor';
import { PaletteEditor } from './components/PaletteEditor';
import { WeavingPreview } from './components/WeavingPreview';
import './App.css';

const APP_VERSION = '1.0.0';

function App() {
  const [pattern, setPattern] = useState<DoubleFacePattern>(newDoubleFacePattern(12, 20));
  const [fgIndex, setFgIndex] = useState(0); // white
  const [bgIndex, setBgIndex] = useState(1); // black
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- File I/O ----

  function handleNew() {
    if (!confirm('Start a new pattern? Unsaved changes will be lost.')) return;
    setPattern(newDoubleFacePattern(12, 20));
    setFileName(null);
    setError(null);
  }

  function handleOpenClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const gttFile = parseGTTFile(reader.result as string);
        if (gttFile.pattern.type !== 'DoubleFace') {
          setError(`This file contains a "${gttFile.pattern.type}" pattern. Only DoubleFace patterns are supported in Phase 1.`);
          return;
        }
        setPattern(gttFile.pattern as DoubleFacePattern);
        setFileName(file.name);
        setError(null);
      } catch (err) {
        setError(`Failed to open file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleSave() {
    const gttFile: GTTFile = { version: APP_VERSION, pattern };
    const xml = serialiseGTTFile(gttFile);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName ?? `${pattern.name || 'pattern'}.gtt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePaletteChange(newPalette: typeof pattern.palette) {
    setPattern(p => ({ ...p, palette: newPalette }));
  }

  function handleResetPalette() {
    setPattern(p => ({ ...p, palette: defaultPalette() }));
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-logo">⧖</span>
          GTT — Tabletweaving Thingy
        </div>
        <nav className="app-nav">
          <button onClick={handleNew}>New</button>
          <button onClick={handleOpenClick}>Open…</button>
          <button onClick={handleSave}>Save .gtt</button>
        </nav>
        <div className="app-file-name">
          {fileName ? `📄 ${fileName}` : '(unsaved)'}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".gtt"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </header>

      {error && (
        <div className="error-banner">
          ⚠ {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <main className="app-main">
        <aside className="app-sidebar">
          <PaletteEditor
            palette={pattern.palette}
            fgIndex={fgIndex}
            bgIndex={bgIndex}
            onChange={handlePaletteChange}
            onFgChange={setFgIndex}
            onBgChange={setBgIndex}
          />
          <button className="reset-palette-btn" onClick={handleResetPalette}>
            Reset palette
          </button>
          <WeavingPreview pattern={pattern} />
        </aside>

        <section className="app-editor">
          <DoubleFaceEditor
            pattern={pattern}
            fgIndex={fgIndex}
            bgIndex={bgIndex}
            onChange={setPattern}
          />
        </section>
      </main>

      <footer className="app-footer">
        GTT Modern Clone · Phase 1 (DoubleFace) ·{' '}
        <a href="https://github.com" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  );
}

export default App;
