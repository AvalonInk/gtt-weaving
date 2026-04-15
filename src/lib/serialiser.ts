// GTT XML Serialiser
// Converts TypeScript data structures back to .gtt / .gtf XML
// Output format matches original GTT v1.17 files exactly.

import type {
  GTTFile, GTFFontFile, AnyPattern,
  DoubleFacePattern, BrokenTwillPattern, BrocadePattern,
  ThreadedPattern, LetteredBandPattern,
  Card, Pack, Palette, Pick,
  GTTFont, FontCharacter,
} from '../types/gtt';

const SOURCE = "Guntram's Tabletweaving Thingy";

// ---- Low-level XML helpers ----

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function tag(name: string, content: string, attrs: Record<string, string | number> = {}): string {
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${esc(String(v))}"`)
    .join('');
  if (content === '') return `<${name}${attrStr}/>`;
  return `<${name}${attrStr}>${content}</${name}>`;
}

function simple(name: string, value: string | number): string {
  return `<${name}>${esc(String(value))}</${name}>`;
}

// ---- Colour format conversion ----
// Internal: 6-char uppercase hex RGB string e.g. "FF0000"
// GTT file: decimal Windows COLORREF integer e.g. 255  (= R + G*256 + B*65536)

function hexToColorRef(hex: string): number {
  const r = parseInt(hex.slice(0, 2), 16) || 0;
  const g = parseInt(hex.slice(2, 4), 16) || 0;
  const b = parseInt(hex.slice(4, 6), 16) || 0;
  return r + g * 256 + b * 65536;
}

// ---- Shared structures ----

function serialisePalette(p: Palette): string {
  const colours = p.colours
    .slice(0, 16)
    .map((c, i) => `  ${tag('Colour', String(hexToColorRef(c)), { Index: i + 1 })}`)
    .join('\n');
  return tag('Palette', `\n${colours}\n`, { Name: p.name, Size: p.colours.length });
}

function serialiseCard(card: Card): string {
  // Convert 1-based internal indices back to 0-based for GTT
  const holes = card.holeColours
    .map(h => `    ${simple('Colour', h.colourIndex - 1)}`)
    .join('\n');
  const holesTag = tag('Holes', `\n${holes}\n`, { Count: card.holes });
  let inner = `\n  ${holesTag}\n  ${simple('Threading', card.threading)}\n`;

  if (card.curThread !== undefined) {
    inner += `  ${simple('CurThread', card.curThread)}\n`;
  }
  if (card.curPos !== undefined) {
    inner += `  ${simple('CurPos', card.curPos)}\n`;
  }
  if (card.curHoleColours) {
    const curHoles = card.curHoleColours
      .map(h => `    ${simple('Colour', h.colourIndex - 1)}`)
      .join('\n');
    inner += `  ${tag('CurHoles', `\n${curHoles}\n`, { Count: card.holes })}\n`;
  }

  return tag('Card', inner, { Holes: card.holes, Number: card.number });
}

function serialiseCards(cards: Card[]): string {
  const inner = cards.map(c => `\n${serialiseCard(c)}`).join('') + '\n';
  return tag('Cards', inner, { Count: cards.length });
}

function serialisePacks(packs: Pack[]): string {
  const inner = packs.map(p => {
    const packInner = [
      simple('Comment', p.comment),
      simple('Size', p.cardNumbers.length),
      simple('Cards', p.cardNumbers.join(', ')),
    ].join('\n');
    return tag('Pack', `\n${packInner}\n`, { Name: p.name });
  }).join('\n');
  return tag('Packs', `\n${inner}\n`, { Count: packs.length });
}

// ---- Data block serialisation ----
// GTT format: <P_N> child elements, '.' = background ('0'), 'X' = foreground ('1'),
// stored in reverse order: P_Length first, P1 last.

function serialiseDataBlock(data: string[]): string {
  const rows = data
    .map((row, i) => {
      const n = i + 1;
      const converted = row.replace(/1/g, 'X').replace(/0/g, '.');
      return `  <P${n}>${converted}</P${n}>`;
    })
    .reverse(); // P_Length first → P1 last
  return '\n' + rows.join('\n') + '\n';
}

// ---- Threaded pattern ----

function serialisePick(pick: Pick): string {
  const actions = pick.actions.map(a => {
    const attrs: Record<string, string | number> = {
      ActionType: a.type,
      Target: a.target,
      TargetID: a.targetId,
      Dir: a.dir,
    };
    if (a.type === 'Turn') attrs['Dist'] = a.dist;
    return tag('Action', '', attrs);
  }).join('\n');
  const actionsTag = tag('Actions', `\n${actions}\n`, { Count: pick.actions.length });
  return tag('Pick', `\n${actionsTag}\n`, { Index: pick.index });
}

