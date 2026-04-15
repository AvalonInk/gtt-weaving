// GTT XML Parser
// Parses .gtt and .gtf file content into TypeScript data structures

import type {
  GTTFile, GTFFontFile, AnyPattern,
  DoubleFacePattern, BrokenTwillPattern, BrocadePattern,
  ThreadedPattern, LetteredBandPattern,
  Card, CardHole, Pack, Palette, Pick, WeavingAction,
  GTTFont, FontCharacter,
  ThreadingDirection, FontThreading, ColourCount,
} from '../types/gtt';

// ---- DOM-based XML helpers ----

function getChild(el: Element, tag: string): Element | null {
  return el.querySelector(`:scope > ${tag}`);
}

function getChildText(el: Element, tag: string): string {
  return getChild(el, tag)?.textContent?.trim() ?? '';
}

function attr(el: Element, name: string): string {
  return el.getAttribute(name) ?? '';
}

// ---- Colour format conversion ----
// Original GTT stores palette colours as decimal Windows COLORREF integers: R + G*256 + B*65536
// Our internal format is a 6-character uppercase hex RGB string e.g. "FF0000"

function colorRefToHex(value: string): string {
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    // Decimal COLORREF integer
    const n = parseInt(trimmed, 10);
    const r = n & 0xFF;
    const g = (n >> 8) & 0xFF;
    const b = (n >> 16) & 0xFF;
    return [r, g, b].map(c => c.toString(16).padStart(2, '0').toUpperCase()).join('');
  }
  // Already a hex RGB string
  return trimmed.toUpperCase().padStart(6, '0');
}

// ---- Card parsing ----
// Original GTT uses 0-based hole colour indices; our model uses 1-based.

function parseHoleColour(el: Element): CardHole {
  const raw = parseInt(el.textContent?.trim() ?? '0', 10);
  // If the value looks like a 1-based index (>= 1 and <= 16) it may already be 1-based
  // (files saved by our own app). If 0-based (0–15), add 1.
  // We detect by checking whether it is in 0–15 range — both formats overlap at 1–15,
  // so we use the presence of index 0 as the definitive signal.
  // Safer: always store as-is and normalise on first use. Instead we check the file header
  // version: GTT files use 0-based, ours use 1-based. But that's fragile.
  // Simplest safe rule: 0 → must be 0-based (palette index 0 is valid in GTT, invalid in ours).
  // Values 1–15 are ambiguous, but in practice GTT files always start at 0 for hole A.
  // We therefore add 1 unconditionally when the max value in a card is ≤ 15,
  // which is handled at the card level below.
  return { colourIndex: raw };
}

function parseCard(cardEl: Element): Card {
  const number = parseInt(attr(cardEl, 'Number'), 10);
  const holes = parseInt(attr(cardEl, 'Holes'), 10);

  const holesEl = getChild(cardEl, 'Holes');
  const rawHoleColours: CardHole[] = holesEl
    ? Array.from(holesEl.querySelectorAll(':scope > Colour')).map(parseHoleColour)
    : [];

  // Normalise to 1-based: if any index is 0 the file is using 0-based indexing.
  const isZeroBased = rawHoleColours.some(h => h.colourIndex === 0);
  const holeColours = isZeroBased
    ? rawHoleColours.map(h => ({ colourIndex: h.colourIndex + 1 }))
    : rawHoleColours;

  const threading = (getChildText(cardEl, 'Threading') || 'S') as ThreadingDirection;

  const curThread = getChildText(cardEl, 'CurThread') as ThreadingDirection | '';
  const curPosStr = getChildText(cardEl, 'CurPos');
  const curHolesEl = getChild(cardEl, 'CurHoles');
  const rawCurHoles: CardHole[] | undefined = curHolesEl
    ? Array.from(curHolesEl.querySelectorAll(':scope > Colour')).map(parseHoleColour)
    : undefined;
  const curHoleColours = rawCurHoles
    ? (isZeroBased ? rawCurHoles.map(h => ({ colourIndex: h.colourIndex + 1 })) : rawCurHoles)
    : undefined;

  return {
    number,
    holes,
    holeColours,
    threading,
    ...(curThread ? { curThread } : {}),
    ...(curPosStr ? { curPos: parseInt(curPosStr, 10) } : {}),
    ...(curHoleColours ? { curHoleColours } : {}),
  };
}

function parseCards(cardsEl: Element): Card[] {
  return Array.from(cardsEl.querySelectorAll(':scope > Card')).map(parseCard);
}

// ---- Palette parsing ----

function parsePalette(paletteEl: Element): Palette {
  const name = attr(paletteEl, 'Name');
  const colours: string[] = Array.from(
    paletteEl.querySelectorAll(':scope > Colour')
  ).map(c => colorRefToHex(c.textContent ?? '0'));
  while (colours.length < 16) colours.push('000000');
  return { name, colours };
}

