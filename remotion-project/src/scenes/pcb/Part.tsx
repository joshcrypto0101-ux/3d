import {useMemo} from 'react';
import * as THREE from 'three';
import type {PartData} from '../../lib/types';
import {useAssets} from '../../three/Assets';
import {materialForKicadHex, useMaterials} from '../../three/Materials';

/**
 * Real KiCad component model (converted from the official VRML library),
 * re-skinned with our PBR materials. Origin at the footprint centre, resting on y=0.
 */
export const PartBody: React.FC<{part: PartData}> = ({part}) => {
  const {models} = useAssets();
  const m = useMaterials();
  const obj = useMemo(() => {
    const src = models[part.kind];
    const clone = src.clone(true);
    clone.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        const hex = mesh.name.split('|').pop() ?? '000000';
        mesh.material = materialForKicadHex(hex, m);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [models, m, part.kind]);

  // KiCad 1x02 header model: pins along +z at z = 0 and 2.54; our footprint has them along x at ±1.27.
  if (part.kind === 'header2') {
    return (
      <group position={[-1.27, 0, 0]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <primitive object={obj} />
        </group>
      </group>
    );
  }
  return <primitive object={obj} />;
};
