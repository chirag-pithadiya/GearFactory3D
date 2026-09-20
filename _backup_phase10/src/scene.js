/**
 * Gear Factory 3D — Three.js Scene & Renderer Setup
 */

import * as THREE from 'three';

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1017);
scene.fog = new THREE.Fog(0x0c1017, 22, 65);

let rendererInstance = null;

/**
 * Initializes WebGL renderer bound to target canvas element.
 * @param {HTMLCanvasElement} canvas - The WebGL canvas
 * @param {number} width - Initial container client width
 * @param {number} height - Initial container client height
 * @returns {THREE.WebGLRenderer}
 */
export function initRenderer(canvas, width = 800, height = 500) {
  if (rendererInstance) return rendererInstance;

  const configs = [
    { canvas, antialias: true, powerPreference: 'high-performance', alpha: false, failIfMajorPerformanceCaveat: false },
    { canvas, antialias: false, powerPreference: 'default', alpha: false, failIfMajorPerformanceCaveat: false },
    { canvas, antialias: false, alpha: false }
  ];

  for (const cfg of configs) {
    try {
      rendererInstance = new THREE.WebGLRenderer(cfg);
      if (rendererInstance) break;
    } catch (e) {
      console.warn('Three.js WebGLRenderer creation attempt failed with config:', cfg, e);
    }
  }

  if (!rendererInstance) {
    console.error('WebGL is not supported or hardware acceleration is disabled.');
    const container = canvas ? canvas.parentElement : document.getElementById('three-container');
    if (container) {
      const errBanner = document.createElement('div');
      errBanner.id = 'webgl-error-banner';
      errBanner.style.cssText = 'position:absolute;inset:16px;z-index:999;background:rgba(15,23,42,0.96);border:2px solid #ef4444;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#f8fafc;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.8);';
      errBanner.innerHTML = `
        <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
        <h2 style="font-size:20px;color:#f87171;margin-bottom:10px;font-family:'Outfit',sans-serif;">Hardware Acceleration Disabled</h2>
        <p style="font-size:14px;color:#cbd5e1;max-width:540px;line-height:1.6;margin-bottom:16px;">
          Your browser cannot create a 3D WebGL graphics context. This usually happens when Hardware Acceleration is turned off in browser settings.
        </p>
        <div style="background:rgba(0,0,0,0.4);border-radius:8px;padding:12px 18px;text-align:left;font-size:13px;color:#94a3b8;line-height:1.7;margin-bottom:18px;">
          <div>• <strong>Edge:</strong> Go to <code>edge://settings/system</code> &gt; Turn ON <em>"Use graphics acceleration when available"</em></div>
          <div>• <strong>Chrome:</strong> Go to <code>chrome://settings/system</code> &gt; Turn ON <em>"Use graphics acceleration when available"</em></div>
          <div>• Then restart or reload this page.</div>
        </div>
        <button onclick="window.location.reload()" style="background:#ef4444;color:#ffffff;border:none;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;">
          Reload Page
        </button>
      `;
      container.style.position = 'relative';
      container.appendChild(errBanner);
    }
    throw new Error('WebGL context creation failed.');
  }

  rendererInstance.setSize(width, height);
  rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendererInstance.shadowMap.enabled = true;
  rendererInstance.shadowMap.type = THREE.PCFSoftShadowMap;
  rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
  rendererInstance.toneMappingExposure = 1.30;

  return rendererInstance;
}

export function getRenderer() {
  return rendererInstance;
}

export function render(camera) {
  if (rendererInstance && camera) {
    rendererInstance.render(scene, camera);
  }
}