// ---- Pack parsing ----

function parsePacks(packsEl: Element): Pack[] {
  return Array.from(packsEl.querySelectorAll(':scope > Pack')).map(packEl => ({
    name: attr(packEl, 'Name'),
    comment: getChildText(packEl, 'Comment'),
    cardNumbers: (getChildText(packEl, 'Cards') || '')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n)),
  }));
}

// ---- Threaded pattern ----

function parsePicks(picksEl: Element): Pick[] {
  return Array.from(picksEl.querySelectorAll(':scope > Pick')).map(pickEl => {
    const index = parseInt(attr(pickEl, 'Index'), 10);
    const actionsEl = getChild(pickEl, 'Actions');
    const actions: WeavingAction[] = actionsEl
      ? Array.from(actionsEl.querySelectorAll(':scope > Action')).map(a => {
          const type = attr(a, 'ActionType') as 'Turn' | 'Twist';
          const target = attr(a, 'Target') as 'Card' | 'Pack';
          const targetId = attr(a, 'TargetID');
          if (type === 'Turn') {
            return {
              type: 'Turn',
              target,
              targetId,
              dir: attr(a, 'Dir') as 'F' | 'B' | 'I',
              dist: parseInt(attr(a, 'Dist') || '1', 10) as 1 | 2,
            };
          } else {
            return { type: 'Twist', target, targetId, dir: 'V' as const };
          }
        })
      : [];
    return { index, actions };
  });
}

function parseThreaded(patternEl: Element): ThreadedPattern {
  const cardsEl = getChild(patternEl, 'Cards');
  const packsEl = getChild(patternEl, 'Packs');
  const paletteEl = getChild(patternEl, 'Palette');
  const picksEl = getChild(patternEl, 'Picks');

  return {
    type: 'Threaded',
    name: getChildText(patternEl, 'Name'),
    cards: cardsEl ? parseCards(cardsEl) : [],
    packs: packsEl ? parsePacks(packsEl) : undefined,
    palette: paletteEl ? parsePalette(paletteEl) : { name: '', colours: [] },
    picks: picksEl ? parsePicks(picksEl) : [],
  };
}

// ---- DoubleFace data parsing ----
// Original GTT stores data as <P1>...</P1> ... <P_N>...</P_N> child elements,
// using '.' for background and 'X' for foreground.
// Our format uses plain text lines with '0' and '1'.
// We detect which format is in use and normalise to '0'/'1' lines indexed 0 = block 1.

function parseDataBlock(dataEl: Element, width: number): string[] {
  // Detect P_N element format
  const pElements = Array.from(dataEl.children).filter(el => /^P\d+$/i.test(el.tagName));
  if (pElements.length > 0) {
    // Sort ascending by N so data[0] = P1 = first block
    pElements.sort((a, b) => {
      const na = parseInt(a.tagName.slice(1), 10);
      const nb = parseInt(b.tagName.slice(1), 10);
      return na - nb;
    });
    return pElements.map(el =>
      (el.textContent ?? '')
        .replace(/X/g, '1')
        .replace(/\./g, '0')
        .padEnd(width, '0')
    );
  }
  // Plain text lines (our own format)
  return (dataEl.textContent ?? '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
}

// ---- DoubleFace pattern ----

function parseDoubleFace(patternEl: Element): DoubleFacePattern {
  const cardsEl = getChild(patternEl, 'Cards');
  const paletteEl = getChild(patternEl, 'Palette');
  const dataEl = getChild(patternEl, 'Data');
  const width = parseInt(getChildText(patternEl, 'Width'), 10);
  const length = parseInt(getChildText(patternEl, 'Length'), 10);
  const colourCount = parseInt(getChildText(patternEl, 'ColourCount'), 10) as ColourCount;

  return {
    type: 'DoubleFace',
    name: getChildText(patternEl, 'Name'),
    width,
    length,
    colourCount,
    cards: cardsEl ? parseCards(cardsEl) : [],
    palette: paletteEl ? parsePalette(paletteEl) : { name: '', colours: [] },
    data: dataEl ? parseDataBlock(dataEl, width) : Array(length).fill('0'.repeat(width)),
  };
}

// ---- BrokenTwill pattern ----

function parseBrokenTwill(patternEl: Element): BrokenTwillPattern {
  const base = parseDoubleFace(patternEl);
  const reversalsEl = getChild(patternEl, 'Reversals');
  const reversals = reversalsEl
    ? parseDataBlock(reversalsEl, base.width)
    : Array(base.length).fill(' '.repeat(base.width));
  return { ...base, type: 'BrokenTwill', reversals };
}

// ---- Brocade pattern ----

function parseBrocade(patternEl: Element): BrocadePattern {
  const width = parseInt(getChildText(patternEl, 'Width'), 10);
  const picksEl = getChild(patternEl, 'Picks');
  const visualEl = getChild(patternEl, 'VisualPattern');

  const picks = picksEl
    ? Array.from(picksEl.querySelectorAll(':scope > Pick')).map(p => ({
        index: parseInt(attr(p, 'Index'), 10),
        tieDowns: (getChildText(p, 'TieDowns') || '')
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n)),
      }))
    : [];

  const visualPattern = visualEl
    ? (visualEl.textContent ?? '').split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
    : [];

  return {
    type: 'Brocade',
    name: getChildText(patternEl, 'Name'),
    width,
    picks,
    visualPattern,
  };
}

