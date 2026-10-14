import {useCurrentFrame} from 'remotion';
import {useMemo} from 'react';
import type {PcbVideoData, PartData} from '../../lib/types';
import type {Timeline, PlaceSlot} from '../../lib/timeline';
import {s} from '../../lib/timeline';
import {easeInOut, easeOut, lerp, seg} from '../../lib/anim';
import {Board, PAD_Z, padsOf, toWorld} from './Board';
import {FOOTPRINTS} from './footprints';
import {PartBody} from './Part';
import {Brush, HotAir, Probe, Tweezers, Wire} from './Tools';
import {PadSolder, PASTE_H, Smoke} from './Solder';
import {Bench} from './Props';
import {Lights} from '../../three/Lights';
import {CameraRig, useCameraFocus, type CamKey} from '../../three/CameraRig';
import {Post} from '../../three/Post';
import {useMaterials} from '../../three/Materials';

/** Per-part animation state at a given frame. */
interface PartState {
  visible: boolean;
  pos: [number, number, number];
  rotY: number;
  reflow: number;
  heat: number;
  held: boolean;
}

const partState = (part: PartData, slot: PlaceSlot | undefined, frame: number): PartState => {
  const [wx, wz] = toWorld(part.x, part.y);
  const baseRot = (part.rot * Math.PI) / 180;
  if (!slot || frame < slot.start) {
    return {visible: false, pos: [wx, 30, wz], rotY: baseRot, reflow: 0, heat: 0, held: false};
  }
  const misX = 0.3;
  const misZ = -0.16;
  const misRot = 0.09;
  const reflow = easeInOut(seg(frame, slot.heat + s(0.15), slot.reflowed));
  const heat = Math.min(seg(frame, slot.heat, slot.heat + s(0.2)), 1 - seg(frame, slot.reflowed, slot.end));
  if (frame < slot.placed) {
    const t = easeOut(seg(frame, slot.start, slot.placed));
    const y = lerp(11, PASTE_H + PAD_Z, t);
    return {visible: true, pos: [wx + misX, y, wz + misZ], rotY: baseRot + misRot, reflow: 0, heat: 0, held: true};
  }
  const settle = lerp(PASTE_H + PAD_Z, PAD_Z + 0.03, reflow);
  return {
    visible: true,
    pos: [wx + misX * (1 - reflow), settle, wz + misZ * (1 - reflow)],
    rotY: baseRot + misRot * (1 - reflow),
    reflow,
    heat,
    held: false,
  };
};

