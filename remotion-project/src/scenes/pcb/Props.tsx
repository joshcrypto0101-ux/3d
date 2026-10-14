import {useMemo} from 'react';
import * as THREE from 'three';
import {useAssets} from '../../three/Assets';
import {materialForKicadHex, useMaterials} from '../../three/Materials';

/** Wooden bench, a solder spool, a few loose parts and a blank board in the background. */
export const Bench: React.FC<{boardT: number}> = ({boardT}) => {
  const m = useMaterials();
  const {models} = useAssets();
  const loose = useMemo(() => {
    const src = models.cap0603;
    return [0, 1, 2, 3, 4].map((i) => {
      const c = src.clone(true);
      c.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const mesh = o as THREE.Mesh;
          mesh.material = materialForKicadHex(mesh.name.split('|').pop() ?? '000000', m);
          mesh.castShadow = true;
        }
      });
      return c;
    });
  }, [models, m]);
  const y = -boardT;
  return (
    <group>
      <mesh position={[0, y - 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={m.wood}>
        <planeGeometry args={[420, 420]} />
      </mesh>
      {/* anti-static mat under the board */}
      <mesh position={[0, y + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[70, 50]} />
        <meshStandardMaterial color="#2c4a3f" roughness={0.95} />
      </mesh>
      {/* solder wire spool */}
      <group position={[-30, y, -18]} rotation={[Math.PI / 2, 0, 0.4]}>
        <mesh material={m.steel} castShadow>
          <torusGeometry args={[6.5, 2.4, 14, 40]} />
        </mesh>
        <mesh castShadow>
          <cylinderGeometry args={[8.5, 8.5, 1.2, 40]} />
          <meshStandardMaterial color="#2a2c31" roughness={0.6} />
        </mesh>
      </group>
      {/* loose 0603 parts */}
      {loose.map((o, i) => (
        <primitive key={i} object={o} position={[-16 + i * 3.1, y, 14 + Math.sin(i * 2.3) * 2]} rotation={[0, i * 1.1, 0]} />
      ))}
      {/* a second blank board further back */}
      <mesh position={[26, y + 0.8, -22]} rotation={[0, -0.5, 0]} castShadow receiveShadow material={m.maskEdge}>
        <boxGeometry args={[24, 1.6, 16]} />
      </mesh>
      <mesh position={[26, y + 1.61, -22]} rotation={[-Math.PI / 2, 0, -0.5]} receiveShadow material={m.mask}>
        <planeGeometry args={[23.6, 15.6]} />
      </mesh>
    </group>
  );
};
