export default function stars({ THREE, scene, pointer, spin, reduce }) {
  const GOLD = 0xd4af37;
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const sh = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.22 : 0.5, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.25, emissive: GOLD, emissiveIntensity: 0.15 });
  const g = new THREE.Group();
  scene.add(g);
  const ss = Array.from({ length: 5 }, (_, i) => { const m = new THREE.Mesh(geo, mat); g.add(m); return { m, a: (i / 5) * Math.PI * 2 }; });
  let sp = 0.4;
  return {
    frame(t, dt) {
      const near = Math.abs(pointer.x) < 0.6 && Math.abs(pointer.y) < 0.6;
      sp += ((near ? 1.2 : 0.4) - sp) * 0.05;
      ss.forEach((s) => {
        if (!reduce) s.a += dt * sp;
        s.m.position.set(Math.cos(s.a) * 2.2, Math.sin(s.a * 2) * 0.4, Math.sin(s.a) * 2.2);
        s.m.rotation.y = s.a + Math.PI / 2;
        s.m.rotation.z = s.a;
      });
      g.rotation.y = spin.y;
      g.rotation.x = 0.3 + spin.x - pointer.y * 0.1;
    },
  };
}
