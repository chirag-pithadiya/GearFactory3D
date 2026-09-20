/**
 * Gear Factory 3D — Perspective Camera System
 */

import * as THREE from 'three';

export const defaultCameraPos = new THREE.Vector3(-12.5, 8.8, 19.0);
export const defaultTargetPos = new THREE.Vector3(0.0, 5.2, 0.0);

export const camera = new THREE.PerspectiveCamera(45, 16 / 10, 0.1, 100);
camera.position.copy(defaultCameraPos);

/**
 * Updates camera projection aspect ratio and matrix.
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 */
export function updateCameraAspect(width, height) {
  if (width <= 0 || height <= 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/**
 * Resets camera viewpoint and targets both meshing gears.
 * @param {Object} controls - Optional OrbitControls reference
 */
export function resetCamera(controls = null) {
  camera.position.copy(defaultCameraPos);
  if (controls) {
    controls.target.copy(defaultTargetPos);
    controls.update();
  }
}
