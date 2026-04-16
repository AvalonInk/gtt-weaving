import { useState, useCallback } from 'react';
import type {
  ThreadedPattern, Pick, TurnAction, TurnDirection, ThreadingDirection, AnyPattern,
} from '../types/gtt';

interface Props {
  pattern: ThreadedPattern;
  onChange: (pattern: AnyPattern) => void;
}

// ---- Action helpers ----

function getCardTurnAction(pick: Pick, cardNum: number): TurnAction | null {
  for (const a of pick.actions) {
    if (a.type === 'Turn' && a.target === 'Card' && a.targetId === String(cardNum)) {
      return a as TurnAction;
    }
  }
  return null;
}

function cycleDir(current: TurnDirection | null): TurnDirection {
  if (current === null || current === 'I') return 'F';
  if (current === 'F') return 'B';
  return 'I';
}

function setPickCardAction(pick: Pick, cardNum: number, dir: TurnDirection): Pick {
  const filtered = pick.actions.filter(
    a => !(a.type === 'Turn' && a.target === 'Card' && a.targetId === String(cardNum))
  );
  const action: TurnAction = { type: 'Turn', target: 'Card', targetId: String(cardNum), dir, dist: 1 };
  return { ...pick, actions: [...filtered, action] };
}

// ---- Colour map ----

const DIR_BG: Record<string, string> = {
  F: '#1a5c38',
  B: '#7a2e0a',
  I: '#3a3a3a',
};
const DIR_FG: Record<string, string> = {
  F: '#a8e6c0',
  B: '#f4a97a',
  I: '#888888',
};