export const PcbScene: React.FC<{data: PcbVideoData; tl: Timeline; fov?: number}> = ({data, tl, fov = 30}) => {
  const frame = useCurrentFrame();
  const m = useMaterials();
  const st = tl.stages;
  const slotsByRef = useMemo(() => Object.fromEntries(tl.slots.map((sl) => [sl.ref, sl])), [tl]);
  const partsByRef = useMemo(() => Object.fromEntries(data.parts.map((p) => [p.ref, p])), [data]);

  const layoutProgress = seg(frame, st.layout.start + s(0.4), st.layout.end - s(0.3));
  const pasteProgress = seg(frame, st.paste.start + s(0.1), st.paste.end - s(0.2));

  // --- camera path -----------------------------------------------------------
  const keys = useMemo<CamKey[]>(() => {
    const k: CamKey[] = [];
    k.push({frame: 0, pos: [-10, 26, 34], target: [0, 0, 2]});
    k.push({frame: st.schematic.start, pos: [-6, 24, 30], target: [0, 0, 1]});
    k.push({frame: st.layout.start, pos: [0, 30, 22], target: [0, 0, 0]});
    k.push({frame: st.layout.end, pos: [7, 22, 18], target: [0, 0, 0]});
    k.push({frame: st.paste.end, pos: [9, 16, 13], target: [0, 0, 0]});
    for (const sl of tl.slots) {
      const p = partsByRef[sl.ref];
      const [wx, wz] = toWorld(p.x, p.y);
      k.push({frame: sl.start + s(0.5), pos: [wx + 9, 11.5, wz + 12.5], target: [wx, 0.6, wz]});
      k.push({frame: sl.reflowed, pos: [wx + 7, 8.5, wz + 9.5], target: [wx, 0.4, wz]});
    }
    k.push({frame: st.clean.start + s(0.3), pos: [4, 27, 23], target: [0, 0, 0]});
    k.push({frame: st.power.start, pos: [17, 21, 21], target: [2, 0, 2]});
    k.push({frame: st.power.start + s(2.4), pos: [15, 14, 17], target: [5, 1, 4]});
    k.push({frame: st.end.start, pos: [-10, 22, 26], target: [0, 0, 0]});
    k.push({frame: st.end.end, pos: [12, 24, 25], target: [0, 0, 0]});
    return k;
  }, [st, tl.slots, partsByRef]);
  const focus = useCameraFocus(keys, frame);

  // --- active tool state -----------------------------------------------------
  const activeSlot = tl.slots.find((sl) => frame >= sl.start && frame < sl.end);
  const activePart = activeSlot ? partsByRef[activeSlot.ref] : undefined;
  const activeState = activePart ? partState(activePart, activeSlot, frame) : undefined;

  let tweezers: React.ReactNode = null;
  let hotAir: React.ReactNode = null;
  let smoke: React.ReactNode = null;
  let heatGlow = 0;
  if (activeSlot && activePart && activeState) {
    const fp = FOOTPRINTS[activePart.kind];
    const grip = activePart.rot % 180 !== 0 ? fp.body.w : fp.body.d;
    const open = easeOut(seg(frame, activeSlot.placed, activeSlot.placed + s(0.12)));
    const lift = easeInOut(seg(frame, activeSlot.placed + s(0.1), activeSlot.heat));
    // tiny tremor while holding
    const tremor = activeState.held ? 0.04 : 0;
    const tipY = activeState.pos[1] + fp.body.h * 0.6 + lift * 14 + Math.sin(frame * 0.9) * tremor;
    const tipX = activeState.pos[0] + lift * 6 + Math.sin(frame * 0.7 + 1) * tremor;
    const tipZ = activeState.pos[2] + lift * 4 + Math.cos(frame * 0.8) * tremor;
    if (lift < 1) {
      tweezers = <Tweezers position={[tipX, tipY, tipZ]} open={open} grip={grip} yaw={activePart.rot % 180 !== 0 ? 0.6 + Math.PI / 2 : 0.6} />;
    }
    const inT = easeOut(seg(frame, activeSlot.heat - s(0.25), activeSlot.heat + s(0.1)));
    const outT = easeInOut(seg(frame, activeSlot.reflowed, activeSlot.end));
    if (inT > 0 && outT < 1) {
      const [wx, wz] = toWorld(activePart.x, activePart.y);
      const hover: [number, number, number] = [wx + 1.4, 5.0 + Math.sin(frame * 0.5) * 0.15, wz + 0.5];
      const away: [number, number, number] = [wx + 12, 14, wz + 6];
      const pos: [number, number, number] = [
        lerp(lerp(away[0], hover[0], inT), away[0], outT),
        lerp(lerp(away[1], hover[1], inT), away[1], outT),
        lerp(lerp(away[2], hover[2], inT), away[2], outT),
      ];
      heatGlow = activeState.heat;
      hotAir = <HotAir position={pos} heat={heatGlow} />;
      smoke = <Smoke position={[wx, PAD_Z + 0.2, wz]} heat={heatGlow * (1 - outT)} frame={frame} seed={activeSlot.index} />;
    }
  }

  // --- cleaning --------------------------------------------------------------
  const cleanT = seg(frame, st.clean.start + s(0.2), st.clean.end - s(0.3));
  const brushX = lerp(-15, 15, easeInOut(cleanT));
  const brushZ = Math.sin(cleanT * Math.PI * 4) * 4.5;

  // --- power -----------------------------------------------------------------
  const wireT = easeOut(seg(frame, st.power.start, st.power.start + s(1.2)));
  const probeT = easeOut(seg(frame, st.power.start + s(2.0), st.power.start + s(2.6)));
  const j1 = partsByRef.J1;
  const j2 = partsByRef.J2;

  const bokeh = activeSlot ? 2.6 : frame >= st.power.start ? 2.0 : 1.4;

  return (
    <>
      <color attach="background" args={['#15171b']} />
      <fog attach="fog" args={['#15171b', 70, 160]} />
      <Lights warm={heatGlow * 0.6} />
      <CameraRig keys={keys} fov={fov} />
      <Post focus={[focus.x, focus.y, focus.z]} bokeh={bokeh} focusRange={activeSlot ? 2.2 : 5} />

      <Bench boardT={data.board.t} />
      <Board data={data} layoutProgress={layoutProgress} />

      {/* paste -> solder per pad */}
      {data.parts.map((part, pi) => {
        const slot = slotsByRef[part.ref];
        const state = partState(part, slot, frame);
        const pads = padsOf(part);
        const n = data.parts.length;
        const appear = seg(pasteProgress, pi / n, (pi + 0.6) / n);
        if (appear <= 0) return null;
        const [cx, cz] = toWorld(part.x, part.y);
        const heating = slot && frame >= slot.heat && frame < slot.end ? state.heat : 0;
        return pads.map((p, i) => {
          const [px, pz] = toWorld(p.x, p.y);
          const dx = cx - px;
          const dz = cz - pz;
          const len = Math.hypot(dx, dz) || 1;
          return (
            <PadSolder
              key={`${part.ref}-${i}`}
              x={px}
              z={pz}
              w={p.w}
              h={p.h}
              r={p.r}
              towardLeg={[dx / len, dz / len]}
              reflow={state.reflow}
              heat={heating}
              appear={easeOut(appear)}
              padZ={PAD_Z}
            />
          );
        });
      })}

      {/* parts */}
      {data.parts.map((part) => {
        const state = partState(part, slotsByRef[part.ref], frame);
        if (!state.visible) return null;
        return (
          <group key={part.ref} position={state.pos} rotation={[0, state.rotY, 0]}>
            <PartBody part={part} />
          </group>
        );
      })}

      {tweezers}
      {hotAir}
      {smoke}

      {/* flux residue + brush */}
      {frame >= st.place.start && frame < st.clean.end
        ? data.parts.map((part) => {
            const slot = slotsByRef[part.ref];
            if (!slot || frame < slot.heat) return null;
            const [wx, wz] = toWorld(part.x, part.y);
            const fp = FOOTPRINTS[part.kind];
            const cleared = seg(brushX - wx, -1.5, 1.5) * (cleanT > 0 ? 1 : 0);
            const op = 0.16 * seg(frame, slot.heat, slot.reflowed) * (1 - cleared);
            if (op <= 0.005) return null;
            const rad = Math.max(fp.courtyard.w, fp.courtyard.d) * 0.5;
            const mat = m.flux;
            return (
              <mesh key={part.ref} position={[wx + 0.2, PAD_Z + 0.006, wz + 0.15]} rotation={[-Math.PI / 2, 0, 0]} material={mat} material-opacity={op}>
                <circleGeometry args={[rad, 28]} />
              </mesh>
            );
          })
        : null}
      {frame >= st.clean.start && frame < st.clean.end ? <Brush position={[brushX, 0.3, brushZ]} wet={1} /> : null}

      {/* power-on: battery wires to J1, probes on J2 */}
      {frame >= st.power.start && j1 && j2 ? (
        <>
          {(() => {
            const [x1, z1] = toWorld(j1.x - 1.27, j1.y);
            const [x2, z2] = toWorld(j1.x + 1.27, j1.y);
            const sx = lerp(-40, x1, wireT);
            return (
              <>
                <Wire from={[sx - 6, 2, z1 + 20]} to={[sx, 7.2, z1]} color="#c8281f" />
                <Wire from={[sx - 6, 2, z2 + 22]} to={[lerp(-40, x2, wireT), 7.2, z2]} color="#141518" />
              </>
            );
          })()}
          {probeT > 0
            ? (() => {
                const [x1, z1] = toWorld(j2.x - 1.27, j2.y);
                const [x2, z2] = toWorld(j2.x + 1.27, j2.y);
                const dy = (1 - probeT) * 12;
                return (
                  <>
                    <Probe position={[x1, 7.3 + dy, z1]} color="#c8281f" />
                    <Probe position={[x2 + 0.3, 7.3 + dy, z2 + 0.6]} color="#141518" />
                  </>
                );
              })()
            : null}
        </>
      ) : null}
    </>
  );
};
