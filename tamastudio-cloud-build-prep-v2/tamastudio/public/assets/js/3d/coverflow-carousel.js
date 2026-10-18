import { label } from './util.js';

export default function coverflow({ THREE, scene, camera, el, pointer, spin, data }) {
  const V = THREE.MathUtils, ray = new THREE.Raycaster();
  const cards = data.map((d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.3), new THREE.MeshBasicMaterial({ map: label(THREE, d.title, 512, 330, d.tag || '', 50), transparent: true }));
    scene.add(m);
    return m;
  });
  camera.position.y = 0.3;
  let pos = 0, x0 = 0;
  const onDown = (e) => { x0 = e.clientX; };
  const onClick = (e) => {
    if (Math.abs(e.clientX - x0) > 6) return;
    ray.setFromCamera(pointer, camera);
    const h = ray.intersectObjects(cards, false)[0];
    if (!h) return;
    const i = cards.indexOf(h.object);
    if (i === Math.round(pos)) {
      const u = data[i].url;
      if (/^https?:\/\//i.test(u || '')) window.open(u, '_blank', 'noopener');
    } else spin.y = -i / 1.5;
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('click', onClick);
  return {
    frame() {
      if (Math.abs(spin.vy) < 0.002) spin.y += (-Math.round(pos) / 1.5 - spin.y) * 0.08;
      pos = V.clamp(-spin.y * 1.5, 0, cards.length - 1);
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(cards, false)[0];
      cards.forEach((m, i) => {
        const d = i - pos, a = Math.abs(d), s = Math.sign(d);
        m.position.x = s * (Math.min(a, 1) * 1.7 + Math.max(0, a - 1) * 0.8);
        m.position.z = -Math.min(a, 3) * 0.7;
        m.position.y = V.lerp(m.position.y, hit && hit.object === m ? 0.15 : 0, 0.15);
        m.rotation.y = -s * Math.min(a, 1) * 0.85;
        m.scale.setScalar(1 - Math.min(a, 2) * 0.06);
      });
    },
    dispose() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('click', onClick);
    },
  };
}
