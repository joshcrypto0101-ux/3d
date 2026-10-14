import {Bloom, ChromaticAberration, DepthOfField, EffectComposer, EffectComposerContext, Noise, ToneMapping, Vignette} from '@react-three/postprocessing';
import {BlendFunction, ToneMappingMode} from 'postprocessing';
import {useThree} from '@react-three/fiber';
import {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import * as THREE from 'three';

/**
 * @remotion/three renders exactly one frame per Remotion frame, in a useEffect.
 * EffectComposer builds its composer and passes in later effects, so that first
 * render happens with no passes and nothing reaches the screen. Whenever the
 * pass list changes, render the frame again.
 */
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object) => {
  let v = ids.get(o);
  if (!v) {
    v = nextId++;
    ids.set(o, v);
  }
  return v;
};

const ComposerKick: React.FC = () => {
  const ctx = useContext(EffectComposerContext);
  const advance = useThree((st) => st.advance);
  const seen = useRef('');
  // Hold the frame until the composer has its effect passes and we have rendered with them.
  const [hold] = useState(() => delayRender('Waiting for post-processing passes', {timeoutInMilliseconds: 60000}));
  const released = useRef(false);
  useEffect(() => {
    const passes = (ctx?.composer?.passes ?? []) as Array<{effects?: object[]}>;
    const sig = passes.map((p) => `${idOf(p)}:${(p.effects ?? []).map(idOf).join('.')}`).join('|');
    if (sig !== seen.current) {
      seen.current = sig;
      advance(performance.now());
      if (passes.length >= 2 && !released.current) {
        released.current = true;
        continueRender(hold);
      }
    }
  });
  useEffect(() => () => {
    if (!released.current) continueRender(hold);
  }, [hold]);
  return null;
};

/**
 * Macro-lens look: shallow depth of field on the working point, gentle bloom on
 * solder highlights, a touch of chromatic aberration, film grain and ACES.
 * REMOTION_POST=off|min|nodof|full (default full) for debugging on software GL.
 */
export const Post: React.FC<{focus: [number, number, number]; bokeh?: number; focusRange?: number}> = ({focus, bokeh = 2.2, focusRange = 3}) => {
  const mode = process.env.REMOTION_POST ?? 'full';
  // keep one Vector3 instance; a new object each frame would be fine for applyProps but is wasteful
  const target = useMemo(() => new THREE.Vector3(), []);
  target.set(focus[0], focus[1], focus[2]);
  void focusRange; // intentionally NOT passed through: changing worldFocusRange rebuilds the effect mid-video
  if (mode === 'off') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.UnsignedByteType}>
      {mode === 'min' ? (
        <>
          <Vignette eskil={false} offset={0.22} darkness={0.5} />
        </>
      ) : mode === 'dofonly' ? (
        <>
          <DepthOfField target={target} worldFocusRange={3} focalLength={0.08} bokehScale={bokeh} resolutionScale={0.6} />
        </>
      ) : mode === 'bloomonly' ? (
        <>
          <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.25} intensity={0.45} mipmapBlur />
        </>
      ) : (
        <>
          {mode === 'nodof' ? null : <DepthOfField target={target} worldFocusRange={3} focalLength={0.08} bokehScale={bokeh} resolutionScale={0.6} />}
          <Bloom luminanceThreshold={0.82} luminanceSmoothing={0.25} intensity={0.45} mipmapBlur />
          <ChromaticAberration offset={new THREE.Vector2(0.0007, 0.0004)} radialModulation modulationOffset={0.35} />
          <Noise opacity={0.05} blendFunction={BlendFunction.SOFT_LIGHT} />
          <Vignette eskil={false} offset={0.22} darkness={0.5} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </>
      )}
      <ComposerKick />
    </EffectComposer>
  );
};
