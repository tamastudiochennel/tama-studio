export default function tech({ THREE, scene, camera, el, lite, reduce, pointer, spin }) {
  const GOLD = 0xd4af37, R = 2.6;
  const names = ['HTML', 'CSS', 'JavaScript', 'Firebase', 'Three.js', 'Android', 'UI/UX', 'Netlify'];
  camera.position.y = 0.9;
  camera.lookAt(0, 0, 0);
  const g = new THREE.Group();
  scene.add(g);

  const label = (s) => {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 112;
    const x = c.getContext('2d');
    x.fillStyle = 'rgba(14,14,14,0.94)';
    x.strokeStyle = '#D4AF37';
    x.lineWidth = 3;
    x.beginPath();
    if (x.roundRect) x.roundRect(4, 4, 312, 104, 22); else x.rect(4, 4, 312, 104);
    x.fill();
    x.stroke();
    x.fillStyle = '#ffffff';
    x.font = '700 40px "Plus Jakarta Sans", system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(s, 160, 58);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const planes = names.map((s, i) => {
    const a = (i / names.length) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.6), new THREE.MeshBasicMaterial({ map: label(s), transparent: true }));
    p.position.set(Math.sin(a) * R, i % 2 ? 0.55 : -0.55, Math.cos(a) * R);
    p.rotation.y = a;
    g.add(p);
    return p;
  });
  g.add(new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 2.4, lite ? 16 : 32, 4, true)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.22 })
  ));
  [-1.2, 1.2].forEach((y) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.025, 8, 64), new THREE.MeshBasicMaterial({ color: GOLD }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  });

  const ray = new THREE.Raycaster();
  return {
    frame(t) {
      const r = el.getBoundingClientRect();
      const p = THREE.MathUtils.clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
      g.rotation.y = spin.y + p * 4 + (reduce ? 0 : t * 0.15);
      g.rotation.x = spin.x * 0.4;
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObjects(planes, false)[0];
      planes.forEach((m) => m.scale.setScalar(THREE.MathUtils.lerp(m.scale.x, hit && hit.object === m ? 1.18 : 1, 0.15)));
    },
  };
}
