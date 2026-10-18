export default function vault({ THREE, scene, pointer, spin, reduce, data }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils;
  scene.add(new THREE.AmbientLight(0xffffff, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const g = new THREE.Group();
  scene.add(g);
  const mat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3, emissive: GOLD, emissiveIntensity: 0 });
  const outer = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.12, 20, 80), mat);
  const mid = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 16, 64), mat);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.3), mat);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 12, 32, Math.PI), mat);
  shackle.position.y = 0.28;
  g.add(outer, mid, body, shackle);
  let e = 0;
  return {
    frame(t) {
      e += (data.step / 2 - e) * 0.05;
      mat.emissiveIntensity = 0.1 + e * 0.9;
      outer.rotation.z = reduce ? 0 : t * (0.2 + e * 0.6);
      mid.rotation.z = reduce ? 0 : -t * (0.3 + e * 0.8);
      shackle.position.y = 0.28 + e * 0.12;
      shackle.rotation.y = e * Math.PI;
      g.rotation.y = spin.y * 0.5 + pointer.x * 0.3;
      g.rotation.x = V.clamp(spin.x * 0.4, -0.4, 0.4) - pointer.y * 0.15;
    },
  };
}
