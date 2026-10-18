export default function field({ THREE, scene, lite, reduce }) {
  const n = lite ? 160 : 420, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xd4af37, size: 0.05, transparent: true, opacity: 0.55 }));
  const grid = new THREE.GridHelper(30, 30, 0xd4af37, 0x222222);
  grid.position.y = -5;
  grid.material.transparent = true;
  grid.material.opacity = 0.25;
  scene.add(pts, grid);
  return {
    frame(t) {
      const s = window.scrollY * 0.0008, tt = reduce ? 0 : t;
      pts.rotation.y = tt * 0.02 + s;
      pts.rotation.x = s * 0.5;
      grid.position.z = (tt * 0.4) % 1;
    },
  };
}
