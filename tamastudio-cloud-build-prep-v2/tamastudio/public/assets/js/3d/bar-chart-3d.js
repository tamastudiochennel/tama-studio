import { label } from './util.js';

export default function bars({ THREE, scene, camera, el, pointer, spin, data }) {
  const GOLD = 0xd4af37, V = THREE.MathUtils, days = data.days;
  camera.position.y = 3.2;
  camera.lookAt(0, 1.4, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(3, 6, 5);
  scene.add(sun);
  scene.add(new THREE.GridHelper(12, 12, GOLD, 0x333333));
  const g = new THREE.Group();
  scene.add(g);
  const max = Math.max(1, ...days.map((d) => d.value)), n = Math.max(days.length, 1);
  const cap = el.parentElement.querySelector('#cap');
  const bs = days.map((d, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1, 0.55), new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.7, roughness: 0.3, emissive: GOLD, emissiveIntensity: 0.1 }));
    m.position.x = (i - (n - 1) / 2) * 0.8;
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(THREE, d.label, 128, 56, '', 26), transparent: true, depthTest: false }));
    tag.scale.set(0.7, 0.3, 1);
    tag.position.set(m.position.x, 0.1, 0.8);
    g.add(m, tag);
    return { m, d, h: 0, to: (d.value / max) * 4 + 0.05 };
  });
  const ray = new THREE.Raycaster();
  return {
    frame() {
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(bs.map((b) => b.m), false)[0];
      bs.forEach((b) => {
        b.h += (b.to - b.h) * 0.06;
        b.m.scale.y = Math.max(b.h, 0.01);
        b.m.position.y = b.h / 2;
        b.m.material.emissiveIntensity = V.lerp(b.m.material.emissiveIntensity, hit && hit.object === b.m ? 0.8 : 0.1, 0.2);
      });
      const b = hit && bs.find((x) => x.m === hit.object);
      if (cap && b) cap.textContent = b.d.label + ': Rp' + Number(b.d.value).toLocaleString('id-ID');
      g.rotation.y = spin.y * 0.6 + pointer.x * 0.15 - 0.2;
      g.rotation.x = V.clamp(spin.x * 0.3, -0.3, 0.3);
    },
  };
}
