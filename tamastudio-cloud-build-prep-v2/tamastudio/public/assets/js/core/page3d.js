export async function scene(el, file, data, opt) {
  try {
    const [{ mountScene }, m] = await Promise.all([import('../3d/scene-manager.js'), import(`../3d/${file}.js`)]);
    if (!el?.isConnected) return () => {};
    return mountScene(el, (c) => m.default({ ...c, data }), opt);
  } catch (e) {
    if (el?.isConnected) el.classList.add('no-webgl');
    return () => {};
  }
}
