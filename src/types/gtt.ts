// GTT File Format Types
// Based on the GTT file format specification by Guntram

export type ThreadingDirection = 'S' | 'Z';
export type TurnDirection = 'F' | 'B' | 'I'; // Forwards / Backwards / Idle
export type TwistDirection = 'V';             // Around vertical axis
export type ActionType = 'Turn' | 'Twist';
export type ActionTarget = 'Card' | 'Pack';
export type PatternType = 'Threaded' | 'DoubleFace' | 'BrokenTwill' | 'Brocade' | 'LetteredBand';
export type ColourCount = 2 | 4;
export type FontThreading = 'AllS' | 'AllZ' | 'AltSZ';

// ---- Shared structures ----

/** One of the 16 palette slots. RGB hex string e.g. "FF0000" */
export type RGBColour = string;

export interface Palette {
  name: string;
  /** Always 16 entries (indices 1–16 in the file, stored 0–15 here) */
  colours: RGBColour[];
}

export interface CardHole {
  /** 1-based index into the palette */
  colourIndex: number;
}

export interface Card {
  /** 1-based card number */
  number: number;
  /** Number of holes: 3–8 */
  holes: number;
  holeColours: CardHole[];
  threading: ThreadingDirection;
  /** Runtime state — irrelevant for editing but preserved on round-trip */
  curThread?: ThreadingDirection;
  curPos?: number;
  curHoleColours?: CardHole[];
}

export interface Pack {
  name: string;
  comment: string;
  /** 1-based card numbers belonging to this pack */
  cardNumbers: number[];
}

// ---- Threaded pattern ----

export interface TurnAction {
  type: 'Turn';
  target: ActionTarget;
  /** Card number (1-based) for Card target; Pack name for Pack target */
  targetId: string;
  dir: TurnDirection;
  dist: 1 | 2;
}

export interface TwistAction {
  type: 'Twist';
  target: ActionTarget;
  targetId: string;
  dir: TwistDirection;
}

export type WeavingAction = TurnAction | TwistAction;

export interface Pick {
  /** 0-based pick index */
  index: number;
  actions: WeavingAction[];
}

export interface ThreadedPattern {
  type: 'Threaded';
  name: string;
  cards: Card[];
  packs?: Pack[];
  palette: Palette;
  picks: Pick[];
}

// ---- DoubleFace pattern ----

/**
 * Data is stored as an array of rows (one per block).
 * Each row is a string of characters, one per card.
 * '1' = foreground colour on top; '0' = background colour on top.
 */
export interface DoubleFacePattern {
  type: 'DoubleFace';
  name: string;
  /** Number of cards */
  width: number;
  /** Number of blocks (2 picks per block) */
  length: number;
  colourCount: ColourCount;
  cards: Card[];
  palette: Palette;
  /** One string per block, length === width. Each char: '0' or '1' */
  data: string[];
}

// ---- BrokenTwill pattern ----

export interface BrokenTwillPattern extends Omit<DoubleFacePattern, 'type'> {
  type: 'BrokenTwill';
  /**
   * One string per block, length === width.
   * 'X' = turning direction reversed between the two picks (creates long float).
   * ' ' or '.' = normal.
   */
  reversals: string[];
}

// ---- Brocade pattern ----

export interface BrocadePick {
  /** 1-based pick index */
  index: number;
  /** 1-based tablet numbers for tie-down points */
  tieDowns: number[];
}

export interface BrocadePattern {
  type: 'Brocade';
  name: string;
  /** Number of cards */
  width: number;
  picks: BrocadePick[];
  /** Bitmap-style visual representation (one string per row) */
  visualPattern: string[];
}

// ---- LetteredBand pattern ----

export interface FontCharacter {
  /** Character identifier matching the Letter attribute */
  letter: string;
  name: string;
  spaceBefore: number;
  spaceAfter: number;
  /** The character's appearance as a DoubleFace pattern */
  pattern: DoubleFacePattern;
}

export interface GTTFont {
  name: string;
  notes: string;
  /** Number of cards high */
  height: number;
  defCharWidth: number;
  /** Background blocks between characters */
  kerning: number;
  threading: FontThreading;
  characters: FontCharacter[];
}

export interface LetteredBandPattern {
  type: 'LetteredBand';
  /** Characters to appear on the band */
  text: string[];
  font: GTTFont;
}

// ---- Top-level file ----

export type AnyPattern =
  | ThreadedPattern
  | DoubleFacePattern
  | BrokenTwillPattern
  | BrocadePattern
  | LetteredBandPattern;

export interface GTTFile {
  version: string;
  pattern: AnyPattern;
}

export interface GTFFontFile {
  version: string;
  font: GTTFont;
}

// ---- Helpers ----

export function defaultPalette(): Palette {
  return {
    name: 'Default',
    colours: [
      'FFFFFF', '000000', 'FF0000', '00FF00',
      '0000FF', 'FFFF00', 'FF00FF', '00FFFF',
      '808080', 'C0C0C0', '800000', '008000',
      '000080', '808000', '800080', '008080',
    ],
  };
}

export function newDoubleFacePattern(width = 12, length = 20): DoubleFacePattern {
  const palette = defaultPalette();
  const cards: Card[] = Array.from({ length: width }, (_, i) => ({
    number: i + 1,
    holes: 4,
    holeColours: [
      { colourIndex: 1 }, // white
      { colourIndex: 1 },
      { colourIndex: 2 }, // black
      { colourIndex: 2 },
    ],
    threading: (i % 2 === 0 ? 'S' : 'Z') as ThreadingDirection,
  }));
  const data = Array.from({ length }, () => '0'.repeat(width));
  return {
    type: 'DoubleFace',
    name: 'New Pattern',
    width,
    length,
    colourCount: 2,
    cards,
    palette,
    data,
  };
}
