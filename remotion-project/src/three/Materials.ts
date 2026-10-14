import {useMemo} from 'react';
import * as THREE from 'three';
import {useAssets} from './Assets';

const rep = (t: THREE.Texture, x: number, y: number) => {
  const c = t.clone();
  c.repeat.set(x, y);
  c.needsUpdate = true;
  return c;
};

/** Shared PBR materials. One instance each; per-object variations clone them. */
export const useMaterials = () => {
  const {tex} = useAssets();
  return useMemo(() => {
    // board is 20 x 15 mm, texture tile = 10 mm
    const maskAlbedo = rep(tex.maskAlbedo, 2, 1.5);
    const maskRough = rep(tex.maskRough, 2, 1.5);
    const fr4Normal = rep(tex.fr4Normal, 2, 1.5);
    const goldRough = rep(tex.goldRough, 0.3, 0.3);
    const pasteNormal = rep(tex.pasteNormal, 0.6, 0.6);
    const woodAlbedo = rep(tex.woodAlbedo, 7, 7);
    const woodRough = rep(tex.woodRough, 7, 7);
    return {
      mask: new THREE.MeshPhysicalMaterial({
        map: maskAlbedo,
        roughnessMap: maskRough,
        roughness: 0.55,
        normalMap: fr4Normal,
        normalScale: new THREE.Vector2(0.12, 0.12),
        clearcoat: 0.35,
        clearcoatRoughness: 0.4,
        color: '#ffffff',
      }),
      maskEdge: new THREE.MeshStandardMaterial({color: '#4b6b3a', roughness: 0.9}),
      pad: new THREE.MeshStandardMaterial({color: '#e2bf6a', metalness: 1, roughness: 0.32, roughnessMap: goldRough}),
      silk: new THREE.MeshStandardMaterial({color: '#f6f3ea', roughness: 0.8}),
      paste: new THREE.MeshStandardMaterial({color: '#7f8187', metalness: 0.35, roughness: 0.95, normalMap: pasteNormal, normalScale: new THREE.Vector2(1.2, 1.2)}),
      solder: new THREE.MeshStandardMaterial({color: '#e8ebef', metalness: 1, roughness: 0.16}),
      plastic: new THREE.MeshPhysicalMaterial({color: '#1a1b1e', roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.5}),
      plasticLabel: new THREE.MeshStandardMaterial({color: '#2a2b2f', roughness: 0.6}),
      ceramic: new THREE.MeshPhysicalMaterial({color: '#9a6b47', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35}),
      pinSilver: new THREE.MeshStandardMaterial({color: '#d8dbe0', metalness: 1, roughness: 0.28}),
      pinGold: new THREE.MeshStandardMaterial({color: '#dcb86a', metalness: 1, roughness: 0.3, roughnessMap: goldRough}),
      steel: new THREE.MeshStandardMaterial({color: '#cfd3d9', metalness: 1, roughness: 0.3}),
      wood: new THREE.MeshStandardMaterial({map: woodAlbedo, roughnessMap: woodRough, roughness: 0.75}),
      flux: new THREE.MeshPhysicalMaterial({color: '#7a4f1d', transparent: true, opacity: 0.35, roughness: 0.15, clearcoat: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1}),
    };
  }, [tex]);
};

export type Materials = ReturnType<typeof useMaterials>;

/** Map a KiCad VRML diffuse colour (hex from the mesh name) onto one of our PBR materials. */
export const materialForKicadHex = (hex: string, m: Materials): THREE.Material => {
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const lum = 0.3 * r + 0.59 * g + 0.11 * b;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (lum > 0.72 && spread < 0.08) return m.pinSilver; // 0.82 0.82 0.78 -> tin
  if (lum > 0.6 && r > b + 0.2) return m.pinGold; // 0.86 0.74 0.50 -> gold
  if (lum > 0.5) return m.plasticLabel; // label areas
  if (spread > 0.1 && r > g && g > b) return m.ceramic; // 0.38 0.27 0.21 -> ceramic body
  return m.plastic;
};
