import type {PartData, PcbVideoData} from '../../lib/types';
import {FOOTPRINTS, rotate2} from './footprints';
import {TextPlane} from '../../three/TextPlane';
import {easeOutBack, seg} from '../../lib/anim';
import {useMaterials} from '../../three/Materials';

export const PAD_Z = 0.035; // pad top above the solder mask
export const COLORS = {silk: '#f4f1e8'};

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
  const m = useMaterials();
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
      {/* FR-4 core */}
      <mesh position={[0, -t / 2, 0]} receiveShadow castShadow material={m.maskEdge}>
        <boxGeometry args={[w, t, h]} />
      </mesh>
      {/* solder mask top */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={m.mask}>
        <planeGeometry args={[w - 0.1, h - 0.1]} />
      </mesh>
      {/* mounting holes */}
      {[
        [-w / 2 + 1.8, h / 2 - 1.8],
        [w / 2 - 1.8, h / 2 - 1.8],
        [-w / 2 + 1.8, -h / 2 + 1.8],
        [w / 2 - 1.8, -h / 2 + 1.8],
      ].map(([x, y], i) => (
        <group key={i} position={[x, 0, y]}>
          <mesh position={[0, PAD_Z, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.pad} receiveShadow>
            <ringGeometry args={[1.0, 1.5, 32]} />
          </mesh>
          <mesh position={[0, -t / 2, 0]}>
            <cylinderGeometry args={[1.0, 1.0, t + 0.2, 24, 1, true]} />
            <meshStandardMaterial color="#8d7a4e" roughness={0.5} metalness={0.8} side={2} />
          </mesh>
          <mesh position={[0, -t - 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[1.0, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={1} />
          </mesh>
        </group>
      ))}
      {/* pads + silkscreen, part by part */}
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
                  <mesh position={[0, PAD_Z, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.pad} receiveShadow>
                    <ringGeometry args={[0.5, p.r, 32]} />
                  </mesh>
                  <mesh position={[0, -t / 2, 0]}>
                    <cylinderGeometry args={[0.5, 0.5, t + 0.1, 20, 1, true]} />
                    <meshStandardMaterial color="#8d7a4e" roughness={0.5} metalness={0.8} side={2} />
                  </mesh>
                </group>
              ) : (
                <mesh key={i} position={[px, PAD_Z / 2, pz]} material={m.pad} receiveShadow castShadow>
                  <boxGeometry args={[p.w, PAD_Z, p.h]} />
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
              <mesh key={i} position={[x, 0.012, z]} material={m.silk}>
                <boxGeometry args={[sx, 0.02, sz]} />
              </mesh>
            ))}
            <TextPlane text={part.ref} position={[0, 0.03, -cd / 2 - 0.55]} size={0.7} color={COLORS.silk} />
          </group>
        );
      })}
      {data.testPoints.map((tp) => {
        const sc = appear();
        if (sc <= 0) return null;
        const [x, z] = toWorld(tp.x, tp.y);
        return (
          <group key={tp.name} position={[x, 0, z]} scale={[sc, 1, sc]}>
            <mesh position={[0, PAD_Z / 2, 0]} material={m.pad} receiveShadow castShadow>
              <cylinderGeometry args={[0.75, 0.75, PAD_Z, 28]} />
            </mesh>
            <TextPlane text={tp.name} position={[0, 0.03, 1.1]} size={0.6} color={COLORS.silk} />
          </group>
        );
      })}
      {layoutProgress > 0.98 ? <TextPlane text={data.title.replace(/\s*·\s*/g, '   ')} position={[0, 0.03, -(h / 2 - 1.5)]} size={0.8} color={COLORS.silk} /> : null}
    </group>
  );
};
