import {AbsoluteFill, Img, staticFile, useCurrentFrame} from 'remotion';
import {T, shadow} from './theme';
import {easeOut, fadeInOut, seg, lerp, easeInOut} from '../lib/anim';
import {s} from '../lib/timeline';
import type {EndCardRow} from '../lib/types';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 48%, rgba(0,0,0,0.42) 100%)',
    }}
  />
);

/** Claude-Code-style terminal box typing out the prompt. */
export const Terminal: React.FC<{prompt: string; start: number; end: number}> = ({prompt, start, end}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.35));
  if (op <= 0) return null;
  const typed = Math.floor(seg(frame, start + s(0.5), end - s(0.9)) * prompt.length);
  const cursorOn = Math.floor(frame / 8) % 2 === 0;
  return (
    <div style={{position: 'absolute', left: 120, top: 330, opacity: op, fontFamily: T.mono}}>
      <div style={{color: T.text, fontSize: 24, marginBottom: 18, textShadow: shadow, letterSpacing: 1}}>
        <span style={{color: T.orange, marginRight: 12}}>✱</span>Claude Code
      </div>
      <div
        style={{
          background: 'rgba(18,20,24,0.88)',
          border: '1px solid rgba(243,241,236,0.16)',
          borderRadius: 12,
          padding: '22px 34px',
          fontFamily: T.zh,
          fontSize: 44,
          color: T.text,
          minWidth: 760,
          boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        }}
      >
        <span style={{color: T.orange, fontFamily: T.mono, marginRight: 18}}>&gt;</span>
        {prompt.slice(0, typed)}
        <span style={{display: 'inline-block', width: 20, height: 46, verticalAlign: -8, marginLeft: 4, background: cursorOn ? T.text : 'transparent'}} />
      </div>
    </div>
  );
};

/** Top-left chapter chip: [03] 锡膏 SOLDER PASTE */
export const ChapterChip: React.FC<{num: string; zh: string; en: string; start: number; end: number}> = ({num, zh, en, start, end}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.3));
  if (op <= 0) return null;
  const slide = (1 - easeOut(seg(frame, start, start + s(0.4)))) * -24;
  return (
    <div style={{position: 'absolute', left: 64, top: 52, opacity: op, transform: `translateX(${slide}px)`, display: 'flex', alignItems: 'center', gap: 16}}>
      <div style={{background: T.orange, color: '#1a1410', fontFamily: T.mono, fontWeight: 700, fontSize: 22, padding: '4px 10px', borderRadius: 4}}>{num}</div>
      <div style={{fontFamily: T.zh, fontWeight: 700, fontSize: 30, color: T.text, textShadow: shadow}}>{zh}</div>
      <div style={{fontFamily: T.mono, fontSize: 16, letterSpacing: 4, color: T.muted, textShadow: shadow, marginTop: 4}}>{en}</div>
    </div>
  );
};

/** Top-right big orange counter: 器件 [3] / 5 · 贴装 C1 */
export const Counter: React.FC<{pre?: string; value: string; post?: string; sub?: string; subEn?: string}> = ({pre, value, post, sub, subEn}) => (
  <div style={{position: 'absolute', right: 64, top: 48, textAlign: 'right', textShadow: shadow}}>
    <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 10}}>
      {pre ? <span style={{fontFamily: T.zh, fontSize: 28, color: T.text}}>{pre}</span> : null}
      <span style={{fontFamily: T.mono, fontWeight: 700, fontSize: 64, color: T.orange, lineHeight: 1}}>{value}</span>
      {post ? <span style={{fontFamily: T.zh, fontSize: 28, color: T.text}}>{post}</span> : null}
    </div>
    {sub ? <div style={{fontFamily: T.zh, fontSize: 20, color: T.text, marginTop: 6}}>{sub}</div> : null}
    {subEn ? <div style={{fontFamily: T.mono, fontSize: 13, letterSpacing: 3, color: T.dim, marginTop: 2}}>{subEn}</div> : null}
  </div>
);

