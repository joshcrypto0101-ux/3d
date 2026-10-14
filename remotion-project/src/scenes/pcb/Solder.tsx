import {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {useMaterials} from '../../three/Materials';
import {useAssets} from '../../three/Assets';
import {bump, lerp} from '../../lib/anim';

export const PASTE_H = 0.13;

/** Concave fillet profile from the leg (x=0, tall) down to the pad's outer edge (x=1, flat). */
const filletGeometry = (() => {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 1);
  shape.quadraticCurveTo(0.22, 0.12, 1, 0.04);
  shape.lineTo(1, 0);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: false, curveSegments: 10});
  g.translate(0, 0, -0.5); // centre across the pad width
  g.computeVertexNormals();
  return g;
})();

/** Meniscus around a through-hole pin: lathe of a concave curve. */
const meniscusGeometry = (() => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector2(lerp(0.34, 1, t), 0.5 * Math.pow(1 - t, 2.2) + 0.02));
  }
  pts.push(new THREE.Vector2(1, 0));
  pts.push(new THREE.Vector2(0.34, 0));
  const g = new THREE.LatheGeometry(pts, 28);
  g.computeVertexNormals();
  return g;
})();

const pasteBox = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
const solderBox = new RoundedBoxGeometry(1, 1, 1, 3, 0.18);

export interface PadSolderProps {
  /** world position of the pad centre (x, z) */
  x: number;
  z: number;
  w: number;
  h: number;
  /** through-hole pad radius, if any */
  r?: number;
  /** direction from the pad towards the component leg, in the XZ plane */
  towardLeg: [number, number];
  /** 0 = paste, 1 = fully reflowed */
  reflow: number;
  /** 0..1 heat glow */
  heat: number;
  /** 0..1 paste appear */
  appear: number;
  padZ: number;
}

export const PadSolder: React.FC<PadSolderProps> = ({x, z, w, h, r, towardLeg, reflow, heat, appear, padZ}) => {
  const m = useMaterials();
  const [pasteMat, solderMat] = useMemo(() => {
    const p = m.paste.clone();
    const s = m.solder.clone();
    p.emissive = new THREE.Color('#ff5a14');
    s.emissive = new THREE.Color('#ff5a14');
    return [p, s];
  }, [m]);
  if (appear <= 0) return null;
  const glow = heat * 1.1 * bump(reflow) + heat * 0.25;
  pasteMat.emissiveIntensity = glow;
  solderMat.emissiveIntensity = glow * 0.8;
  // paste melts away as solder forms
  const pasteK = Math.max(0, 1 - reflow * 1.6);
  const solderK = Math.max(0, (reflow - 0.25) / 0.75);
  const angle = Math.atan2(-towardLeg[1], towardLeg[0]);
  const pop = appear < 1 ? 0.6 + 0.4 * appear : 1;

  if (r) {
    // through-hole: paste ring, then a meniscus up the pin
    return (
      <group position={[x, padZ, z]}>
        {pasteK > 0 ? (
          <mesh position={[0, PASTE_H / 2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[pop, pop, 1]} material={pasteMat} castShadow>
            <torusGeometry args={[r * 0.62, PASTE_H * 0.9 * pasteK, 8, 28]} />
          </mesh>
        ) : null}
        {solderK > 0 ? <mesh geometry={meniscusGeometry} scale={[r * 1.05, 0.9 * solderK, r * 1.05]} material={solderMat} castShadow /> : null}
      </group>
    );
  }
  const legLen = Math.max(w, h) * 0.92; // fillet runs along the pad's long axis
  const across = Math.min(w, h) * 0.9;
  return (
    <group position={[x, padZ, z]}>
      {pasteK > 0 ? (
        <mesh geometry={pasteBox} position={[0, (PASTE_H * pasteK) / 2, 0]} scale={[w * 0.86 * pop, PASTE_H * pasteK + 0.001, h * 0.86 * pop]} material={pasteMat} castShadow />
      ) : null}
      {solderK > 0 ? (
        <group rotation={[0, angle, 0]}>
          {/* thin wetted layer over the whole pad */}
          <mesh geometry={solderBox} position={[0, 0.03, 0]} scale={[Math.max(w, h) * 0.97, 0.06 * solderK + 0.001, across]} material={solderMat} />
          {/* fillet climbing the leg, leg sits at ~35% from the inner edge */}
          <mesh geometry={filletGeometry} position={[-legLen * 0.15, 0, 0]} rotation={[0, 0, 0]} scale={[legLen * 0.65, 0.34 * solderK, across]} material={solderMat} castShadow />
        </group>
      ) : null}
    </group>
  );
};

/** Rising flux smoke above a heated joint. Deterministic in `frame`. */
export const Smoke: React.FC<{position: [number, number, number]; heat: number; frame: number; seed: number}> = ({position, heat, frame, seed}) => {
  const {tex} = useAssets();
  const mat = useMemo(() => new THREE.SpriteMaterial({map: tex.smoke, transparent: true, depthWrite: false, opacity: 1, color: '#d9d4c8'}), [tex]);
  if (heat <= 0.02) return null;
  const n = 16;
  const sprites = [];
  for (let i = 0; i < n; i++) {
    const ph = (i * 0.618 + seed * 0.37) % 1;
    const t = (frame * 0.022 + ph) % 1;
    const a = i * 2.4 + seed;
    const drift = 0.25 + 0.6 * t;
    const px = Math.sin(a) * drift + Math.sin(frame * 0.05 + i) * 0.15 * t;
    const pz = Math.cos(a) * drift;
    const py = 0.3 + t * 4.2;
    const sc = 0.5 + t * 2.2;
    const op = heat * (1 - t) * t * 2.2 * 0.5;
    sprites.push(
      <sprite key={i} position={[position[0] + px, position[1] + py, position[2] + pz]} scale={[sc, sc, 1]} material={mat}>
        {/* opacity per sprite via material clone would cost; approximate with scale + global heat */}
      </sprite>,
    );
    void op;
  }
  mat.opacity = Math.min(0.5, heat * 0.45);
  return <>{sprites}</>;
};
