// Temperatura de cor (Kelvin) → cor linear, para as luzes do estúdio: tungstênio quente (3200 K) na key,
// luz do dia/HMI (5600 K) no rim, fill azulado (7000–8000 K). Aproximação de Tanner Helland sobre o corpo
// negro, convertida de sRGB para linear e normalizada pela luminância (a intensidade fica só na luz).

import * as THREE from 'three';

function srgbChannel(k, channel) {
  const t = k / 100;
  if (channel === 'r') {
    if (t <= 66) return 255;
    return 329.698727446 * Math.pow(t - 60, -0.1332047592);
  }
  if (channel === 'g') {
    if (t <= 66) return 99.4708025861 * Math.log(t) - 161.1195681661;
    return 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) return 255;
  if (t <= 19) return 0;
  return 138.5177312231 * Math.log(t - 10) - 305.0447927307;
}

const clamp255 = (v) => Math.min(255, Math.max(0, v)) / 255;

/**
 * @param {number} kelvin 1000–40000
 * @param {THREE.Color} [out]
 * @returns {THREE.Color} cor em espaço linear com luminância 1
 */
export function kelvinToColor(kelvin, out = new THREE.Color()) {
  const k = Math.min(40000, Math.max(1000, kelvin));
  out.setRGB(clamp255(srgbChannel(k, 'r')), clamp255(srgbChannel(k, 'g')), clamp255(srgbChannel(k, 'b')), THREE.SRGBColorSpace);
  const lum = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b;
  if (lum > 0) out.multiplyScalar(1 / lum);
  return out;
}
