import {useThree} from '@react-three/fiber';
import {useEffect} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Neutral studio environment so metals (pads, tweezers, pins) pick up reflections. */
export const Env: React.FC<{intensity?: number}> = ({intensity = 0.55}) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
};
