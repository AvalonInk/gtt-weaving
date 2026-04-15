# GTTR — Guntram's Tabletweaving Thingy Reborn

A modern web-based clone of Guntram's Tabletweaving Thingy (GTT), a pattern design tool for [tablet/card weaving](https://en.wikipedia.org/wiki/Tablet_weaving).

The original GTT was a Windows desktop application written in Delphi, last updated in 2004. This project reimplements it as a browser app with full compatibility with the original `.gtt` file format.

Original author's website here: https://www.guntram.co.za/tabletweaving/gtt.htm
Neither of the download links for the program work anymore and it looks like this was the only drafting program that let you flip tablets on the pattern itself instead of just in the threading chart. So I dug up a .zip from the bowels of archive.org and cracked it open. Ironically, it's easier to start rebuilding the functionality without the part I wanted most.

Any and all testing is appreciated!

## Features (Phase 1)

- **DoubleFace pattern editor** — click or drag to paint foreground/background cells across a card × block grid
- **Card setup** — configure threading direction (S/Z) and hole colours per card
- **Colour palette** — 16-colour palette with colour picker; left-click sets foreground, right-click sets background
- **Weaving preview** — live canvas rendering of what the woven band will look like
- **File compatibility** — open and save `.gtt` files in the original GTT XML format

## Planned (Phase 2 & 3)

- Threaded pattern editor (turn/twist actions per pick)
- BrokenTwill support
- Brocade editor
- LetteredBand patterns and font (`.gtf`) support

## Usage

Visit the live app: **https://avalonink.github.io/gtt-weaving/**

Or run locally:

```bash
npm install
npm run dev
```

## File format

GTT files are XML with a `<TWData>` root element. The format is documented in the original author's specification. This app reads and writes `.gtt` files compatible with GTT v1.16.

## Development

Built with React 18, TypeScript, and Vite.

```bash
npm run dev      # development server
npm run build    # production build
npm run preview  # preview production build locally
```

Deploys automatically to GitHub Pages on push to `main` via the included workflow.
