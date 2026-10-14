import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useMemo} from 'react';
import type {PcbVideoData} from '../lib/types';
import {buildTimeline, s, stageAt} from '../lib/timeline';
import {seg, easeOut, lerp} from '../lib/anim';
import {PcbScene} from '../scenes/pcb/PcbScene';
import {FOOTPRINTS} from '../scenes/pcb/footprints';
import {ChapterChip, Counter, EndCard, Multimeter, ScanPanel, SchematicOverlay, SpecCard, Stats, Subtitle, Terminal, Vignette} from '../hud/Hud';
import {FontGate} from '../hud/FontGate';

export const PcbVideo: React.FC<{data: PcbVideoData; codeLines: string}> = ({data, codeLines}) => {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const tl = useMemo(() => buildTimeline(data), [data]);
  const st = tl.stages;
  const stage = stageAt(tl, frame);

  const totalPads = data.parts.reduce((n, p) => n + FOOTPRINTS[p.kind].pads.length, 0) + data.testPoints.length;
  const totalPaste = data.parts.reduce((g, p) => g + FOOTPRINTS[p.kind].pasteGrams, 0);

  // running numbers for the bottom-left stats
  const padsShown = Math.round(totalPads * seg(frame, st.layout.start + s(0.4), st.layout.end - s(0.3)));
  const pasteShown = totalPaste * seg(frame, st.paste.start + s(0.1), st.paste.end - s(0.2));
  const soldered = tl.slots.filter((sl) => frame >= sl.reflowed).length;
  const statsOp = Math.min(seg(frame, st.layout.start, st.layout.start + s(0.4)), 1 - seg(frame, st.power.end - s(0.3), st.power.end));

  // top-right counter per stage
  const activeSlot = tl.slots.find((sl) => frame >= sl.start && frame < sl.end);
  const activePart = activeSlot ? data.parts.find((p) => p.ref === activeSlot.ref) : undefined;
  let counter: React.ReactNode = null;
  if (stage.id === 'layout') counter = <Counter pre="焊盘" value={`${padsShown}`} post="个" sub={`${data.board.w} × ${data.board.h} mm · ${data.board.layers} 层 · ${data.board.copperOz} oz`} subEn="BOARD" />;
  if (stage.id === 'paste') counter = <Counter pre="锡膏" value={pasteShown.toFixed(3)} post="g" sub="钢网刮涂" subEn="STENCIL" />;
  if (stage.id === 'place' && activeSlot && activePart) {
    const heating = frame >= activeSlot.heat && frame < activeSlot.end;
    const temp = heating ? Math.round(lerp(25, 245, easeOut(seg(frame, activeSlot.heat, activeSlot.heat + s(0.5)))) - 60 * seg(frame, activeSlot.reflowed, activeSlot.end)) : 25;
    counter = heating ? (
      <Counter pre="焊盘温度" value={`${temp}`} post="℃" sub={`热风 · ${activePart.ref} ${activePart.value}`} subEn="HOT AIR REFLOW" />
    ) : (
      <Counter pre="器件" value={`${activeSlot.index + 1}`} post={`/ ${tl.slots.length}`} sub={`贴装 · ${activePart.ref} ${activePart.value} ${activePart.footprint}`} subEn={activePart.note ?? 'PLACE'} />
    );
  }
  if (stage.id === 'clean') counter = <Counter pre="洗板水" value="IPA" sub="刷去助焊剂残留" subEn="FLUX CLEAN" />;
  if (stage.id === 'power') counter = <Counter pre="输入" value={data.test.vin.toFixed(2)} post="V" sub={data.test.source} subEn="VIN" />;

  // DMM readings
  const vinT = seg(frame, st.power.start + s(1.0), st.power.start + s(1.3));
  const voutRise = easeOut(seg(frame, st.power.start + s(2.5), st.power.start + s(3.0)));
  const vout = data.test.vout * voutRise;

  return (
    <AbsoluteFill style={{background: '#0f1216'}}>
      <FontGate>
        <ThreeCanvas width={width} height={height} shadows dpr={1} gl={{antialias: true}} camera={{fov: 30, near: 0.5, far: 500, position: [0, 20, 30]}}>
          <PcbScene data={data} tl={tl} />
        </ThreeCanvas>

        <Vignette />
        <AbsoluteFill style={{background: '#0f1216', opacity: 0.55 * seg(frame, st.end.start, st.end.start + s(0.6)), pointerEvents: 'none'}} />

        {/* 00 intro */}
        <Terminal prompt={data.prompt} start={0} end={st.intro.end + s(0.2)} />

        {/* chapter chips */}
        {Object.values(st).map((stg) => (stg.chapter ? <ChapterChip key={stg.id} {...stg.chapter} start={stg.start} end={stg.end} /> : null))}

        {/* 01 schematic */}
        <SchematicOverlay src={data.schematic} start={st.schematic.start} end={st.schematic.end} parts={data.parts.map((p) => ({ref: p.ref, value: `${p.value} · ${p.footprint}`}))} />
        <ScanPanel
          title="原理图识别"
          titleEn="SCAN"
          start={st.schematic.start + s(0.3)}
          end={st.schematic.end}
          rows={[
            ['PARTS', `${data.parts.length}`],
            ['NETS', '4'],
            ['PINS', `${totalPads - data.testPoints.length} / ${totalPads - data.testPoints.length}`],
            ['ERC', 'OK'],
          ]}
        />

        {/* 02 layout */}
        <SpecCard
          start={st.layout.start + s(0.2)}
          end={st.layout.end}
          rows={[
            ['LAYERS', `${data.board.layers} 层`],
            ['COPPER', `${data.board.copperOz} oz`],
            ['SIZE', `${data.board.w} × ${data.board.h} mm`],
            ['PARTS', `${data.parts.length}`],
            ['TEST POINTS', data.testPoints.map((t) => t.name).join(' / ')],
          ]}
        />

        {/* 06 power */}
        <Multimeter label="VIN" value={data.test.vin * vinT} unit="V" start={st.power.start + s(0.8)} end={st.power.end} top={190} />
        <Multimeter label="VOUT" value={vout} unit="V" start={st.power.start + s(2.2)} end={st.power.end} top={310} />

        {counter}

        <Stats
          opacity={statsOp}
          rows={[
            {zh: '焊盘', en: 'PADS', value: `${padsShown}`, unit: '个'},
            {zh: '锡膏', en: 'PASTE', value: pasteShown.toFixed(3), unit: 'g'},
            {zh: '已焊', en: 'SOLDERED', value: `${soldered} / ${tl.slots.length}`, unit: ''},
          ]}
        />

        {tl.subtitles.map((sub) => (
          <Subtitle key={sub.start} {...sub} />
        ))}

        <EndCard title={data.endCard.title} rows={data.endCard.rows} prompt={data.prompt} codeLines={codeLines} start={st.end.start + s(0.2)} end={st.end.end} />
      </FontGate>
    </AbsoluteFill>
  );
};