const HOLE_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function ThreadedEditor({ pattern, onChange }: Props) {
  const [isDrawing, setIsDrawing] = useState<TurnDirection | null>(null);
  const [cardSetupOpen, setCardSetupOpen] = useState(false);

  const { cards, picks, palette } = pattern;
  const colours = palette.colours;
  const cardCount = cards.length;
  const pickCount = picks.length;
  const holesPerCard = cards[0]?.holes ?? 4;

  // ---- Pick/card updates ----

  function updatePick(pickIdx: number, newPick: Pick) {
    const newPicks = picks.map((p, i) => i === pickIdx ? newPick : p);
    onChange({ ...pattern, picks: newPicks });
  }

  function handleCellDown(e: React.MouseEvent, pickIdx: number, cardNum: number) {
    e.preventDefault();
    let newDir: TurnDirection;
    if (e.button === 2 || e.altKey) {
      newDir = 'I';
    } else {
      const current = getCardTurnAction(picks[pickIdx], cardNum)?.dir ?? null;
      newDir = cycleDir(current);
    }
    setIsDrawing(newDir);
    updatePick(pickIdx, setPickCardAction(picks[pickIdx], cardNum, newDir));
  }

  const handleCellEnter = useCallback((pickIdx: number, cardNum: number) => {
    if (isDrawing === null) return;
    updatePick(pickIdx, setPickCardAction(picks[pickIdx], cardNum, isDrawing));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing, picks]);

  function stopDrawing() { setIsDrawing(null); }

  // ---- Resize ----

  function resize(newCardCount: number, newPickCount: number) {
    const nc = Math.max(1, Math.min(64, newCardCount));
    const np = Math.max(1, Math.min(200, newPickCount));

    let newCards = [...cards];
    while (newCards.length < nc) {
      const n = newCards.length;
      newCards.push({
        number: n + 1,
        holes: holesPerCard,
        holeColours: Array.from({ length: holesPerCard }, (_, hi) => ({
          colourIndex: hi < Math.ceil(holesPerCard / 2) ? 1 : 2,
        })),
        threading: (n % 2 === 0 ? 'S' : 'Z') as ThreadingDirection,
      });
    }
    newCards = newCards.slice(0, nc).map((c, i) => ({ ...c, number: i + 1 }));

    let newPicks = picks.map(p => {
      // Remove actions for removed cards, keep non-card actions
      const filtered = p.actions.filter(a => {
        if (a.target === 'Card') {
          const n = parseInt(a.targetId, 10);
          return n >= 1 && n <= nc;
        }
        return true;
      });
      // Add F actions for newly added cards
      const existing = new Set(
        filtered.filter(a => a.target === 'Card').map(a => parseInt(a.targetId, 10))
      );
      const added = newCards
        .filter(c => !existing.has(c.number))
        .map(c => ({
          type: 'Turn' as const, target: 'Card' as const,
          targetId: String(c.number), dir: 'F' as const, dist: 1 as const,
        }));
      return { ...p, actions: [...filtered, ...added] };
    });
    while (newPicks.length < np) {
      newPicks.push({
        index: newPicks.length,
        actions: newCards.map(c => ({
          type: 'Turn' as const, target: 'Card' as const,
          targetId: String(c.number), dir: 'F' as const, dist: 1 as const,
        })),
      });
    }
    newPicks = newPicks.slice(0, np).map((p, i) => ({ ...p, index: i }));

    onChange({ ...pattern, cards: newCards, picks: newPicks });
  }

  // ---- Fill operations ----

  function fillAll(dir: TurnDirection) {
    const newPicks = picks.map(p => ({
      ...p,
      actions: cards.map(c => ({
        type: 'Turn' as const, target: 'Card' as const,
        targetId: String(c.number), dir, dist: 1 as const,
      })),
    }));
    onChange({ ...pattern, picks: newPicks });
  }

  // ---- Card threading / holes ----

  function setCardThreading(cardIdx: number, dir: ThreadingDirection) {
    const newCards = cards.map((c, i) => i === cardIdx ? { ...c, threading: dir } : c);
    onChange({ ...pattern, cards: newCards });
  }

  function setAllHoles(h: number) {
    const holes = Math.max(3, Math.min(8, h));
    const newCards = cards.map(c => {
      let newHoleColours = [...c.holeColours];
      while (newHoleColours.length < holes) newHoleColours.push({ colourIndex: 2 });
      newHoleColours = newHoleColours.slice(0, holes);
      return { ...c, holes, holeColours: newHoleColours };
    });
    onChange({ ...pattern, cards: newCards });
  }

  const cellSize = Math.max(20, Math.min(40, Math.floor(600 / cardCount)));

  return (
    <div className="th-editor" onMouseUp={stopDrawing} onMouseLeave={stopDrawing}>
      {/* Toolbar */}
      <div className="df-toolbar">
        <span className="toolbar-section">Size:</span>
        <label>
          Cards
          <input
            type="number" min={1} max={64} value={cardCount}
            onChange={e => resize(parseInt(e.target.value, 10) || 1, pickCount)}
          />
        </label>
        <label>
          Picks
          <input
            type="number" min={1} max={200} value={pickCount}
            onChange={e => resize(cardCount, parseInt(e.target.value, 10) || 1)}
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

        <span className="toolbar-section">Fill:</span>
        <button onClick={() => fillAll('F')} title="Set all picks to Forward">All F</button>
        <button onClick={() => fillAll('B')} title="Set all picks to Backward">All B</button>
        <button onClick={() => fillAll('I')} title="Set all picks to Idle">All I</button>

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

      {/* Card setup */}
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
              {cards.map((card, i) => (
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
                          const newCards = cards.map((c, ci) => {
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
                          <option key={ci} value={ci + 1}>{ci + 1} (#{c})</option>
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

      {/* Action grid */}
      <div className="df-grid-wrap">
        {/* Column headers */}
        <div className="df-col-headers" style={{ paddingLeft: 44 }}>
          {cards.map((card, i) => (
            <div
              key={i}
              className="df-col-header"
              style={{ width: cellSize, fontSize: Math.max(8, cellSize - 8) }}
              title={`Card ${card.number} (${card.threading})`}
            >
              {card.number}
            </div>
          ))}
        </div>

        <div className="df-grid-body">
          {picks.map((pick, pickIdx) => (
            <div key={pickIdx} className="df-row">
              <div className="df-row-num" style={{ width: 40, fontSize: 10 }}>
                {pickIdx + 1}
              </div>
              {cards.map(card => {
                const action = getCardTurnAction(pick, card.number);
                const dir = action?.dir ?? null;
                return (
                  <div
                    key={card.number}
                    className="th-cell"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: dir ? DIR_BG[dir] : '#222',
                      color: dir ? DIR_FG[dir] : '#555',
                      fontSize: Math.max(9, cellSize - 10),
                    }}
                    onMouseDown={e => handleCellDown(e, pickIdx, card.number)}
                    onMouseEnter={() => handleCellEnter(pickIdx, card.number)}
                    onContextMenu={e => e.preventDefault()}
                    title={`Pick ${pickIdx + 1}, Card ${card.number}: ${dir ?? 'none'}`}
                  >
                    {dir ?? '·'}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="df-hint th-legend">
        <span style={{ color: DIR_FG.F }}>■</span> F = Forward &nbsp;
        <span style={{ color: DIR_FG.B }}>■</span> B = Backward &nbsp;
        <span style={{ color: DIR_FG.I }}>■</span> I = Idle &nbsp;&nbsp;
        Left-click/drag = cycle F→B→I &nbsp;|&nbsp; Right-click/drag = set Idle
      </div>
    </div>
  );
}
