import {useThree} from '@react-three/fiber';
import {useEnvMap} from './Assets';

/** HDRI image-based lighting + one warm key light for crisp shadows + a bench lamp. */
export const Lights: React.FC<{warm?: number}> = ({warm = 0}) => {
  const env = useEnvMap();
  const scene = useThree((s) => s.scene);
  // assigned during render so the very first advance() already sees it
  scene.environment = env;
  scene.environmentIntensity = 0.75;
  return (
    <>
      <directionalLight
        position={[14, 30, 10]}
        intensity={1.9}
        color="#fff1dc"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={5}
        shadow-camera-far={90}
        shadow-bias={-0.00025}
        shadow-normalBias={0.02}
        shadow-radius={4}
      />
      <spotLight position={[-24, 26, 18]} angle={0.55} penumbra={0.8} intensity={320} color="#ffe4bf" distance={90} decay={2} />
      {warm > 0 ? <pointLight position={[0, 5, 0]} intensity={warm * 60} color="#ff8a3c" distance={24} decay={2} /> : null}
    </>
  );
};
