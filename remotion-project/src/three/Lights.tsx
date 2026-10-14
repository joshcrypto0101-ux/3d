export const Lights: React.FC<{warm?: number}> = ({warm = 0}) => {
  return (
    <>
      <hemisphereLight args={['#dfe8ff', '#4a3a2a', 0.9]} />
      <directionalLight
        position={[18, 32, 14]}
        intensity={2.2}
        color="#fff4e4"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-20, 14, -10]} intensity={0.6} color="#bcd0ff" />
      {warm > 0 ? <pointLight position={[0, 6, 0]} intensity={warm * 40} color="#ff9a3c" distance={30} /> : null}
    </>
  );
};
