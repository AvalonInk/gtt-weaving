import { useState, useRef } from 'react';
import type {
  AnyPattern, DoubleFacePattern, BrokenTwillPattern, ThreadedPattern,
  GTTFile, Palette, PatternType,
} from './types/gtt';
import {
  newDoubleFacePattern, newBrokenTwillPattern, newThreadedPattern, defaultPalette,
} from './types/gtt';
import { parseGTTFile } from './lib/parser';
import { serialiseGTTFile } from './lib/serialiser';
import { DoubleFaceEditor } from './components/DoubleFaceEditor';
import { ThreadedEditor } from './components/ThreadedEditor';
import { PaletteEditor } from './components/PaletteEditor';
import { WeavingPreview } from './components/WeavingPreview';
import './App.css';

const APP_VERSION = '2.0.0';

// Patterns that carry a top-level palette
function hasPalette(p: AnyPattern): p is DoubleFacePattern | BrokenTwillPattern | ThreadedPattern {
  return p.type === 'DoubleFace' || p.type === 'BrokenTwill' || p.type === 'Threaded';
}

function makeNewPattern(type: PatternType): AnyPattern {
  switch (type) {
    case 'BrokenTwill': return newBrokenTwillPattern(12, 20);
    case 'Threaded':    return newThreadedPattern(8, 20);
    default:            return newDoubleFacePattern(12, 20);
  }
}

function App() {
  const [pattern, setPattern] = useState<AnyPattern>(newDoubleFacePattern(12, 20));
  const [newType, setNewType] = useState<PatternType>('DoubleFace');
  const [fgIndex, setFgIndex] = useState(0);
  const [bgIndex, setBgIndex] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- File I/O ----

  function handleNew() {
    if (!confirm('Start a new pattern? Unsaved changes will be lost.')) return;
    setPattern(makeNewPattern(newType));
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
        const p = gttFile.pattern;
        setPattern(p);
        setFileName(file.name);
        setError(null);

        if (p.type === 'Brocade' || p.type === 'LetteredBand') {
          setError(
            `"${p.type}" patterns can be opened and saved but cannot be edited yet (planned for Phase 3).`
          );
        }
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
    const name = hasPalette(pattern) ? pattern.name : 'pattern';
    a.download = fileName ?? `${name || 'pattern'}.gtt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePaletteChange(newPalette: Palette) {
    if (!hasPalette(pattern)) return;
    setPattern(p => ({ ...p, palette: newPalette }));
  }

  function handleResetPalette() {
    if (!hasPalette(pattern)) return;
    setPattern(p => ({ ...p, palette: defaultPalette() }));
  }

  const palette = hasPalette(pattern) ? pattern.palette : null;
  const isDFlike = pattern.type === 'DoubleFace' || pattern.type === 'BrokenTwill';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="app-logo">⧖</span>
          GTT — Tabletweaving Thingy
        </div>
        <nav className="app-nav">
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as PatternType)}
            className="pattern-type-select"
            title="Pattern type for New"
          >
            <option value="DoubleFace">DoubleFace</option>
            <option value="BrokenTwill">BrokenTwill</option>
            <option value="Threaded">Threaded</option>
          </select>
          <button onClick={handleNew}>New</button>
          <button onClick={handleOpenClick}>Open…</button>
          <button onClick={handleSave}>Save .gtt</button>
        </nav>
        <div className="app-file-name">
          {fileName
            ? `📄 ${fileName} (${pattern.type})`
            : `(unsaved — ${pattern.type})`}
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
          {palette && (
            <>
              <PaletteEditor
                palette={palette}
                fgIndex={fgIndex}
                bgIndex={bgIndex}
                onChange={handlePaletteChange}
                onFgChange={setFgIndex}
                onBgChange={setBgIndex}
              />
              <button className="reset-palette-btn" onClick={handleResetPalette}>
                Reset palette
              </button>
            </>
          )}
          {isDFlike && (
            <WeavingPreview pattern={pattern as DoubleFacePattern | BrokenTwillPattern} />
          )}
        </aside>

        <section className="app-editor">
          {isDFlike && (
            <DoubleFaceEditor
              pattern={pattern as DoubleFacePattern | BrokenTwillPattern}
              fgIndex={fgIndex}
              bgIndex={bgIndex}
              onChange={setPattern}
            />
          )}
          {pattern.type === 'Threaded' && (
            <ThreadedEditor
              pattern={pattern as ThreadedPattern}
              onChange={setPattern}
            />
          )}
          {(pattern.type === 'Brocade' || pattern.type === 'LetteredBand') && (
            <div className="unsupported-editor">
              <p>"{pattern.type}" pattern editing is not yet available.</p>
              <p>You can open and re-save this file to preserve it.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="app-footer">
        GTT Modern Clone · Phase 2 (DoubleFace · BrokenTwill · Threaded) ·{' '}
        <a href="https://github.com/AvalonInk/gtt-weaving" target="_blank" rel="noreferrer">GitHub</a>
      </footer>
    </div>
  );
}

export default App;
