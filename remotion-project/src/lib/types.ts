export type PartKind = 'cap0603' | 'sot23-5' | 'header2';

export interface PartData {
  ref: string;
  value: string;
  footprint: string;
  kind: PartKind;
  /** Board coordinates in mm, origin at board centre, +y towards the top edge. */
  x: number;
  y: number;
  /** Rotation in degrees, counter-clockwise seen from above. */
  rot: number;
  note?: string;
}

export interface EndCardRow {
  label: string;
  en: string;
  value: string;
  unit: string;
  accent?: boolean;
}

export interface PcbVideoData {
  id: string;
  title: string;
  prompt: string;
  schematic: string;
  board: { w: number; h: number; t: number; copperOz: number; layers: number };
  parts: PartData[];
  placeOrder: string[];
  testPoints: { name: string; x: number; y: number }[];
  test: { vin: number; vout: number; iout: string; source: string };
  endCard: { title: string; rows: EndCardRow[] };
}
