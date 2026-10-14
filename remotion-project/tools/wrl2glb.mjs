// Convert KiCad StepUp .wrl (VRML 2.0, units 0.1 inch, z-up) to .glb (mm, y-up).
// Material names are kept so the scene can swap in PBR materials by class.
import {readFileSync, writeFileSync} from 'node:fs';
import * as THREE from 'three';
import {VRMLLoader} from 'three/examples/jsm/loaders/VRMLLoader.js';
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';

// Node has Blob but no FileReader; GLTFExporter only needs readAsArrayBuffer / readAsDataURL.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({target: this});
        this.onload?.({target: this});
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buf).toString('base64')}`;
        this.onloadend?.({target: this});
        this.onload?.({target: this});
      });
    }
  };
}

const [src, dst] = process.argv.slice(2);
const text = readFileSync(src, 'utf8');
const loader = new VRMLLoader();
const scene = loader.parse(text, '');
const root = new THREE.Group();
root.name = 'kicad';
// 0.1 inch -> mm, z-up -> y-up
root.scale.setScalar(2.54);
root.rotation.x = -Math.PI / 2;
root.add(scene);
root.updateMatrixWorld(true);
let meshes = 0;
scene.traverse((o) => {
  if (o.isMesh) {
    meshes++;
    const m = o.material;
    const c = m.color ? m.color.getHexString() : '?';
    // encode the diffuse colour into the mesh name so the runtime can classify it
    o.name = `${o.name || 'mesh'}|${c}`;
    o.geometry.computeVertexNormals();
  }
});
const exporter = new GLTFExporter();
exporter.parse(
  root,
  (res) => {
    writeFileSync(dst, Buffer.from(res));
    const box = new THREE.Box3().setFromObject(root);
    console.log(`${dst}: ${meshes} meshes, bbox min ${box.min.toArray().map((v) => v.toFixed(2))} max ${box.max.toArray().map((v) => v.toFixed(2))}`);
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
  {binary: true},
);
