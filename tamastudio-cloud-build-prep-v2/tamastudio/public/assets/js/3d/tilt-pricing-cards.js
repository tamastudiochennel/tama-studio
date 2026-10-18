import { label } from './util.js';

export default function cards({ THREE, scene, camera, pointer, reduce, data }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils, v = new THREE.Vector3();
  const items = data.map((p, i) => {
    const grp = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.8), new THREE.MeshBasicMaterial({ map: label(THREE, p.name, 360, 500, p.price, 50), transparent: true }));
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.42, 1.92), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0 }));
    glow.position.z = -0.02;
    grp.add(glow, front);
    grp.position.x = (i - (data.length - 1) / 2) * 1.55;
    scene.add(grp);
    return { grp, glow, i };
  });
  return {
    frame(t) {
      items.forEach(({ grp, glow, i }) => {
        v.copy(grp.position).project(camera);
        const dx = pointer.x - v.x, dy = pointer.y - v.y, near = Math.max(0, 1 - Math.hypot(dx, dy) * 1.5);
        grp.rotation.y += (V.clamp(dx, -1, 1) * 0.6 * near - grp.rotation.y) * 0.1;
        grp.rotation.x += (-V.clamp(dy, -1, 1) * 0.5 * near - grp.rotation.x) * 0.1;
        grp.position.z += (near * 0.5 - grp.position.z) * 0.1;
        grp.position.y = reduce ? 0 : Math.sin(t * 0.9 + i) * 0.06;
        glow.material.opacity = near * 0.55;
      });
    },
  };
}
