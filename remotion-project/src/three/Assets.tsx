import {createContext, useContext, useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';
import {useThree} from '@react-three/fiber';
import {useMemo} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/examples/jsm/loaders/RGBELoader.js';

export interface Assets {
  models: Record<string, THREE.Group>;
  tex: Record<string, THREE.Texture>;
  /** equirectangular HDR; turn into a PMREM env map inside the canvas with useEnvMap() */
  hdr: THREE.DataTexture;
}

const Ctx = createContext<Assets | null>(null);
export const useAssets = (): Assets => {
  const a = useContext(Ctx);
  if (!a) throw new Error('useAssets outside <AssetsProvider>');
  return a;
};

const MODEL_FILES: Record<string, string> = {
  'sot23-5': 'models/sot23-5.glb',
  cap0603: 'models/cap0603.glb',
  header2: 'models/header2.glb',
};

const TEX_FILES: Record<string, string> = {
  maskAlbedo: 'textures/soldermask_albedo.png',
  maskRough: 'textures/soldermask_rough.png',
  fr4Normal: 'textures/fr4_normal.png',
  goldRough: 'textures/gold_rough.png',
  noise: 'textures/noise.png',
  pasteNormal: 'textures/paste_normal.png',
  woodAlbedo: 'textures/wood_albedo.png',
  woodRough: 'textures/wood_rough.png',
  smoke: 'textures/smoke.png',
};

/**
 * Loads every model / texture / HDRI once and blocks the frame until they are ready.
 * Lives OUTSIDE <ThreeCanvas/> so the scene mounts synchronously with everything in hand:
 * @remotion/three renders exactly one frame per Remotion frame, so nothing may arrive late.
 */
export const AssetsProvider: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [assets, setAssets] = useState<Assets | null>(null);
  useEffect(() => {
    let cancelled = false;
    const handle = delayRender('Loading 3D assets', {timeoutInMilliseconds: 180000});
    (async () => {
      const gltf = new GLTFLoader();
      const tl = new THREE.TextureLoader();
      const rgbe = new RGBELoader();
      const models = Object.fromEntries(
        await Promise.all(Object.entries(MODEL_FILES).map(async ([k, f]) => [k, (await gltf.loadAsync(staticFile(f))).scene] as const)),
      );
      const tex = Object.fromEntries(
        await Promise.all(
          Object.entries(TEX_FILES).map(async ([k, f]) => {
            const t = await tl.loadAsync(staticFile(f));
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.anisotropy = 8;
            if (k.includes('Albedo') || k === 'smoke') t.colorSpace = THREE.SRGBColorSpace;
            return [k, t] as const;
          }),
        ),
      );
      const hdr = await rgbe.loadAsync(staticFile('hdr/studio_small_09_1k.hdr'));
      if (!cancelled) setAssets({models, tex, hdr});
      continueRender(handle);
    })().catch((e) => {
      console.error('asset load failed', e);
      continueRender(handle);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!assets) return null;
  return <Ctx.Provider value={assets}>{children}</Ctx.Provider>;
};

/** PMREM environment map built synchronously from the loaded HDR (call inside the canvas). */
export const useEnvMap = () => {
  const {hdr} = useAssets();
  const gl = useThree((s) => s.gl);
  return useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(hdr).texture;
    pmrem.dispose();
    return env;
  }, [gl, hdr]);
};
