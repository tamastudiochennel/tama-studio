import { label } from './util.js';

export default function crystal({ THREE, scene, pointer, spin, reduce }) {
  const GOLD = 0xd4af37;
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const solid = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, metalness: 0.9, roughness: 0.2, flatShading: true }));
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.34, 0)), new THREE.LineBasicMaterial({ color: GOLD }));
  const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(THREE, '?', 160, 160, '', 120), transparent: true, depthTest: false }));
  const g = new THREE.Group();
  g.add(solid, wire, q);
  scene.add(g);
  return {
    frame(t) {
      g.rotation.y = spin.y + (reduce ? 0 : t * 0.3) + pointer.x * 0.5;
      g.rotation.x = spin.x - pointer.y * 0.3;
      q.position.y = reduce ? 0 : Math.sin(t * 2) * 0.1;
    },
  };
}
