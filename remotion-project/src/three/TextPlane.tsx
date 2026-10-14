import {useMemo} from 'react';
import * as THREE from 'three';

/**
 * Text drawn into a canvas texture on a plane. Used for silkscreen and floating labels.
 * Deterministic: the same props always produce the same bitmap.
 */
export const TextPlane: React.FC<{
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  /** Height of the text in world units (mm). */
  size?: number;
  color?: string;
  font?: string;
  opacity?: number;
  bg?: string;
  padding?: number;
}> = ({text, position, rotation = [-Math.PI / 2, 0, 0], size = 1, color = '#f3f1ec', font = '700 64px "JetBrains Mono", "Noto Sans SC"', opacity = 1, bg, padding = 0.25}) => {
  const {texture, aspect} = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = font;
    const metrics = ctx.measureText(text);
    const fontPx = parseInt(font.match(/(\d+)px/)?.[1] ?? '64', 10);
    const padPx = fontPx * padding;
    const w = Math.ceil(metrics.width + padPx * 2);
    const h = Math.ceil(fontPx * 1.3 + padPx * 2);
    canvas.width = w;
    canvas.height = h;
    if (bg) {
      ctx.fillStyle = bg;
      const r = fontPx * 0.2;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, r);
      ctx.fill();
    }
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2 + fontPx * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return {texture: tex, aspect: w / h};
  }, [text, color, font, bg, padding]);
  const height = size * 1.3 + size * padding * 2;
  return (
    <mesh position={position} rotation={rotation} renderOrder={5}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
};
