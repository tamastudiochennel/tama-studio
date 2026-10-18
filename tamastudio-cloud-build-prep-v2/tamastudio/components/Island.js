'use client';
import { useEffect } from 'react';

export default function Island({ src }) {
  useEffect(() => {
    let disposed = false, cleanup = null;
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ src)
      .then(async (module) => {
        if (disposed) return;
        const mount = typeof module.default === 'function' ? module.default : module.mount;
        if (typeof mount !== 'function') throw new Error(`Island ${src} tidak mengekspor fungsi mount.`);
        const result = await mount();
        if (typeof result === 'function') {
          if (disposed) result();
          else cleanup = result;
        }
      })
      .catch((error) => { if (!disposed) console.error(`Gagal memuat island ${src}`, error); });
    return () => { disposed = true; cleanup?.(); };
  }, [src]);
  return null;
}
