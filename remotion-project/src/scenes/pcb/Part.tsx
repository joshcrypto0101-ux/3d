import type {PartData} from '../../lib/types';
import {FOOTPRINTS} from './footprints';
import {COLORS} from './Board';

/** Component body geometry in its local frame (centre at origin, resting on y=0). */
export const PartBody: React.FC<{part: PartData}> = ({part}) => {
  const fp = FOOTPRINTS[part.kind];
  const {w, d, h} = fp.body;
  if (part.kind === 'cap0603') {
    return (
      <group>
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[w * 0.62, h, d]} />
          <meshStandardMaterial color={COLORS.capBody} roughness={0.6} />
        </mesh>
        {[-1, 1].map((sgn) => (
          <mesh key={sgn} position={[(sgn * w * 0.81) / 2, h / 2, 0]} castShadow>
            <boxGeometry args={[w * 0.19 * 2, h * 1.02, d * 1.02]} />
            <meshStandardMaterial color={COLORS.capEnd} roughness={0.35} metalness={0.75} />
          </mesh>
        ))}
      </group>
    );
  }
  if (part.kind === 'sot23-5') {
    return (
      <group>
        <mesh position={[0, 0.15 + h / 2, 0]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={COLORS.bodyBlack} roughness={0.5} />
        </mesh>
        {/* pin-1 dot */}
        <mesh position={[-w / 2 + 0.45, 0.15 + h + 0.005, d / 2 - 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.16, 16]} />
          <meshBasicMaterial color="#8a8d93" toneMapped={false} />
        </mesh>
        {fp.pads.map((p, i) => (
          <group key={i}>
            {/* gull-wing leg: vertical stub + foot */}
            <mesh position={[p.x, 0.35, -p.y * 0.78]} castShadow>
              <boxGeometry args={[0.42, 0.55, 0.32]} />
              <meshStandardMaterial color={COLORS.capEnd} roughness={0.35} metalness={0.75} />
            </mesh>
            <mesh position={[p.x, 0.08, -p.y * 1.0]}>
              <boxGeometry args={[0.42, 0.16, 0.7]} />
              <meshStandardMaterial color={COLORS.capEnd} roughness={0.35} metalness={0.75} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  // header2
  return (
    <group>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={COLORS.bodyBlack} roughness={0.7} />
      </mesh>
      {fp.pads.map((p, i) => (
        <mesh key={i} position={[p.x, 2.4, -p.y]} castShadow>
          <boxGeometry args={[0.64, 7.6, 0.64]} />
          <meshStandardMaterial color={COLORS.headerPin} roughness={0.3} metalness={0.75} />
        </mesh>
      ))}
    </group>
  );
};
