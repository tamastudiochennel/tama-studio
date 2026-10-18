export default function globe({ THREE, scene, lite, reduce, pointer, spin }) {
  const GOLD = 0xd4af37, R = 1.8;
  const g = new THREE.Group();
  scene.add(g);
  const ll = (lat, lon, r) => {
    const p = ((90 - lat) * Math.PI) / 180, q = ((lon + 180) * Math.PI) / 180;
    return new THREE.Vector3(-r * Math.sin(p) * Math.cos(q), r * Math.cos(p), r * Math.sin(p) * Math.sin(q));
  };
  g.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 32, 24), new THREE.MeshBasicMaterial({ color: 0x0b0b0b })));
  g.add(new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(R, lite ? 14 : 24, lite ? 10 : 16)),
    new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.2 })
  ));
  const cities = [[-6.2, 106.8], [1.35, 103.8], [35.7, 139.7], [51.5, -0.1], [40.7, -74], [-33.9, 151.2], [25.2, 55.3], [37.8, -122.4]];
  const dotGeo = new THREE.SphereGeometry(0.045, 12, 12), dotMat = new THREE.MeshBasicMaterial({ color: GOLD });
  cities.forEach(([a, b]) => {
    const d = new THREE.Mesh(dotGeo, dotMat);
    d.position.copy(ll(a, b, R));
    g.add(d);
  });
  const home = ll(cities[0][0], cities[0][1], R);
  const pulseGeo = new THREE.SphereGeometry(0.03, 8, 8), pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
  const arcs = cities.slice(1).map(([a, b], i) => {
    const end = ll(a, b, R);
    const mid = home.clone().add(end).multiplyScalar(0.5).setLength(R * 1.45);
    const pts = new THREE.QuadraticBezierCurve3(home, mid, end).getPoints(48);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    const pulse = new THREE.Mesh(pulseGeo, pulseMat);
    g.add(pulse);
    return { pts, pulse, o: i * 0.14 };
  });
  return {
    frame(t) {
      const tt = reduce ? 0 : t;
      g.rotation.y = spin.y + tt * 0.15 + pointer.x * 0.2 + window.scrollY * 0.002;
      g.rotation.x = 0.35 + spin.x - pointer.y * 0.1;
      arcs.forEach((a) => {
        const k = (tt * 0.25 + a.o) % 1;
        a.pulse.position.copy(a.pts[Math.floor(k * (a.pts.length - 1))]);
      });
    },
  };
}
