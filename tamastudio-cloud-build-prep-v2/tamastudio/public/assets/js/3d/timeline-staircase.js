export default function stairs({ THREE, scene, camera, el, pointer, spin }) {
  const GOLD = 0xd4af37, n = 5, steps = [];
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  camera.position.y = 1.2;
  camera.lookAt(0, 0.1, 0);

  const g = new THREE.Group();
  scene.add(g);
  const top = (i) => i * 0.55 - 0.6;
  for (let i = 0; i < n; i++) {
    const h = 0.6 + i * 0.55;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1, h, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.4, roughness: 0.4, emissive: GOLD, emissiveIntensity: 0.04 })
    );
    m.position.set((i - 2) * 1.1, top(i) - h / 2, 0);
    g.add(m);
    steps.push(m);
  }
  const orb = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 24, 24),
    new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.2, emissive: GOLD, emissiveIntensity: 0.5 })
  );
  g.add(orb);

  const ray = new THREE.Raycaster();
  return {
    frame() {
      const r = el.getBoundingClientRect();
      const p = THREE.MathUtils.clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
      const f = p * (n - 1), i = Math.min(n - 2, Math.floor(f)), k = f - i;
      orb.position.set(
        THREE.MathUtils.lerp(steps[i].position.x, steps[i + 1].position.x, k),
        THREE.MathUtils.lerp(top(i), top(i + 1), k) + 0.3 + Math.sin(k * Math.PI) * 0.35,
        0
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(steps, false)[0];
      steps.forEach((m) => {
        const e = m.material.emissiveIntensity;
        m.material.emissiveIntensity = e + ((hit && hit.object === m ? 0.7 : 0.04) - e) * 0.15;
      });
      g.rotation.y += (-0.45 + spin.y * 0.6 + pointer.x * 0.15 - g.rotation.y) * 0.08;
      g.rotation.x += (spin.x * 0.3 - g.rotation.x) * 0.08;
    },
  };
}
