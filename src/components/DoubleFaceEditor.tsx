import { useState, useCallback } from 'react';
import type { DoubleFacePattern, ThreadingDirection } from '../types/gtt';

interface Props {
  pattern: DoubleFacePattern;
  fgIndex: number;
  bgIndex: number;
  onChange: (pattern: DoubleFacePattern) => void;
}

type DrawMode = 'fg' | 'bg' | null;

export function DoubleFaceEditor({ pattern, fgIndex, bgIndex, onChange }: Props) {
  const [isDrawing, setIsDrawing] = useState<DrawMode>(null);
  const [cardSetupOpen, setCardSetupOpen] = useState(false);

  const { width, length, data, palette } = pattern;
  const colours = palette.colours;

  // ---- Cell painting ----

  function setCellValue(block: number, cardIdx: number, value: '0' | '1') {
    const newData = [...data];
    const row = (newData[block] ?? '0'.repeat(width)).split('');
    row[cardIdx] = value;
    newData[block] = row.join('');
    onChange({ ...pattern, data: newData });
  }

  function handleCellEvent(e: React.MouseEvent, block: number, cardIdx: number) {
    e.preventDefault();
    const value = e.button === 2 || e.altKey ? '0' : '1';
    const mode: DrawMode = value === '1' ? 'fg' : 'bg';
    setIsDrawing(mode);
    setCellValue(block, cardIdx, value);
  }

  const handleCellEnter = useCallback((block: number, cardIdx: number) => {
    if (isDrawing === null) return;
    setCellValue(block, cardIdx, isDrawing === 'fg' ? '1' : '0');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing, data, width]);

  function stopDrawing() { setIsDrawing(null); }

  // ---- Pattern size ----

  function resize(newWidth: number, newLength: number) {
    const w = Math.max(1, Math.min(64, newWidth));
    const l = Math.max(1, Math.min(200, newLength));

    // Adjust cards array
    let newCards = [...pattern.cards];
    while (newCards.length < w) {
      const n = newCards.length;
      newCards.push({
        number: n + 1,
        holes: 4,
        holeColours: [
          { colourIndex: fgIndex + 1 },
          { colourIndex: fgIndex + 1 },
          { colourIndex: bgIndex + 1 },
          { colourIndex: bgIndex + 1 },
        ],
        threading: (n % 2 === 0 ? 'S' : 'Z') as ThreadingDirection,
      });
    }
    newCards = newCards.slice(0, w).map((c, i) => ({ ...c, number: i + 1 }));

    // Adjust data rows
    let newData = data.map(row => {
      if (row.length < w) return row + '0'.repeat(w - row.length);
      return row.slice(0, w);
    });
    while (newData.length < l) newData.push('0'.repeat(w));
    newData = newData.slice(0, l);

    onChange({ ...pattern, width: w, length: l, cards: newCards, data: newData });
  }

  // ---- Card threading ----

  function setCardThreading(cardIdx: number, dir: ThreadingDirection) {
    const newCards = pattern.cards.map((c, i) =>
      i === cardIdx ? { ...c, threading: dir } : c
    );
    onChange({ ...pattern, cards: newCards });
  }

  // ---- Fill operations ----

  function fillAll(value: '0' | '1') {
    onChange({ ...pattern, data: Array(length).fill(value.repeat(width)) });
  }

  function invertAll() {
    const newData = data.map(row =>
      row.split('').map(c => (c === '1' ? '0' : '1')).join('')
    );
    onChange({ ...pattern, data: newData });
  }

  // ---- Rendering helpers ----

  function cellColour(block: number, cardIdx: number): string {
    const bit = (data[block] ?? '')[cardIdx] ?? '0';
    const card = pattern.cards[cardIdx];
    if (!card) return bit === '1' ? `#${colours[fgIndex] ?? '888888'}` : `#${colours[bgIndex] ?? '444444'}`;
    const fgHole = card.holeColours[0];
    const bgHole = card.holeColours[card.holes > 2 ? 2 : 1] ?? card.holeColours[0];
    const fgIdx = (fgHole?.colourIndex ?? 1) - 1;
    const bgIdx = (bgHole?.colourIndex ?? 2) - 1;
    return bit === '1'
      ? `#${colours[fgIdx] ?? '888888'}`
      : `#${colours[bgIdx] ?? '444444'}`;
  }

  const cellSize = Math.max(10, Math.min(24, Math.floor(600 / width)));

  return (
    <div className="df-editor" onMouseUp={stopDrawing} onMouseLeave={stopDrawing}>
      {/* Toolbar */}
      <div className="df-toolbar">
        <span className="toolbar-section">Size:</span>
        <label>
          Cards
          <input
            type="number" min={1} max={64} value={width}
            onChange={e => resize(parseInt(e.target.value, 10) || 1, length)}
          />
        </label>
        <label>
          Blocks
          <input
            type="number" min={1} max={200} value={length}
            onChange={e => resize(width, parseInt(e.target.value, 10) || 1)}
          />
        </label>

        <span className="toolbar-sep" />

        <span className="toolbar-section">Fill:</span>
        <button onClick={() => fillAll('1')} title="Fill all foreground">All FG</button>
        <button onClick={() => fillAll('0')} title="Fill all background">All BG</button>
        <button onClick={invertAll} title="Invert all cells">Invert</button>

        <span className="toolbar-sep" />

        <label>
          Name:
          <input
            type="text" value={pattern.name}
            onChange={e => onChange({ ...pattern, name: e.target.value })}
          />
        </label>

        <button onClick={() => setCardSetupOpen(v => !v)}>
          {cardSetupOpen ? 'Hide' : 'Show'} Card Setup
        </button>
      </div>

      {/* Card setup panel */}
      {cardSetupOpen && (
        <div className="card-setup">
          <table className="card-table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Threading</th>
                <th colSpan={4}>Hole colours (A B C D)</th>
              </tr>
            </thead>
            <tbody>
              {pattern.cards.map((card, i) => (
                <tr key={card.number}>
                  <td>{card.number}</td>
                  <td>
                    <select
                      value={card.threading}
                      onChange={e => setCardThreading(i, e.target.value as ThreadingDirection)}
                    >
                      <option value="S">S</option>
                      <option value="Z">Z</option>
                    </select>
                  </td>
                  {card.holeColours.slice(0, 4).map((hole, h) => (
                    <td key={h}>
                      <select
                        value={hole.colourIndex}
                        onChange={e => {
                          const newCards = pattern.cards.map((c, ci) => {
                            if (ci !== i) return c;
                            const newHoles = c.holeColours.map((hc, hi) =>
                              hi === h ? { colourIndex: parseInt(e.target.value, 10) } : hc
                            );
                            return { ...c, holeColours: newHoles };
                          });
                          onChange({ ...pattern, cards: newCards });
                        }}
                      >
                        {colours.slice(0, 16).map((c, ci) => (
                          <option key={ci} value={ci + 1}>
                            {ci + 1} (#{c})
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Grid */}
      <div className="df-grid-wrap">
        {/* Column headers (card numbers) */}
        <div className="df-col-headers" style={{ paddingLeft: 32 }}>
          {Array.from({ length: width }, (_, i) => (
            <div
              key={i}
              className="df-col-header"
              style={{ width: cellSize, fontSize: Math.max(8, cellSize - 4) }}
              title={`Card ${i + 1} (${pattern.cards[i]?.threading ?? '?'})`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="df-grid-body">
          {Array.from({ length }, (_, block) => (
            <div key={block} className="df-row">
              {/* Row number */}
              <div className="df-row-num" style={{ width: 28, fontSize: 10 }}>{block + 1}</div>
              {/* Cells */}
              {Array.from({ length: width }, (_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="df-cell"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: cellColour(block, cardIdx),
                  }}
                  onMouseDown={e => handleCellEvent(e, block, cardIdx)}
                  onMouseEnter={() => handleCellEnter(block, cardIdx)}
                  onContextMenu={e => e.preventDefault()}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="df-hint">
        Left-click/drag = foreground &nbsp;|&nbsp; Right-click/drag = background
      </div>
    </div>
  );
}
