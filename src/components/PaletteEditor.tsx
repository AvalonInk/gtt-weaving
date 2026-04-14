import { useRef } from 'react';
import type { Palette } from '../types/gtt';

interface Props {
  palette: Palette;
  /** Which palette indices are the active foreground/background (0-based) */
  fgIndex: number;
  bgIndex: number;
  onChange: (palette: Palette) => void;
  onFgChange: (index: number) => void;
  onBgChange: (index: number) => void;
}

export function PaletteEditor({ palette, fgIndex, bgIndex, onChange, onFgChange, onBgChange }: Props) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function handleColourChange(index: number, value: string) {
    const newColours = [...palette.colours];
    newColours[index] = value.replace('#', '').toUpperCase();
    onChange({ ...palette, colours: newColours });
  }

  function handleSwatchClick(e: React.MouseEvent, index: number) {
    if (e.button === 2 || e.altKey) {
      onBgChange(index);
    } else {
      onFgChange(index);
    }
  }

  function handleSwatchDoubleClick(index: number) {
    inputRefs.current[index]?.click();
  }

  return (
    <div className="palette-editor">
      <div className="palette-title">Palette: {palette.name || 'Unnamed'}</div>
      <div className="palette-grid">
        {palette.colours.slice(0, 16).map((colour, i) => {
          const isFg = i === fgIndex;
          const isBg = i === bgIndex;
          const hex = colour.length === 6 ? `#${colour}` : '#000000';
          return (
            <div
              key={i}
              className={`palette-swatch ${isFg ? 'swatch-fg' : ''} ${isBg ? 'swatch-bg' : ''}`}
              style={{ backgroundColor: hex }}
              title={`${hex}${isFg ? ' (foreground)' : ''}${isBg ? ' (background)' : ''}\nLeft-click: set foreground\nRight-click: set background\nDouble-click: edit colour`}
              onClick={e => handleSwatchClick(e, i)}
              onContextMenu={e => { e.preventDefault(); onBgChange(i); }}
              onDoubleClick={() => handleSwatchDoubleClick(i)}
            >
              {isFg && <span className="swatch-label">F</span>}
              {isBg && !isFg && <span className="swatch-label">B</span>}
              <input
                ref={el => { inputRefs.current[i] = el; }}
                type="color"
                value={hex}
                onChange={e => handleColourChange(i, e.target.value)}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
                tabIndex={-1}
              />
            </div>
          );
        })}
      </div>
      <div className="palette-legend">
        <span className="legend-fg">■</span> Left-click = foreground &nbsp;
        <span className="legend-bg">■</span> Right-click = background &nbsp;
        Double-click = edit colour
      </div>
      <div className="palette-name-row">
        <label>
          Name:
          <input
            type="text"
            value={palette.name}
            onChange={e => onChange({ ...palette, name: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
