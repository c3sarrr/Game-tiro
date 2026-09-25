// Favicon procedural: uma bolota de massinha terracota com "M" em relevo (nenhum arquivo de imagem).

export function paintFavicon() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  // Bolota irregular
  g.beginPath();
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 27 + Math.sin(a * 3 + 0.7) * 2.2 + Math.cos(a * 5) * 1.3;
    const x = 32 + Math.cos(a) * r;
    const y = 33 + Math.sin(a) * r * 0.94;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  const grad = g.createRadialGradient(24, 22, 4, 32, 34, 32);
  grad.addColorStop(0, '#F28F3B');
  grad.addColorStop(0.55, '#C8553D');
  grad.addColorStop(1, '#8E3322');
  g.fillStyle = grad;
  g.fill();
  // Brilho úmido
  g.fillStyle = 'rgba(255,240,220,0.45)';
  g.beginPath();
  g.ellipse(22, 20, 7, 4, -0.5, 0, Math.PI * 2);
  g.fill();
  // "M" em relevo
  g.font = '800 34px "Baloo 2", "Arial Rounded MT Bold", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(60,20,10,0.55)';
  g.fillText('M', 33.5, 38.5);
  g.fillStyle = '#FFD23F';
  g.fillText('M', 32, 37);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.append(link);
  }
  link.href = c.toDataURL('image/png');
}
