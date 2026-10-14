import type {PartKind} from '../../lib/types';

export interface PadDef {
  x: number;
  y: number;
  w?: number;
  h?: number;
  /** Round pad (through-hole) radius. */
  r?: number;
}

export interface FootprintDef {
  pads: PadDef[];
  body: {w: number; d: number; h: number};
  courtyard: {w: number; d: number};
  /** Approximate solder paste mass in grams for the whole footprint. */
  pasteGrams: number;
}

export const FOOTPRINTS: Record<PartKind, FootprintDef> = {
  cap0603: {
    pads: [
      {x: -0.8, y: 0, w: 0.9, h: 1.0},
      {x: 0.8, y: 0, w: 0.9, h: 1.0},
    ],
    body: {w: 1.6, d: 0.8, h: 0.8},
    courtyard: {w: 2.8, d: 1.6},
    pasteGrams: 0.003,
  },
  'sot23-5': {
    pads: [
      {x: -0.95, y: -1.3, w: 0.6, h: 1.1},
      {x: 0, y: -1.3, w: 0.6, h: 1.1},
      {x: 0.95, y: -1.3, w: 0.6, h: 1.1},
      {x: -0.95, y: 1.3, w: 0.6, h: 1.1},
      {x: 0.95, y: 1.3, w: 0.6, h: 1.1},
    ],
    body: {w: 2.9, d: 1.6, h: 1.1},
    courtyard: {w: 3.6, d: 3.4},
    pasteGrams: 0.006,
  },
  header2: {
    pads: [
      {x: -1.27, y: 0, r: 0.85},
      {x: 1.27, y: 0, r: 0.85},
    ],
    body: {w: 5.08, d: 2.54, h: 2.5},
    courtyard: {w: 5.6, d: 3.1},
    pasteGrams: 0.008,
  },
};

/** Rotate a local footprint offset by `rotDeg` (counter-clockwise from above). */
export const rotate2 = (x: number, y: number, rotDeg: number): [number, number] => {
  const a = (rotDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return [x * c - y * sn, x * sn + y * c];
};
