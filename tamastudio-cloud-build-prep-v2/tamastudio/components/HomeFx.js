'use client';
import { useEffect } from 'react';

const load = (src) => new Promise((ok) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ok; document.head.append(s); });

export default function HomeFx() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let lenis, stop = false;
    (async () => {
      await Promise.all([load('https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js'), load('https://cdn.jsdelivr.net/npm/lenis@1.3.26/dist/lenis.min.js')]);
      if (stop) return;
      if (window.gsap) window.gsap.from('.hero-copy > *', { y: 28, opacity: 0, duration: 0.9, stagger: 0.12, ease: 'power3.out' });
      if (window.Lenis) {
        lenis = new window.Lenis({ lerp: 0.1, anchors: { offset: -72 } });
        const loop = (t) => { if (!stop) { lenis.raf(t); requestAnimationFrame(loop); } };
        requestAnimationFrame(loop);
      }
    })();
    return () => { stop = true; if (lenis) lenis.destroy(); };
  }, []);
  return null;
}
