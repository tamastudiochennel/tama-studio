import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';
export { THREE };

export const LITE = matchMedia('(pointer: coarse), (max-width: 767px)').matches;
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const live = new Set();
let raf = 0, last = 0;

function tick(now) {
  const t = now / 1000, dt = Math.min(t - last, 0.05);
  last = t;
  for (const frame of [...live]) {
    try { frame(t, dt); }
    catch (error) {
      // A broken scene should not stop the shared animation loop for other scenes.
      live.delete(frame);
      try { console.error('Scene 3D dihentikan karena error render.', error); } catch (ignored) {}
    }
  }
  raf = live.size ? requestAnimationFrame(tick) : 0;
}

function disposeSceneResources(scene) {
  if (!scene) return;
  const textures = new Set();
  scene.traverse((object) => {
    if (object.geometry && typeof object.geometry.dispose === 'function') object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) textures.add(value);
      }
      if (typeof material.dispose === 'function') material.dispose();
    }
  });
  textures.forEach((texture) => texture.dispose());
}

export function mountScene(el, factory, { ortho = 0, dist = 6 } = {}) {
  let inst = null, disposed = false;

  function start() {
    if (disposed || inst || !el.isConnected) return;
    let renderer = null, scene = null, observer = null, api = {}, listeners = false, done = false;
    let frame = null;
    const pointer = { x: 0, y: 0 }, spin = { x: 0, y: 0, vx: 0, vy: 0 };
    let down = false, px = 0, py = 0;
    const up = () => { down = false; };
    const move = (event) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      if (down) {
        spin.vy = (event.clientX - px) * 0.008;
        spin.vx = (event.clientY - py) * 0.004;
        px = event.clientX; py = event.clientY;
      }
    };
    const dn = (event) => { down = true; px = event.clientX; py = event.clientY; };
    const cleanup = () => {
      if (done) return;
      done = true;
      if (frame) live.delete(frame);
      observer?.disconnect();
      if (listeners) {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerdown', dn);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
      }
      try { if (typeof api.dispose === 'function') api.dispose(); } catch (error) { try { console.error('Cleanup scene gagal.', error); } catch (ignored) {} }
      try { disposeSceneResources(scene); } catch (error) { try { console.error('Cleanup resource scene gagal.', error); } catch (ignored) {} }
      try { renderer?.dispose(); } catch (error) {}
      try { renderer?.forceContextLoss(); } catch (error) {}
      try { renderer?.domElement.remove(); } catch (error) {}
    };

    try {
      renderer = new THREE.WebGLRenderer({ antialias: !LITE, alpha: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, LITE ? 1 : 1.5));
      el.appendChild(renderer.domElement);
      scene = new THREE.Scene();
      const camera = ortho ? new THREE.OrthographicCamera(-1, 1, 1, -1, -50, 50) : new THREE.PerspectiveCamera(45, 1, 0.1, 100);
      if (!ortho) camera.position.z = dist;

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerdown', dn);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      listeners = true;

      api = factory({ THREE, scene, camera, renderer, el, lite: LITE, reduce: REDUCE, pointer, spin }) || {};
      observer = new ResizeObserver(() => {
        const width = el.clientWidth || 1, height = el.clientHeight || 1, aspect = width / height;
        renderer.setSize(width, height, false);
        if (ortho) {
          camera.left = -ortho * aspect; camera.right = ortho * aspect;
          camera.top = ortho; camera.bottom = -ortho;
        } else camera.aspect = aspect;
        camera.updateProjectionMatrix();
      });
      observer.observe(el);
      // Fit immediately; ResizeObserver then keeps the camera in sync with layout changes.
      const width = el.clientWidth || 1, height = el.clientHeight || 1, aspect = width / height;
      renderer.setSize(width, height, false);
      if (ortho) {
        camera.left = -ortho * aspect; camera.right = ortho * aspect;
        camera.top = ortho; camera.bottom = -ortho;
      } else camera.aspect = aspect;
      camera.updateProjectionMatrix();

      frame = (time, dt) => {
        try {
          spin.y += spin.vy;
          spin.x = THREE.MathUtils.clamp(spin.x + spin.vx, -0.7, 0.7);
          spin.vy *= 0.92; spin.vx *= 0.92;
          if (typeof api.frame === 'function') api.frame(time, dt);
          renderer.render(scene, camera);
        } catch (error) {
          cleanup();
          inst = null;
          el.classList.add('no-webgl');
        }
      };
      inst = { stop: cleanup };
      live.add(frame);
      if (!raf) { last = performance.now() / 1000; raf = requestAnimationFrame(tick); }
    } catch (error) {
      cleanup();
      el.classList.add('no-webgl');
    }
  }

  const stop = () => {
    if (!inst) return;
    const current = inst;
    inst = null;
    current.stop();
  };
  const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), { rootMargin: '120px' });
  observer.observe(el);
  return () => { disposed = true; observer.disconnect(); stop(); };
}