// ---- Font parsing ----

function parseFont(fontEl: Element): GTTFont {
  const dataEl = getChild(fontEl, 'Data');
  const characters: FontCharacter[] = dataEl
    ? Array.from(dataEl.querySelectorAll(':scope > Character')).map(charEl => {
        const innerPatternEl = getChild(charEl, 'Pattern');
        return {
          letter: attr(charEl, 'Letter'),
          name: getChildText(charEl, 'Name'),
          spaceBefore: parseInt(getChildText(charEl, 'SpaceBefore'), 10) || 0,
          spaceAfter: parseInt(getChildText(charEl, 'SpaceAfter'), 10) || 0,
          pattern: innerPatternEl ? parseDoubleFace(innerPatternEl) : {
            type: 'DoubleFace', name: '', width: 0, length: 0,
            colourCount: 2, cards: [], palette: { name: '', colours: [] }, data: [],
          },
        };
      })
    : [];

  return {
    name: getChildText(fontEl, 'Name'),
    notes: getChildText(fontEl, 'Notes'),
    height: parseInt(getChildText(fontEl, 'Height'), 10) || 0,
    defCharWidth: parseInt(getChildText(fontEl, 'DefCharWidth'), 10) || 0,
    kerning: parseInt(getChildText(fontEl, 'Kerning'), 10) || 0,
    threading: (getChildText(fontEl, 'Threading') || 'AllS') as FontThreading,
    characters,
  };
}

// ---- LetteredBand ----

function parseLetteredBand(patternEl: Element): LetteredBandPattern {
  const textEl = getChild(patternEl, 'Text');
  const text = textEl
    ? Array.from(textEl.querySelectorAll(':scope > Char')).map(c => c.textContent?.trim() ?? '')
    : [];

  const fontWrapperEl = getChild(patternEl, 'Font');
  const innerFontEl = fontWrapperEl ? getChild(fontWrapperEl, 'Font') : null;
  const font: GTTFont = innerFontEl
    ? parseFont(innerFontEl)
    : { name: '', notes: '', height: 0, defCharWidth: 0, kerning: 0, threading: 'AllS', characters: [] };

  return { type: 'LetteredBand', text, font };
}

// ---- Top-level entry points ----

function normalisePatternType(raw: string): AnyPattern['type'] {
  switch (raw.toLowerCase()) {
    case 'doubleface':   return 'DoubleFace';
    case 'brokentwill':  return 'BrokenTwill';
    case 'letteredband': return 'LetteredBand';
    default:             return raw as AnyPattern['type'];
  }
}

function parsePatternElement(patternEl: Element): AnyPattern {
  const type = normalisePatternType(attr(patternEl, 'Type'));
  switch (type) {
    case 'Threaded':     return parseThreaded(patternEl);
    case 'DoubleFace':   return parseDoubleFace(patternEl);
    case 'BrokenTwill':  return parseBrokenTwill(patternEl);
    case 'Brocade':      return parseBrocade(patternEl);
    case 'LetteredBand': return parseLetteredBand(patternEl);
    default:
      throw new Error(`Unknown pattern type: ${type}`);
  }
}

export function parseGTTFile(xmlText: string): GTTFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error(`XML parse error: ${parseError.textContent}`);

  const twData = doc.documentElement;
  const version = getChildText(twData, 'Version');
  const patternEl = getChild(twData, 'Pattern');
  if (!patternEl) throw new Error('No <Pattern> element found');

  return { version, pattern: parsePatternElement(patternEl) };
}

export function parseGTFFile(xmlText: string): GTFFontFile {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error(`XML parse error: ${parseError.textContent}`);

  const twData = doc.documentElement;
  const version = getChildText(twData, 'Version');
  const fontEl = getChild(twData, 'Font');
  if (!fontEl) throw new Error('No <Font> element found');

  return { version, font: parseFont(fontEl) };
}