function serialiseThreaded(p: ThreadedPattern): string {
  const parts = [
    simple('Name', p.name),
    serialiseCards(p.cards),
    ...(p.packs ? [serialisePacks(p.packs)] : []),
    serialisePalette(p.palette),
    tag('Picks', p.picks.map(serialisePick).join('\n'), { Count: p.picks.length }),
  ];
  return tag('Pattern', `\n${parts.join('\n')}\n`, { Type: 'Threaded' });
}

// ---- DoubleFace pattern ----

function serialiseDoubleFace(p: DoubleFacePattern, typeOverride?: string): string {
  const parts = [
    simple('Name', p.name),
    simple('Width', p.width),
    simple('Length', p.length),
    simple('ColourCount', p.colourCount),
    serialiseCards(p.cards),
    serialisePalette(p.palette),
    tag('Data', serialiseDataBlock(p.data)),
  ];
  // Use 'Doubleface' (original GTT casing) unless overridden
  return tag('Pattern', `\n${parts.join('\n')}\n`, { Type: typeOverride ?? 'Doubleface' });
}

// ---- BrokenTwill pattern ----

function serialiseBrokenTwill(p: BrokenTwillPattern): string {
  const parts = [
    simple('Name', p.name),
    simple('Width', p.width),
    simple('Length', p.length),
    simple('ColourCount', p.colourCount),
    serialiseCards(p.cards),
    serialisePalette(p.palette),
    tag('Data', serialiseDataBlock(p.data)),
    tag('Reversals', serialiseDataBlock(p.reversals)),
  ];
  return tag('Pattern', `\n${parts.join('\n')}\n`, { Type: 'BrokenTwill' });
}

// ---- Brocade pattern ----

function serialiseBrocade(p: BrocadePattern): string {
  const picks = p.picks.map(pk =>
    tag('Pick', simple('TieDowns', pk.tieDowns.join(', ')), { Index: pk.index })
  ).join('\n');
  const visual = '\n' + p.visualPattern.join('\n') + '\n';
  const parts = [
    simple('Name', p.name),
    simple('Width', p.width),
    tag('Picks', `\n${picks}\n`, { Count: p.picks.length }),
    tag('Wefts', ''),
    tag('VisualPattern', visual),
  ];
  return tag('Pattern', `\n${parts.join('\n')}\n`, { Type: 'Brocade' });
}

// ---- Font ----

function serialiseFontCharacter(c: FontCharacter): string {
  const inner = [
    simple('Name', c.name),
    simple('SpaceBefore', c.spaceBefore),
    simple('SpaceAfter', c.spaceAfter),
    serialiseDoubleFace(c.pattern),
  ].join('\n');
  return tag('Character', `\n${inner}\n`, { Letter: c.letter });
}

function serialiseFont(f: GTTFont): string {
  const chars = f.characters.map(serialiseFontCharacter).join('\n');
  const parts = [
    simple('Name', f.name),
    simple('Notes', f.notes),
    simple('Height', f.height),
    simple('DefCharWidth', f.defCharWidth),
    simple('Kerning', f.kerning),
    simple('Threading', f.threading),
    tag('Data', `\n${chars}\n`),
  ];
  return tag('Font', `\n${parts.join('\n')}\n`);
}

// ---- LetteredBand ----

function serialiseLetteredBand(p: LetteredBandPattern): string {
  const chars = p.text.map(c => simple('Char', c)).join('\n');
  const fontInner = serialiseFont(p.font);
  const fontTag = tag('Font', `\n${fontInner}\n`, {
    Name: p.font.name,
    Encapsulated: 'Yes',
  });
  return tag('Pattern', `\n${tag('Text', `\n${chars}\n`)}\n${fontTag}\n`, { Type: 'LetteredBand' });
}

// ---- Pattern dispatcher ----

function serialisePattern(pattern: AnyPattern): string {
  switch (pattern.type) {
    case 'Threaded':     return serialiseThreaded(pattern);
    case 'DoubleFace':   return serialiseDoubleFace(pattern);
    case 'BrokenTwill':  return serialiseBrokenTwill(pattern);
    case 'Brocade':      return serialiseBrocade(pattern);
    case 'LetteredBand': return serialiseLetteredBand(pattern);
  }
}

// ---- Public entry points ----

export function serialiseGTTFile(file: GTTFile): string {
  const inner = [
    simple('Source', SOURCE),
    simple('Version', file.version),
    serialisePattern(file.pattern),
  ].join('\n');
  return `<TWData>\n${inner}\n</TWData>`;
}

export function serialiseGTFFile(file: GTFFontFile): string {
  const inner = [
    simple('Source', SOURCE),
    simple('Version', file.version),
    serialiseFont(file.font),
  ].join('\n');
  return `<TWData>\n${inner}\n</TWData>`;
}
