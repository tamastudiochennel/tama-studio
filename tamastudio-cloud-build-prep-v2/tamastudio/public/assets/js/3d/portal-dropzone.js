export default function portal({ THREE, scene, reduce, data }) {
  const GOLD = 0xd4af37;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.08, 16, 80), new THREE.MeshBasicMaterial({ color: GOLD }));
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.12 }));
  const n = 160, pos = new Float32Array(n * 3), ang = new Float32Array(n), rad = new Float32Array(n);
  for (let i = 0; i < n; i++) { ang[i] = Math.random() * 6.283; rad[i] = 0.2 + Math.random() * 1.2; }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 }));
  scene.add(ring, disc, pts);
  let glow = 0;
  return {
    frame(t, dt) {
      glow += (data.glow - glow) * 0.1;
      disc.material.opacity = 0.12 + glow * 0.35;
      ring.scale.setScalar(1 + glow * 0.08);
      ring.rotation.z = reduce ? 0 : t * 0.3;
      for (let i = 0; i < n; i++) {
        ang[i] += dt * (reduce ? 0 : 0.4 + glow * 2.2);
        rad[i] -= dt * glow * 0.6;
        if (rad[i] < 0.05) rad[i] = 1.4;
        pos[i * 3] = Math.cos(ang[i]) * rad[i];
        pos[i * 3 + 1] = Math.sin(ang[i]) * rad[i];
      }
      pg.attributes.position.needsUpdate = true;
    },
  };
}
