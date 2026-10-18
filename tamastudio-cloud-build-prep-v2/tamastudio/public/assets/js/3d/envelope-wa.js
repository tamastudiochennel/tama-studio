export default function envelope({ THREE, scene, pointer, spin }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils;
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.position.set(2, 3, 4);
  scene.add(sun);
  const g = new THREE.Group();
  scene.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 0.12), new THREE.MeshStandardMaterial({ color: 0x1d1d1d, metalness: 0.5, roughness: 0.4 }));
  const tri = new THREE.Shape();
  tri.moveTo(-1.2, 0);
  tri.lineTo(1.2, 0);
  tri.lineTo(0, -0.9);
  tri.closePath();
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(tri), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
  const pivot = new THREE.Group();
  pivot.position.set(0, 0.8, 0.08);
  pivot.add(flap);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  note.position.z = 0.07;
  g.add(body, note, pivot);
  let open = 0;
  return {
    frame() {
      const hov = Math.abs(pointer.x) < 0.7 && Math.abs(pointer.y) < 0.7;
      open += ((hov ? 1 : 0) - open) * 0.08;
      pivot.rotation.x = -open * Math.PI * 0.95;
      note.position.y = open * 0.5;
      g.rotation.y = spin.y * 0.6 + pointer.x * 0.25;
      g.rotation.x = V.clamp(spin.x * 0.4, -0.4, 0.4) - pointer.y * 0.15;
    },
  };
}
