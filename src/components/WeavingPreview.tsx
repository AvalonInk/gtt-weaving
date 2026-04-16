import { useEffect, useRef } from 'react';
import type { DoubleFacePattern, BrokenTwillPattern } from '../types/gtt';

type DFPattern = DoubleFacePattern | BrokenTwillPattern;

interface Props {
  pattern: DFPattern;
  cellWidth?: number;
  cellHeight?: number;
}

/**
 * Renders a DoubleFace or BrokenTwill pattern as a woven-band preview.
 *
 * Each block (row in Data) represents two picks.
 * '1' = foreground thread on top; '0' = background thread on top.
 * Foreground colour = palette[card.holeColours[0].colourIndex - 1]  (hole A)
 * Background colour = palette[card.holeColours[2].colourIndex - 1]  (hole C, opposite)
 *
 * BrokenTwill: reversed cells (reversals[block][card] === '1') get a subtle
 * diagonal marker drawn over them to indicate the direction reversal.
 */
export function WeavingPreview({ pattern, cellWidth = 12, cellHeight = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isBT = pattern.type === 'BrokenTwill';
  const reversals = isBT ? (pattern as BrokenTwillPattern).reversals : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, length, data, cards, palette } = pattern;
    const colours = palette.colours;

    canvas.width = width * cellWidth;
    canvas.height = length * cellHeight;

    for (let block = 0; block < length; block++) {
      const row = data[block] ?? '';
      for (let cardIdx = 0; cardIdx < width; cardIdx++) {
        const card = cards[cardIdx];
        const bit = row[cardIdx] ?? '0';

        let fgColourHex = '#888888';
        let bgColourHex = '#444444';

        if (card) {
          const fgHole = card.holeColours[0];
          const bgHole = card.holeColours[card.holes > 2 ? 2 : 1] ?? card.holeColours[0];
          const fgIdx = (fgHole?.colourIndex ?? 1) - 1;
          const bgIdx = (bgHole?.colourIndex ?? 2) - 1;
          fgColourHex = `#${colours[fgIdx] ?? '888888'}`;
          bgColourHex = `#${colours[bgIdx] ?? '444444'}`;
        }

        const colour = bit === '1' ? fgColourHex : bgColourHex;
        ctx.fillStyle = colour;
        ctx.fillRect(cardIdx * cellWidth, block * cellHeight, cellWidth, cellHeight);

        // Subtle grid line
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(cardIdx * cellWidth, block * cellHeight, cellWidth, cellHeight);

        // BrokenTwill: diagonal reversal marker
        if (reversals?.[block]?.[cardIdx] === '1') {
          const x = cardIdx * cellWidth;
          const y = block * cellHeight;
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x + 1, y + cellHeight - 1);
          ctx.lineTo(x + cellWidth - 1, y + 1);
          ctx.stroke();
        }
      }
    }
  }, [pattern, cellWidth, cellHeight, reversals]);

  const canvasWidth = pattern.width * cellWidth;
  const canvasHeight = pattern.length * cellHeight;

  return (
    <div className="weaving-preview">
      <div className="preview-title">Weaving Preview{isBT ? ' (BrokenTwill)' : ''}</div>
      <div className="preview-scroll" style={{ maxHeight: 400, overflowY: 'auto', overflowX: 'auto' }}>
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          style={{ display: 'block', imageRendering: 'pixelated' }}
          title="Woven band preview"
        />
      </div>
      <div className="preview-info">
        {pattern.width} cards × {pattern.length} blocks
      </div>
    </div>
  );
}
