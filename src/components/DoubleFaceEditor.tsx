import { useState, useCallback } from 'react';
import type { DoubleFacePattern, BrokenTwillPattern, ThreadingDirection, AnyPattern } from '../types/gtt';

type DFPattern = DoubleFacePattern | BrokenTwillPattern;

interface Props {
  pattern: DFPattern;
  fgIndex: number;
  bgIndex: number;
  onChange: (pattern: AnyPattern) => void;
}

type DrawMode = 'fg' | 'bg' | null;
type EditMode = 'paint' | 'reversal';

const HOLE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function DoubleFaceEditor({ pattern, fgIndex, bgIndex, onChange }: Props) {
  const [isDrawing, setIsDrawing] = useState<DrawMode>(null);
  const [editMode, setEditMode] = useState<EditMode>('paint');
  const [cardSetupOpen, setCardSetupOpen] = useState(false);

  const { width, length, data, palette } = pattern;
  const colours = palette.colours;
  const isBT = pattern.type === 'BrokenTwill';
  const reversals = isBT ? (pattern as BrokenTwillPattern).reversals : null;

  // ---- Helpers ----

  function isReversed(block: number, cardIdx: number): boolean {
    return reversals?.[block]?.[cardIdx] === '1';
  }

  // ---- Cell painting ----

  function setCellValue(block: number, cardIdx: number, value: '0' | '1') {
    if (editMode === 'reversal' && isBT) {
      const bt = pattern as BrokenTwillPattern;
      const newReversals = [...bt.reversals];
      const row = (newReversals[block] ?? '0'.repeat(width)).split('');
      row[cardIdx] = value;
      newReversals[block] = row.join('');
      onChange({ ...bt, reversals: newReversals });
    } else {
      const newData = [...data];
      const row = (newData[block] ?? '0'.repeat(width)).split('');
      row[cardIdx] = value;
      newData[block] = row.join('');
      onChange({ ...pattern, data: newData });
    }
  }

  function handleCellEvent(e: React.MouseEvent, block: number, cardIdx: number) {
    e.preventDefault();
    const value = e.button === 2 || e.altKey ? '0' : '1';
    setIsDrawing(value === '1' ? 'fg' : 'bg');
    setCellValue(block, cardIdx, value);
  }

  const handleCellEnter = useCallback((block: number, cardIdx: number) => {
    if (isDrawing === null) return;
    setCellValue(block, cardIdx, isDrawing === 'fg' ? '1' : '0');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing, data, reversals, width, editMode, isBT]);

  function stopDrawing() { setIsDrawing(null); }

  // ---- Pattern size ----

  function resize(newWidth: number, newLength: number) {
    const w = Math.max(1, Math.min(64, newWidth));
    const l = Math.max(1, Math.min(200, newLength));
    const currentHoles = pattern.cards[0]?.holes ?? 4;

    let newCards = [...pattern.cards];
    while (newCards.length < w) {
      const n = newCards.length;
      newCards.push({
        number: n + 1,
        holes: currentHoles,
        holeColours: Array.from({ length: currentHoles }, (_, hi) => ({
          colourIndex: hi < Math.ceil(currentHoles / 2) ? fgIndex + 1 : bgIndex + 1,
        })),
        threading: (n % 2 === 0 ? 'S' : 'Z') as ThreadingDirection,
      });
    }
    newCards = newCards.slice(0, w).map((c, i) => ({ ...c, number: i + 1 }));

    let newData = data.map(row => {
      if (row.length < w) return row + '0'.repeat(w - row.length);
      return row.slice(0, w);
    });
    while (newData.length < l) newData.push('0'.repeat(w));
    newData = newData.slice(0, l);

    if (isBT) {
      const bt = pattern as BrokenTwillPattern;
      let newReversals = bt.reversals.map(row => {
        if (row.length < w) return row + '0'.repeat(w - row.length);
        return row.slice(0, w);
      });
      while (newReversals.length < l) newReversals.push('0'.repeat(w));
      newReversals = newReversals.slice(0, l);
      onChange({ ...bt, width: w, length: l, cards: newCards, data: newData, reversals: newReversals });
    } else {
      onChange({ ...pattern, width: w, length: l, cards: newCards, data: newData });
    }
  }

  // ---- Hole count ----

  function setAllHoles(h: number) {
    const holes = Math.max(3, Math.min(8, h));
    const newCards = pattern.cards.map(c => {
      let newHoleColours = [...c.holeColours];
      while (newHoleColours.length < holes) {
        newHoleColours.push({ colourIndex: bgIndex + 1 });
      }
      newHoleColours = newHoleColours.slice(0, holes);
      return { ...c, holes, holeColours: newHoleColours };
    });
    onChange({ ...pattern, cards: newCards });
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
    if (editMode === 'reversal' && isBT) {
      const bt = pattern as BrokenTwillPattern;
      onChange({ ...bt, reversals: Array(length).fill(value.repeat(width)) });
    } else {
      onChange({ ...pattern, data: Array(length).fill(value.repeat(width)) });
    }
  }

  function invertAll() {
    if (editMode === 'reversal' && isBT) {
      const bt = pattern as BrokenTwillPattern;
      const newReversals = bt.reversals.map(row =>
        row.split('').map(c => (c === '1' ? '0' : '1')).join('')
      );
      onChange({ ...bt, reversals: newReversals });
    } else {
      const newData = data.map(row =>
        row.split('').map(c => (c === '1' ? '0' : '1')).join('')
      );
      onChange({ ...pattern, data: newData });
    }
  }

  // ---- Rendering helpers ----

  function cellColour(block: number, cardIdx: number): string {
    if (editMode === 'reversal') {
      return isReversed(block, cardIdx) ? '#c2571a' : '#2a2a2a';
    }
    const bit = (data[block] ?? '')[cardIdx] ?? '0';
    const card = pattern.cards[cardIdx];
    if (!card) return bit === '1' ? `#${colours[fgIndex] ?? '888888'}` : `#${colours[bgIndex] ?? '444444'}`;
    const fgHole = card.holeColours[0];
    const bgHole = card.holeColours[card.holes > 2 ? 2 : 1] ?? card.holeColours[0];
    const fgIdx = (fgHole?.colourIndex ?? 1) - 1;
    const bgIdx = (bgHole?.colourIndex ?? 2) - 1;
    return bit === '1' ? `#${colours[fgIdx] ?? '888888'}` : `#${colours[bgIdx] ?? '444444'}`;
  }

  const cellSize = Math.max(10, Math.min(24, Math.floor(600 / width)));
  const holesPerCard = pattern.cards[0]?.holes ?? 4;

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
        <label>
          Holes
          <input
            type="number" min={3} max={8} value={holesPerCard}
            onChange={e => setAllHoles(parseInt(e.target.value, 10) || 4)}
          />
        </label>

        <span className="toolbar-sep" />

        {isBT && (
          <>
            <span className="toolbar-section">Mode:</span>
            <button
              className={editMode === 'paint' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setEditMode('paint')}
            >Paint</button>
            <button
              className={editMode === 'reversal' ? 'mode-btn active' : 'mode-btn'}
              onClick={() => setEditMode('reversal')}
            >Reversals</button>
            <span className="toolbar-sep" />
          </>
        )}

        <span className="toolbar-section">Fill:</span>
        <button onClick={() => fillAll('1')} title={editMode === 'reversal' ? 'Set all reversed' : 'Fill all foreground'}>
          {editMode === 'reversal' ? 'All ×' : 'All FG'}
        </button>
        <button onClick={() => fillAll('0')} title={editMode === 'reversal' ? 'Clear all reversals' : 'Fill all background'}>
          {editMode === 'reversal' ? 'Clear' : 'All BG'}
        </button>
        <button onClick={invertAll} title="Invert all">Invert</button>

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
                {HOLE_LABELS.slice(0, holesPerCard).map(l => <th key={l}>{l}</th>)}
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
                  {card.holeColours.slice(0, holesPerCard).map((hole, h) => (
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
              <div className="df-row-num" style={{ width: 28, fontSize: 10 }}>{block + 1}</div>
              {Array.from({ length: width }, (_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="df-cell"
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: cellColour(block, cardIdx),
                    position: 'relative',
                  }}
                  onMouseDown={e => handleCellEvent(e, block, cardIdx)}
                  onMouseEnter={() => handleCellEnter(block, cardIdx)}
                  onContextMenu={e => e.preventDefault()}
                >
                  {isBT && editMode === 'paint' && isReversed(block, cardIdx) && (
                    <span className="reversal-mark">×</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="df-hint">
        {editMode === 'reversal'
          ? 'Left-click/drag = mark reversal  |  Right-click/drag = clear reversal'
          : 'Left-click/drag = foreground  |  Right-click/drag = background'}
      </div>
    </div>
  );
}
