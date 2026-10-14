import type {PartData, PcbVideoData} from '../../lib/types';
import {FOOTPRINTS, rotate2} from './footprints';
import {TextPlane} from '../../three/TextPlane';
import {easeOutBack, seg} from '../../lib/anim';

export const PAD_Z = 0.03; // pad top above board surface
export const COLORS = {
  mask: '#1d6a3f',
  maskEdge: '#14512f',
  pad: '#d6b25a',
  silk: '#f4f1e8',
  paste: '#8d8f93',
  solder: '#dfe3e8',
  bodyBlack: '#1f2023',
  capBody: '#b58a5c',
  capEnd: '#c9ccd1',
  headerPin: '#d6b25a',
};

/** Board-space (x, y in mm, +y = top edge) to three.js world (x, z) with +y up. */
export const toWorld = (x: number, y: number): [number, number] => [x, -y];

export const padsOf = (part: PartData) =>
  FOOTPRINTS[part.kind].pads.map((p) => {
    const [dx, dy] = rotate2(p.x, p.y, part.rot);
    const rotated = part.rot % 180 !== 0;
    return {
      x: part.x + dx,
      y: part.y + dy,
      w: p.r ? p.r * 2 : rotated ? p.h! : p.w!,
      h: p.r ? p.r * 2 : rotated ? p.w! : p.h!,
      r: p.r,
    };
  });

export const Board: React.FC<{
  data: PcbVideoData;
  /** 0..1: pads and silkscreen appear one part at a time. */
  layoutProgress: number;
}> = ({data, layoutProgress}) => {
  const {w, h, t} = data.board;
  const n = data.parts.length + data.testPoints.length;
  let idx = 0;
  const appear = () => {
    const i = idx++;
    const local = seg(layoutProgress, i / n, (i + 1) / n);
    return easeOutBack(local) * (local > 0 ? 1 : 0);
  };
  return (
    <group>
      {/* FR-4 core with solder mask */}
      <mesh position={[0, -t / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, t, h]} />
        <meshStandardMaterial color={COLORS.maskEdge} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[w - 0.2, 0.02, h - 0.2]} />
        <meshStandardMaterial color={COLORS.mask} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Mounting holes */}
      {[
        [-w / 2 + 1.8, h / 2 - 1.8],
        [w / 2 - 1.8, h / 2 - 1.8],
        [-w / 2 + 1.8, -h / 2 + 1.8],
        [w / 2 - 1.8, -h / 2 + 1.8],
      ].map(([x, y], i) => (
        <mesh key={i} position={[x, 0.035, y]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.4, 24]} />
          <meshStandardMaterial color={COLORS.pad} roughness={0.35} metalness={0.7} />
        </mesh>
      ))}
      {/* Pads + silkscreen, part by part */}
      {data.parts.map((part) => {
        const sc = appear();
        if (sc <= 0) return null;
        const fp = FOOTPRINTS[part.kind];
        const [cx, cz] = toWorld(part.x, part.y);
        const rotated = part.rot % 180 !== 0;
        const cw = rotated ? fp.courtyard.d : fp.courtyard.w;
        const cd = rotated ? fp.courtyard.w : fp.courtyard.d;
        return (
          <group key={part.ref} scale={[sc, 1, sc]} position={[cx, 0, cz]}>
            {padsOf(part).map((p, i) => {
              const [px, pz] = toWorld(p.x - part.x, p.y - part.y);
              return p.r ? (
                <group key={i} position={[px, 0, pz]}>
                  <mesh position={[0, PAD_Z / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.45, p.r, 28]} />
                    <meshStandardMaterial color={COLORS.pad} roughness={0.35} metalness={0.7} />
                  </mesh>
                  <mesh position={[0, -t / 2, 0]}>
                    <cylinderGeometry args={[0.45, 0.45, t + 0.1, 20]} />
                    <meshStandardMaterial color="#0b0f0c" />
                  </mesh>
                </group>
              ) : (
                <mesh key={i} position={[px, PAD_Z / 2, pz]} receiveShadow>
                  <boxGeometry args={[p.w, PAD_Z, p.h]} />
                  <meshStandardMaterial color={COLORS.pad} roughness={0.35} metalness={0.7} />
                </mesh>
              );
            })}
            {/* courtyard outline */}
            {[
              [0, -cd / 2, cw, 0.12],
              [0, cd / 2, cw, 0.12],
              [-cw / 2, 0, 0.12, cd],
              [cw / 2, 0, 0.12, cd],
            ].map(([x, z, sx, sz], i) => (
              <mesh key={i} position={[x, 0.04, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[sx, sz]} />
                <meshBasicMaterial color={COLORS.silk} toneMapped={false} />
              </mesh>
            ))}
            <TextPlane text={part.ref} position={[0, 0.045, -cd / 2 - 0.55]} size={0.7} color={COLORS.silk} />
          </group>
        );
      })}
      {data.testPoints.map((tp) => {
        const sc = appear();
        if (sc <= 0) return null;
        const [x, z] = toWorld(tp.x, tp.y);
        return (
          <group key={tp.name} position={[x, 0, z]} scale={[sc, 1, sc]}>
            <mesh position={[0, PAD_Z + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.75, 28]} />
              <meshStandardMaterial color={COLORS.pad} roughness={0.35} metalness={0.7} />
            </mesh>
            <TextPlane text={tp.name} position={[0, 0.045, 1.1]} size={0.6} color={COLORS.silk} />
          </group>
        );
      })}
      {/* Title silkscreen */}
      {layoutProgress > 0.98 ? (
        <TextPlane text={data.title.replace(/\s*·\s*/g, "   ")} position={[0, 0.045, -(h / 2 - 1.5)]} size={0.8} color={COLORS.silk} />
      ) : null}
    </group>
  );
};
