export default function hero({ THREE, scene, camera, lite, reduce, pointer, spin }) {
  const GOLD = 0xd4af37;
  camera.position.set(7, 6, 7);
  camera.lookAt(0, 1.2, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(4, 8, 5);
  scene.add(sun);

  const g = new THREE.Group();
  scene.add(g);
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.35 }, o));
  const box = (w, h, d, x, y, z, m) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b);
    return b;
  };
  const dark = mat(0x1d1d1d), steel = mat(0x2c2c2c), ink = mat(0x0c0c0c);

  g.add(new THREE.GridHelper(14, 28, GOLD, 0x3a3a3a));
  box(4.2, 0.16, 2.2, 0, 0.9, 0, dark);
  [[-1.9, -0.9], [1.9, -0.9], [-1.9, 0.9], [1.9, 0.9]].forEach(([x, z]) => box(0.14, 0.9, 0.14, x, 0.45, z, steel));
  box(1.9, 1.15, 0.08, 0, 1.95, -0.55, steel);
  box(0.14, 0.5, 0.14, 0, 1.3, -0.55, steel);
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, emissive: GOLD, emissiveIntensity: 0.35 });
  const screen = box(1.74, 0.98, 0.02, 0, 1.95, -0.5, screenMat);
  [1.1, 0.8, 1.3, 0.6, 1.0].forEach((w, i) => box(w, 0.05, 0.01, -0.8 + w / 2, 2.3 - i * 0.17, -0.485, ink));
  box(1.1, 0.06, 0.75, 1.3, 1.0, 0.45, steel);
  box(1.1, 0.72, 0.05, 1.3, 1.38, 0.1, steel).rotation.x = -0.2;

  const gm = mat(GOLD, { metalness: 0.85, roughness: 0.25 });
  const cubes = [];
  for (let i = 0; i < (lite ? 5 : 9); i++) {
    const c = box(0.26, 0.26, 0.26, 0, 0, 0, gm);
    c.userData = { a: i * 0.7, r: 2.6 + (i % 3) * 0.5, y: 2.8 + (i % 4) * 0.45 };
    cubes.push(c);
  }

  const n = lite ? 220 : 520, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 5 + Math.random() * 5, t = Math.random() * 6.283, p = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(p) * Math.cos(t), Math.abs(r * Math.cos(p)) * 0.8, r * Math.sin(p) * Math.sin(t)], i * 3);
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(pg, new THREE.PointsMaterial({ color: GOLD, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.75 }));
  scene.add(stars);

  const ray = new THREE.Raycaster();
  let glow = 0.35;
  return {
    frame(t) {
      const tt = reduce ? 0 : t;
      ray.setFromCamera(pointer, camera);
      glow += ((ray.intersectObject(screen, false).length ? 1.3 : 0.35) - glow) * 0.1;
      screenMat.emissiveIntensity = glow;
      g.rotation.y += (spin.y + pointer.x * 0.25 + Math.sin(tt * 0.4) * 0.12 - g.rotation.y) * 0.08;
      g.rotation.x += (spin.x * 0.5 - pointer.y * 0.06 - g.rotation.x) * 0.08;
      stars.rotation.y = tt * 0.02;
      cubes.forEach((c) => {
        const u = c.userData, a = u.a + tt * 0.5;
        c.position.set(Math.cos(a) * u.r, u.y + Math.sin(tt + u.a) * 0.15, Math.sin(a) * u.r);
        c.rotation.x = c.rotation.y = a;
      });
    },
  };
}
