import { label } from './util.js';

export default function road({ THREE, scene, camera, pointer, spin, reduce, data }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils;
  camera.position.set(0, 4.5, 8);
  camera.lookAt(0, 0, 0);
  const g = new THREE.Group();
  scene.add(g);
  const curve = new THREE.CatmullRomCurve3([[-5, 0, 1.5], [-3, 0, -1.5], [-1, 0, 1.2], [1.2, 0, -1.6], [3, 0, 1], [5, 0, -1]].map((p) => new THREE.Vector3(...p)));
  const tube = (c) => new THREE.Mesh(new THREE.TubeGeometry(curve, 200, 0.16, 8, false), new THREE.MeshBasicMaterial({ color: c }));
  g.add(tube(0x2a2a2a));
  const done = tube(GOLD);
  g.add(done);
  const total = done.geometry.index.count;
  ['Pending', 'Design', 'Development', 'Testing', 'Revision', 'Completed'].forEach((n, i) => {
    const p = curve.getPointAt(i / 5);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), new THREE.MeshBasicMaterial({ color: GOLD }));
    dot.position.copy(p);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(THREE, n, 256, 80, '', 30), transparent: true, depthTest: false }));
    tag.scale.set(1.3, 0.4, 1);
    tag.position.set(p.x, 0.65, p.z);
    g.add(dot, tag);
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 24), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3 })));
  g.add(orb);
  let t = 0;
  return {
    frame(time) {
      t += (data.progress / 100 - t) * 0.04;
      const k = V.clamp(t, 0, 1);
      done.geometry.setDrawRange(0, Math.floor((total * Math.max(k, 0.002)) / 6) * 6);
      const p = curve.getPointAt(k);
      orb.position.set(p.x, 0.3 + (reduce ? 0 : Math.sin(time * 3) * 0.05), p.z);
      g.rotation.y = spin.y * 0.8 + pointer.x * 0.2 - 0.1;
      g.rotation.x = V.clamp(spin.x * 0.4, -0.3, 0.3) - pointer.y * 0.05;
    },
  };
}
