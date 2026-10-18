export function label(THREE, text, w, h, sub, fs) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d'), f = fs || Math.round(h * 0.34);
  x.fillStyle = 'rgba(14,14,14,0.94)';
  x.strokeStyle = '#D4AF37';
  x.lineWidth = 3;
  x.beginPath();
  if (x.roundRect) x.roundRect(4, 4, w - 8, h - 8, 22); else x.rect(4, 4, w - 8, h - 8);
  x.fill();
  x.stroke();
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#ffffff';
  x.font = `700 ${f}px "Plus Jakarta Sans", system-ui, sans-serif`;
  x.fillText(text, w / 2, sub ? h * 0.4 : h / 2, w - 30);
  if (sub) {
    x.fillStyle = '#D4AF37';
    x.font = `600 ${Math.round(f * 0.8)}px "Plus Jakarta Sans", system-ui, sans-serif`;
    x.fillText(sub, w / 2, h * 0.64, w - 30);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
