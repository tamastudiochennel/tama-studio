'use client';
import { useEffect, useRef } from 'react';

export default function Scene({ file, data = {}, opt = {}, className = 'scene strip', label }) {
  const ref = useRef(null);
  // Scene inputs are plain, serializable configuration. Stable strings avoid remounting WebGL
  // resources on unrelated React renders when parents create new object literals.
  const dataKey = JSON.stringify(data ?? {});
  const optKey = JSON.stringify(opt ?? {});
  useEffect(() => {
    let off = false, dispose = null;
    let sceneData, sceneOpt;
    try { sceneData = JSON.parse(dataKey); sceneOpt = JSON.parse(optKey); }
    catch { sceneData = {}; sceneOpt = {}; }
    import(/* webpackIgnore: true */ /* turbopackIgnore: true */ '/assets/js/core/page3d.js')
      .then(async (m) => {
        if (off || !ref.current) return;
        const cleanup = await m.scene(ref.current, file, sceneData, sceneOpt);
        if (off) cleanup?.();
        else dispose = cleanup;
      })
      .catch(() => { if (!off && ref.current) ref.current.classList.add('no-webgl'); });
    return () => { off = true; dispose?.(); };
  }, [file, dataKey, optKey]);
  return <div ref={ref} className={className} role="img" aria-label={label} />;
}
