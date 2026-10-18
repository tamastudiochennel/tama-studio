'use client';
import { useEffect, useRef } from 'react';

export default function BgField() {
  const ref = useRef(null);
  useEffect(() => {
    if (matchMedia('(pointer: coarse), (max-width: 767px), (prefers-reduced-motion: reduce)').matches) return;
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '/assets/js/core/page3d.js')
      .then((m) => { if (ref.current) m.scene(ref.current, 'bg-field', {}, { dist: 8 }); })
      .catch(() => {});
  }, []);
  return <div ref={ref} className="bg3d" aria-hidden="true" />;
}