/** Bottom-left running totals. */
export const Stats: React.FC<{rows: {zh: string; en: string; value: string; unit: string}[]; opacity?: number}> = ({rows, opacity = 1}) => (
  <div style={{position: 'absolute', left: 64, bottom: 64, opacity, textShadow: shadow}}>
    {rows.map((r) => (
      <div key={r.en} style={{display: 'grid', gridTemplateColumns: '110px auto', alignItems: 'baseline', marginBottom: 10}}>
        <div>
          <div style={{fontFamily: T.zh, fontSize: 18, color: T.muted}}>{r.zh}</div>
          <div style={{fontFamily: T.mono, fontSize: 11, letterSpacing: 3, color: T.dim}}>{r.en}</div>
        </div>
        <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 32, color: T.text}}>
          {r.value}
          <span style={{fontFamily: T.zh, fontSize: 16, color: T.muted, marginLeft: 6, fontWeight: 400}}>{r.unit}</span>
        </div>
      </div>
    ))}
  </div>
);

/** Bottom-centre bilingual subtitle. `**…**` in `zh` is rendered orange. Typewriter reveal. */
export const Subtitle: React.FC<{zh: string; en: string; start: number; end: number}> = ({zh, en, start, end}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.2));
  if (op <= 0) return null;
  const plain = zh.replace(/\*\*/g, '');
  const shown = Math.floor(seg(frame, start, start + s(plain.length / 22)) * plain.length);
  // Re-apply highlight ranges to the visible prefix.
  const parts: {text: string; hl: boolean}[] = [];
  let hl = false;
  let count = 0;
  for (const chunk of zh.split('**')) {
    const visible = chunk.slice(0, Math.max(0, shown - count));
    if (visible) parts.push({text: visible, hl});
    count += chunk.length;
    hl = !hl;
  }
  const enOp = seg(frame, start + s(0.35), start + s(0.7));
  return (
    <div style={{position: 'absolute', left: 0, right: 0, bottom: 86, textAlign: 'center', opacity: op, textShadow: shadow}}>
      <div style={{fontFamily: T.zh, fontWeight: 500, fontSize: 42, color: T.text, letterSpacing: 1}}>
        {parts.map((p, i) => (
          <span key={i} style={{color: p.hl ? T.orange : T.text}}>
            {p.text}
          </span>
        ))}
      </div>
      <div style={{fontFamily: T.serif, fontStyle: 'italic', fontSize: 20, color: T.muted, marginTop: 6, opacity: enOp}}>{en}</div>
    </div>
  );
};

