import { label } from './util.js';

export default function planets({ THREE, scene, camera, pointer, spin, reduce, data }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils;
  camera.position.y = 3;
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.4));
  const g = new THREE.Group();
  scene.add(g);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), new THREE.MeshBasicMaterial({ color: GOLD })));
  const ps = data.map((s, i) => {
    const r = 1.7 + i * 0.75;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.01, r + 0.01, 96), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.25, side: THREE.DoubleSide }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3, emissive: GOLD, emissiveIntensity: 0.15 }));
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(THREE, s.name, 320, 96), transparent: true, depthTest: false }));
    tag.scale.set(1.5, 0.45, 1);
    tag.position.y = 0.65;
    m.add(tag);
    g.add(m);
    return { m, r, a: i * 1.7, k: 0.6 / (1 + i * 0.45) };
  });
  const ray = new THREE.Raycaster();
  return {
    frame(t, dt) {
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(ps.map((p) => p.m), false)[0];
      g.rotation.y = spin.y;
      g.rotation.x = 0.3 + spin.x * 0.5 - pointer.y * 0.05;
      ps.forEach((p) => {
        const on = hit && hit.object === p.m;
        if (!reduce) p.a += dt * p.k * (on ? 0.1 : 1);
        p.m.position.set(Math.cos(p.a) * p.r, 0, Math.sin(p.a) * p.r);
        p.m.scale.setScalar(V.lerp(p.m.scale.x, on ? 1.4 : 1, 0.15));
        p.m.material.emissiveIntensity = V.lerp(p.m.material.emissiveIntensity, on ? 0.9 : 0.15, 0.15);
      });
    },
  };
}
