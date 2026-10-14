import {useThree} from '@react-three/fiber';
import {useMemo} from 'react';
import {useCurrentFrame} from 'remotion';
import * as THREE from 'three';

export interface CamKey {
  frame: number;
  pos: [number, number, number];
  target: [number, number, number];
}

/**
 * Smooth "一镜到底" camera: positions and targets are Catmull-Rom splines through
 * the keyframes, parameterised by frame so the camera never stops dead.
 */
const buildCurve = (keys: CamKey[], pick: (k: CamKey) => [number, number, number]) => {
  const pts = keys.map((k, i) => {
    const v = new THREE.Vector3(...pick(k));
    // Nudge exact duplicates so the spline never has a zero-length segment.
    return v.add(new THREE.Vector3(i * 1e-4, 0, 0));
  });
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
};

const frameToU = (keys: CamKey[], frame: number) => {
  if (frame <= keys[0].frame) return 0;
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return 1;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.frame && frame < b.frame) {
      const t = (frame - a.frame) / (b.frame - a.frame);
      return (i + t) / (keys.length - 1);
    }
  }
  return 1;
};

export const useCameraPath = (keys: CamKey[]) => {
  const posCurve = useMemo(() => buildCurve(keys, (k) => k.pos), [keys]);
  const tgtCurve = useMemo(() => buildCurve(keys, (k) => k.target), [keys]);
  return (frame: number) => {
    const u = frameToU(keys, frame);
    return {pos: posCurve.getPoint(u), target: tgtCurve.getPoint(u)};
  };
};

const shake = (f: number, k: number) => Math.sin(f * 0.21 * k + 1.3) * 0.5 + Math.sin(f * 0.077 * k + 0.4) * 0.35 + Math.sin(f * 0.013 * k) * 0.15;

export const useCameraFocus = (keys: CamKey[], frame: number) => {
  const path = useCameraPath(keys);
  return path(frame).target;
};

export const CameraRig: React.FC<{keys: CamKey[]; fov?: number; handheld?: number}> = ({keys, fov = 32, handheld = 0.06}) => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const path = useCameraPath(keys);
  const {pos, target} = path(frame);
  // tiny handheld drift so the shot never feels locked off
  pos.x += shake(frame, 1.0) * handheld;
  pos.y += shake(frame, 1.37) * handheld * 0.6;
  pos.z += shake(frame, 0.83) * handheld;
  target.x += shake(frame, 1.11) * handheld * 0.5;
  target.z += shake(frame, 0.91) * handheld * 0.5;
  camera.position.copy(pos);
  camera.lookAt(target);
  if (camera.fov !== fov) {
    camera.fov = fov;
  }
  camera.near = 2;
  camera.far = 300;
  camera.updateProjectionMatrix();
  return null;
};