/** Fake "processing" panel, e.g. SCAN 原理图识别 / NETS 6 / PARTS 5 */
export const ScanPanel: React.FC<{title: string; titleEn: string; rows: [string, string][]; start: number; end: number; left?: number; top?: number}> = ({title, titleEn, rows, start, end, left = 64, top = 140}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.25));
  if (op <= 0) return null;
  return (
    <div style={{position: 'absolute', left, top, opacity: op, background: T.panel, borderRadius: 8, padding: '16px 22px', minWidth: 330, fontFamily: T.mono, backdropFilter: 'blur(6px)'}}>
      <div style={{display: 'flex', gap: 14, alignItems: 'baseline', marginBottom: 10}}>
        <span style={{color: T.orange, fontWeight: 700, fontSize: 16, letterSpacing: 3}}>{titleEn}</span>
        <span style={{color: T.text, fontFamily: T.zh, fontSize: 18}}>{title}</span>
      </div>
      {rows.map(([k, v], i) => {
        const show = seg(frame, start + s(0.25 + i * 0.22), start + s(0.45 + i * 0.22));
        return (
          <div key={k} style={{display: 'flex', justifyContent: 'space-between', fontSize: 15, color: T.muted, letterSpacing: 2, marginBottom: 6, opacity: show}}>
            <span>{k}</span>
            <span style={{color: T.cyan}}>{v}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Corner brackets with pixel coordinates, like a document scanner. */
export const ScanFrame: React.FC<{x: number; y: number; w: number; h: number; start: number; end: number}> = ({x, y, w, h, start, end}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.25));
  if (op <= 0) return null;
  const L = 28;
  const corner = (cx: number, cy: number, sx: number, sy: number) => (
    <div key={`${cx}-${cy}`} style={{position: 'absolute', left: cx, top: cy, width: L, height: L, borderTop: sy < 0 ? `2px solid ${T.cyan}` : undefined, borderBottom: sy > 0 ? `2px solid ${T.cyan}` : undefined, borderLeft: sx < 0 ? `2px solid ${T.cyan}` : undefined, borderRight: sx > 0 ? `2px solid ${T.cyan}` : undefined}} />
  );
  const scanY = y + h * easeInOut(seg(frame, start + s(0.2), start + s(1.4)));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op, fontFamily: T.mono, fontSize: 14, color: T.cyan, letterSpacing: 1}}>
      {corner(x, y, -1, -1)}
      {corner(x + w - L, y, 1, -1)}
      {corner(x, y + h - L, -1, 1)}
      {corner(x + w - L, y + h - L, 1, 1)}
      <div style={{position: 'absolute', left: x, top: y - 24}}>{`${x}, ${y}`}</div>
      <div style={{position: 'absolute', left: x + w - 110, top: y + h + 8}}>{`${x + w}, ${y + h}`}</div>
      <div style={{position: 'absolute', left: x, top: scanY, width: w, height: 2, background: `linear-gradient(90deg, transparent, ${T.cyan}, transparent)`, opacity: 0.9}} />
    </div>
  );
};

