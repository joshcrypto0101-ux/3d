import * as THREE from 'three';
import {useMemo} from 'react';

const steel = <meshStandardMaterial color="#d2d6dc" roughness={0.22} metalness={1} />;

/**
 * Tweezers. The group origin is the tip. `open` 0 = closed on the part, 1 = fully open.
 * Prongs run from the tip up and back towards +x/+y.
 */
export const Tweezers: React.FC<{
  position: [number, number, number];
  open: number;
  grip: number;
  yaw?: number;
}> = ({position, open, grip, yaw = 0.6}) => {
  const L = 34;
  const half = grip / 2 + 0.12 + open * 1.4;
  const tilt = 0.95; // radians from vertical
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      {[-1, 1].map((sgn) => (
        <group key={sgn} position={[0, 0, sgn * half]} rotation={[0, 0, -tilt]}>
          {/* tip taper */}
          <mesh position={[0, 4, 0]} castShadow>
            <boxGeometry args={[0.55, 8, 0.35]} />
            {steel}
          </mesh>
          <mesh position={[0, 8 + (L - 8) / 2, sgn * 0.6]} rotation={[sgn * -0.035, 0, 0]} castShadow>
            <boxGeometry args={[1.6, L - 8, 0.5]} />
            {steel}
          </mesh>
        </group>
      ))}
    </group>
  );
};

/** Hot-air nozzle. Origin at the nozzle mouth. `heat` 0..1 drives the glow. */
export const HotAir: React.FC<{position: [number, number, number]; heat: number}> = ({position, heat}) => {
  return (
    <group position={position} rotation={[0, 0, 0.35]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[1.5, 1.7, 6, 24]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 7.5, 0]} castShadow>
        <cylinderGeometry args={[2.6, 1.6, 3.2, 24]} />
        <meshStandardMaterial color="#3a3d44" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 15, 0]}>
        <cylinderGeometry args={[2.8, 2.6, 12, 24]} />
        <meshStandardMaterial color="#232529" roughness={0.7} />
      </mesh>
      {/* glowing mouth */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.5, 24]} />
        <meshBasicMaterial color={new THREE.Color('#ff7a2a').multiplyScalar(0.3 + heat * 1.5)} toneMapped={false} />
      </mesh>
      {/* heat cone */}
      <mesh position={[0, -2.0, 0]}>
        <coneGeometry args={[2.0, 4.0, 24, 1, true]} />
        <meshBasicMaterial color="#ff9a3c" transparent opacity={0.008 + heat * 0.02} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      {heat > 0 ? <pointLight position={[0, 0.6, 0]} intensity={heat * 18} color="#ff8a3c" distance={10} /> : null}
    </group>
  );
};

/** Flux brush. Origin at the bristle tips. */
export const Brush: React.FC<{position: [number, number, number]; wet: number}> = ({position, wet}) => {
  const bristles = useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) out.push([(i - 2) * 0.55, (j - 1) * 0.55]);
    return out;
  }, []);
  return (
    <group position={position} rotation={[0, 0, -0.5]}>
      {bristles.map(([x, z], i) => (
        <mesh key={i} position={[x, 2.2, z]} castShadow>
          <cylinderGeometry args={[0.12, 0.08, 4.4, 8]} />
          <meshStandardMaterial color={wet > 0.5 ? '#6b6356' : '#9a8f7e'} roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 5.2, 0]} castShadow>
        <cylinderGeometry args={[1.4, 1.2, 2.2, 16]} />
        <meshStandardMaterial color="#c9ccd1" roughness={0.3} metalness={0.9} />
      </mesh>
      <mesh position={[0, 14, 0]} castShadow>
        <cylinderGeometry args={[0.9, 1.3, 16, 16]} />
        <meshStandardMaterial color="#1d1f24" roughness={0.6} />
      </mesh>
    </group>
  );
};

/** A bendy wire from `from` to `to` (world coords), sagging a little. */
export const Wire: React.FC<{from: [number, number, number]; to: [number, number, number]; color: string; radius?: number}> = ({from, to, color, radius = 0.45}) => {
  const geom = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const mid = a.clone().lerp(b, 0.5);
    mid.y += 3 + a.distanceTo(b) * 0.1;
    const curve = new THREE.CatmullRomCurve3([a, mid, b.clone().add(new THREE.Vector3(0, 2.2, 0)), b]);
    return new THREE.TubeGeometry(curve, 32, radius, 10, false);
  }, [from, to, radius]);
  return (
    <mesh geometry={geom} castShadow>
      <meshStandardMaterial color={color} roughness={0.55} />
    </mesh>
  );
};

/** Multimeter probe, tip at origin, leaning back towards +x. */
export const Probe: React.FC<{position: [number, number, number]; color: string}> = ({position, color}) => {
  return (
    <group position={position} rotation={[0, 0, -0.75]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.05, 6, 10]} />
        <meshStandardMaterial color="#d2d6dc" roughness={0.22} metalness={1} />
      </mesh>
      <mesh position={[0, 12, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.5, 12, 14]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
    </group>
  );
};
