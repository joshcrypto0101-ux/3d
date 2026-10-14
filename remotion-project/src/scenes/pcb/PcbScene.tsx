import {useCurrentFrame} from 'remotion';
import type {PcbVideoData, PartData} from '../../lib/types';
import type {Timeline, PlaceSlot} from '../../lib/timeline';
import {s} from '../../lib/timeline';
import {bump, easeInOut, easeOut, lerp, seg} from '../../lib/anim';
import {Board, COLORS, PAD_Z, padsOf, toWorld} from './Board';
import {FOOTPRINTS} from './footprints';
import {PartBody} from './Part';
import {Brush, HotAir, Probe, Tweezers, Wire} from './Tools';
import {Lights} from '../../three/Lights';
import {Env} from '../../three/Env';
import {CameraRig, type CamKey} from '../../three/CameraRig';
import {useMemo} from 'react';

const PASTE_H = 0.12;

/** Per-part animation state at a given frame. */
interface PartState {
  visible: boolean;
  /** world position of the part origin (resting height 0 = on pads) */
  pos: [number, number, number];
  rotY: number;
  reflow: number; // 0 paste, 1 solder
  heat: number; // 0..1 glow
  held: boolean; // in the tweezers
}

const partState = (part: PartData, slot: PlaceSlot | undefined, frame: number): PartState => {
  const [wx, wz] = toWorld(part.x, part.y);
  const baseRot = (part.rot * Math.PI) / 180;
  if (!slot || frame < slot.start) {
    return {visible: false, pos: [wx, 30, wz], rotY: baseRot, reflow: 0, heat: 0, held: false};
  }
  // slight misplacement that the reflow corrects (self-centering)
  const misX = 0.32;
  const misZ = -0.18;
  const misRot = 0.1;
  const reflow = easeInOut(seg(frame, slot.heat + s(0.15), slot.reflowed));
  const heat = Math.min(seg(frame, slot.heat, slot.heat + s(0.2)), 1 - seg(frame, slot.reflowed, slot.end));
  if (frame < slot.placed) {
    const t = easeOut(seg(frame, slot.start, slot.placed));
    const y = lerp(11, PASTE_H + PAD_Z, t);
    return {visible: true, pos: [wx + misX, y, wz + misZ], rotY: baseRot + misRot, reflow: 0, heat: 0, held: true};
  }
  const settle = lerp(PASTE_H + PAD_Z, PAD_Z + 0.06, reflow);
  return {
    visible: true,
    pos: [wx + misX * (1 - reflow), settle, wz + misZ * (1 - reflow)],
    rotY: baseRot + misRot * (1 - reflow),
    reflow,
    heat,
    held: false,
  };
};

export const PcbScene: React.FC<{data: PcbVideoData; tl: Timeline}> = ({data, tl}) => {
  const frame = useCurrentFrame();
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

  // --- active tool state -----------------------------------------------------
  const activeSlot = tl.slots.find((sl) => frame >= sl.start && frame < sl.end);
  const activePart = activeSlot ? partsByRef[activeSlot.ref] : undefined;
  const activeState = activePart ? partState(activePart, activeSlot, frame) : undefined;

  let tweezers: React.ReactNode = null;
  let hotAir: React.ReactNode = null;
  let heatGlow = 0;
  if (activeSlot && activePart && activeState) {
    const fp = FOOTPRINTS[activePart.kind];
    const grip = activePart.rot % 180 !== 0 ? fp.body.w : fp.body.d;
    const open = easeOut(seg(frame, activeSlot.placed, activeSlot.placed + s(0.12)));
    const lift = easeInOut(seg(frame, activeSlot.placed + s(0.1), activeSlot.heat));
    const tipY = activeState.pos[1] + fp.body.h * 0.6 + lift * 14;
    const tipX = activeState.pos[0] + lift * 6;
    const tipZ = activeState.pos[2] + lift * 4;
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

  return (
    <>
      <color attach="background" args={['#0f1216']} />
      <fog attach="fog" args={['#0f1216', 60, 140]} />
      <Env />
      <Lights warm={heatGlow * 0.6} />
      <CameraRig keys={keys} fov={30} />

      {/* work mat */}
      <mesh position={[0, -data.board.t - 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#2a2f35" roughness={0.95} />
      </mesh>
      <gridHelper args={[400, 80, '#3a4048', '#333940']} position={[0, -data.board.t, 0]} />

      <Board data={data} layoutProgress={layoutProgress} />

      {/* paste / solder per pad */}
      {data.parts.map((part, pi) => {
        const slot = slotsByRef[part.ref];
        const state = partState(part, slot, frame);
        const pads = padsOf(part);
        const n = data.parts.length;
        const appear = seg(pasteProgress, pi / n, (pi + 0.6) / n);
        if (appear <= 0) return null;
        return pads.map((p, i) => {
          const [px, pz] = toWorld(p.x, p.y);
          const r = state.reflow;
          const h = lerp(PASTE_H, 0.1, r);
          const col = COLORS.paste;
          const emissive = heatGlow > 0 && slot && frame >= slot.heat && frame < slot.end ? state.heat : 0;
          const scale = lerp(0.82, 0.97, r) * easeOut(appear);
          return (
            <mesh key={`${part.ref}-${i}`} position={[px, PAD_Z + h / 2, pz]} scale={[scale, 1, scale]} castShadow>
              {p.r ? <cylinderGeometry args={[p.r * 0.95, p.r * 0.95, h, 20]} /> : <boxGeometry args={[p.w, h, p.h]} />}
              <meshStandardMaterial
                color={r > 0.5 ? COLORS.solder : col}
                roughness={lerp(0.95, 0.22, r)}
                metalness={lerp(0.25, 1, r)}
                emissive="#ff6a1a"
                emissiveIntensity={emissive * 0.9 * bump(r)}
              />
            </mesh>
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

      {/* flux residue + brush */}
      {frame >= st.place.start && frame < st.clean.end
        ? data.parts.map((part) => {
            const slot = slotsByRef[part.ref];
            if (!slot || frame < slot.heat) return null;
            const [wx, wz] = toWorld(part.x, part.y);
            const fp = FOOTPRINTS[part.kind];
            const cleared = seg(brushX - wx, -1.5, 1.5) * (cleanT > 0 ? 1 : 0);
            const op = 0.35 * seg(frame, slot.heat, slot.reflowed) * (1 - cleared);
            if (op <= 0.005) return null;
            const rad = Math.max(fp.courtyard.w, fp.courtyard.d) * 0.7;
            return (
              <mesh key={part.ref} position={[wx + 0.2, PAD_Z + 0.004, wz + 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[rad, 24]} />
                <meshBasicMaterial color="#6b4a1e" transparent opacity={op} depthWrite={false} />
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
                <Wire from={[sx - 6, 2, z1 + 20]} to={[sx, 7.2, z1]} color="#d8322a" />
                <Wire from={[sx - 6, 2, z2 + 22]} to={[lerp(-40, x2, wireT), 7.2, z2]} color="#17181b" />
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
                    <Probe position={[x1, 7.3 + dy, z1]} color="#d8322a" />
                    <Probe position={[x2 + 0.3, 7.3 + dy, z2 + 0.6]} color="#17181b" />
                  </>
                );
              })()
            : null}
        </>
      ) : null}
    </>
  );
};