/** The schematic image, wiped in from the left with a glow line; part callouts pop afterwards. */
export const SchematicOverlay: React.FC<{src: string; start: number; end: number; parts: {ref: string; value: string}[]}> = ({src, start, end, parts}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.3));
  if (op <= 0) return null;
  const x = 560;
  const y = 160;
  const w = 1000;
  const h = 640;
  const wipe = easeInOut(seg(frame, start + s(0.2), start + s(1.5)));
  const paperTilt = lerp(-2.5, 0, easeOut(seg(frame, start, start + s(1.2))));
  return (
    <div style={{position: 'absolute', inset: 0, opacity: op}}>
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h, transform: `rotate(${paperTilt}deg)`, background: '#f6f3ea', borderRadius: 6, boxShadow: '0 30px 80px rgba(0,0,0,0.55)', overflow: 'hidden'}}>
        <Img src={staticFile(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: 24, clipPath: `inset(0 ${(1 - wipe) * 100}% 0 0)`}} />
        <div style={{position: 'absolute', top: 0, bottom: 0, left: `${wipe * 100}%`, width: 3, background: T.cyan, boxShadow: `0 0 18px ${T.cyan}`, opacity: wipe < 1 ? 1 : 0}} />
      </div>
      <ScanFrame x={x - 18} y={y - 18} w={w + 36} h={h + 36} start={start} end={end} />
      {/* part callouts */}
      <div style={{position: 'absolute', left: x + w + 50, top: y + 40, fontFamily: T.mono}}>
        {parts.map((p, i) => {
          const show = easeOut(seg(frame, start + s(1.6 + i * 0.18), start + s(1.9 + i * 0.18)));
          return (
            <div key={p.ref} style={{opacity: show, transform: `translateX(${(1 - show) * 20}px)`, marginBottom: 12, display: 'flex', gap: 12, alignItems: 'baseline'}}>
              <span style={{background: T.panel, color: T.orange, fontWeight: 700, fontSize: 16, padding: '4px 8px', borderRadius: 4}}>{p.ref}</span>
              <span style={{color: T.text, fontSize: 18, textShadow: shadow}}>{p.value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Right-side layout spec card: LAYOUT 布板 · 2 层 · 1 oz … */
export const SpecCard: React.FC<{rows: [string, string][]; start: number; end: number}> = ({rows, start, end}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.25));
  if (op <= 0) return null;
  return (
    <div style={{position: 'absolute', right: 64, top: 160, opacity: op, fontFamily: T.mono, textAlign: 'right'}}>
      {rows.map(([k, v], i) => {
        const show = seg(frame, start + s(0.2 + i * 0.15), start + s(0.4 + i * 0.15));
        return (
          <div key={k} style={{opacity: show, marginBottom: 8}}>
            <span style={{color: T.dim, fontSize: 12, letterSpacing: 3, marginRight: 12}}>{k}</span>
            <span style={{color: T.text, fontSize: 18, textShadow: shadow}}>{v}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Seven-segment-ish DMM readout at bottom right. */
export const Multimeter: React.FC<{label: string; value: number; unit: string; start: number; end: number; top: number}> = ({label, value, unit, start, end, top}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.25));
  if (op <= 0) return null;
  return (
    <div style={{position: 'absolute', right: 64, top, opacity: op, background: T.panel, borderRadius: 10, padding: '14px 22px', minWidth: 300, fontFamily: T.mono, backdropFilter: 'blur(6px)'}}>
      <div style={{color: T.dim, fontSize: 12, letterSpacing: 4, marginBottom: 4}}>{label}</div>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'flex-end'}}>
        <span style={{fontSize: 58, fontWeight: 700, color: '#d8f6ff', letterSpacing: 2, textShadow: '0 0 14px rgba(110,198,230,0.55)'}}>{value.toFixed(2)}</span>
        <span style={{fontSize: 22, color: T.muted}}>{unit}</span>
      </div>
    </div>
  );
};

/** End card: totals + "every frame is code". */
export const EndCard: React.FC<{title: string; rows: EndCardRow[]; prompt: string; start: number; end: number; codeLines: string}> = ({title, rows, prompt, start, end, codeLines}) => {
  const frame = useCurrentFrame();
  const op = fadeInOut(frame, start, end, s(0.4));
  if (op <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 120, top: 150, opacity: op, textShadow: shadow}}>
      <div style={{borderLeft: `4px solid ${T.orange}`, paddingLeft: 22, fontFamily: T.zh, fontWeight: 700, fontSize: 40, color: T.text, marginBottom: 30}}>{title}</div>
      {rows.map((r, i) => {
        const show = easeOut(seg(frame, start + s(0.3 + i * 0.16), start + s(0.6 + i * 0.16)));
        return (
          <div key={r.en} style={{display: 'grid', gridTemplateColumns: '180px auto', alignItems: 'baseline', marginBottom: 14, opacity: show, transform: `translateY(${(1 - show) * 10}px)`}}>
            <div>
              <div style={{fontFamily: T.zh, fontSize: 22, color: T.muted}}>{r.label}</div>
              <div style={{fontFamily: T.mono, fontSize: 11, letterSpacing: 3, color: T.dim}}>{r.en}</div>
            </div>
            <div style={{fontFamily: T.mono, fontWeight: 700, fontSize: 44, color: r.accent ? T.orange : T.text}}>
              {r.value}
              <span style={{fontFamily: T.zh, fontSize: 18, color: T.muted, marginLeft: 8, fontWeight: 400}}>{r.unit}</span>
            </div>
          </div>
        );
      })}
      <div style={{marginTop: 28, paddingTop: 18, borderTop: '1px solid rgba(243,241,236,0.18)', width: 760, opacity: seg(frame, start + s(1.6), start + s(2.0))}}>
        <div style={{fontFamily: T.zh, fontSize: 22, color: T.muted}}>
          本片每一帧都是代码渲染 · <span style={{color: T.orange, fontFamily: T.mono, fontWeight: 700}}>{codeLines}</span> 行
        </div>
        <div style={{fontFamily: T.mono, fontSize: 13, color: T.dim, letterSpacing: 2, marginTop: 8}}>
          PROMPT <span style={{fontFamily: T.zh, letterSpacing: 0, color: T.muted}}>“{prompt}”</span>
        </div>
      </div>
    </div>
  );
};
