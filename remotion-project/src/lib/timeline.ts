import type {PcbVideoData} from './types';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const s = (seconds: number) => Math.round(seconds * FPS);

export interface Stage {
  id: 'intro' | 'schematic' | 'layout' | 'paste' | 'place' | 'clean' | 'power' | 'end';
  start: number;
  end: number;
  chapter?: {num: string; zh: string; en: string};
}

export interface PlaceSlot {
  ref: string;
  index: number;
  start: number;
  /** Tweezers reach the pad and let go. */
  placed: number;
  /** Hot air starts. */
  heat: number;
  /** Paste fully reflowed. */
  reflowed: number;
  end: number;
}

export interface Subtitle {
  start: number;
  end: number;
  zh: string;
  en: string;
}

export interface Timeline {
  stages: Record<Stage['id'], Stage>;
  slots: PlaceSlot[];
  subtitles: Subtitle[];
  duration: number;
}

const SLOT_SECONDS = 1.8;

export const buildTimeline = (data: PcbVideoData): Timeline => {
  const introEnd = s(3.2);
  const schematicEnd = s(6.8);
  const layoutEnd = s(10.0);
  const pasteEnd = s(12.0);
  const placeEnd = pasteEnd + s(SLOT_SECONDS * data.placeOrder.length);
  const cleanEnd = placeEnd + s(2.6);
  const powerEnd = cleanEnd + s(4.6);
  const endEnd = powerEnd + s(3.6);

  const stages: Record<Stage['id'], Stage> = {
    intro: {id: 'intro', start: 0, end: introEnd},
    schematic: {id: 'schematic', start: introEnd, end: schematicEnd, chapter: {num: '01', zh: '原理图', en: 'SCHEMATIC'}},
    layout: {id: 'layout', start: schematicEnd, end: layoutEnd, chapter: {num: '02', zh: '布板', en: 'LAYOUT'}},
    paste: {id: 'paste', start: layoutEnd, end: pasteEnd, chapter: {num: '03', zh: '锡膏', en: 'SOLDER PASTE'}},
    place: {id: 'place', start: pasteEnd, end: placeEnd, chapter: {num: '04', zh: '贴装 · 热风', en: 'PLACE & REFLOW'}},
    clean: {id: 'clean', start: placeEnd, end: cleanEnd, chapter: {num: '05', zh: '洗板', en: 'CLEAN'}},
    power: {id: 'power', start: cleanEnd, end: powerEnd, chapter: {num: '06', zh: '上电', en: 'POWER ON'}},
    end: {id: 'end', start: powerEnd, end: endEnd},
  };

  const slots: PlaceSlot[] = data.placeOrder.map((ref, index) => {
    const start = pasteEnd + s(SLOT_SECONDS * index);
    return {
      ref,
      index,
      start,
      placed: start + s(0.62),
      heat: start + s(0.85),
      reflowed: start + s(1.55),
      end: start + s(SLOT_SECONDS),
    };
  });

  const subtitles: Subtitle[] = [
    {start: s(3.4), end: schematicEnd, zh: '只给它**一张原理图**', en: 'One schematic. That\'s all it gets.'},
    {start: schematicEnd + s(0.2), end: layoutEnd, zh: '焊盘，**原样放到板上**', en: 'The pads, set out on the board.'},
    {start: layoutEnd + s(0.1), end: pasteEnd, zh: '每个焊盘，**一点锡膏**', en: 'A dab of paste on every pad.'},
    {start: pasteEnd + s(0.1), end: pasteEnd + s(SLOT_SECONDS * 2), zh: '**每一个器件**，都按真实顺序贴上去', en: 'Every part, placed in the real order.'},
    {start: pasteEnd + s(SLOT_SECONDS * 2) + s(0.1), end: placeEnd, zh: '热风一吹，锡**化开、收拢、拉正**', en: 'Hot air: the paste melts, pulls in, and squares it up.'},
    {start: placeEnd + s(0.1), end: cleanEnd, zh: '刷子蘸洗板水，**刷干净**', en: 'A brush of flux cleaner, wiped clean.'},
    {start: cleanEnd + s(0.2), end: cleanEnd + s(2.2), zh: '接上 **3.7 V 锂电**', en: 'Hook up a 3.7 V cell.'},
    {start: cleanEnd + s(2.3), end: powerEnd, zh: '输出 **3.30 V**，稳住了', en: 'Output 3.30 V. Steady.'},
  ];

  return {stages, slots, subtitles, duration: endEnd};
};

export const stageAt = (tl: Timeline, frame: number): Stage => {
  const list = Object.values(tl.stages);
  for (const st of list) {
    if (frame >= st.start && frame < st.end) return st;
  }
  return list[list.length - 1];
};
