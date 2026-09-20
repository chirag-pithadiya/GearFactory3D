/**
 * Gear Factory 3D — Camera OrbitControls Setup
 */

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { defaultTargetPos } from './camera.js';

let controlsInstance = null;

/**
 * Initializes OrbitControls on camera and canvas DOM element.
 * @param {THREE.Camera} camera - The perspective camera
 * @param {HTMLElement} domElement - The WebGL canvas element
 * @returns {OrbitControls}
 */
export function initControls(camera, domElement) {
  controlsInstance = new OrbitControls(camera, domElement);
  controlsInstance.enableDamping = true;
  controlsInstance.dampingFactor = 0.05;
  controlsInstance.target.copy(defaultTargetPos);
  controlsInstance.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent dipping below floor
  controlsInstance.minDistance = 3.0;
  controlsInstance.maxDistance = 60.0;

  return controlsInstance;
}

export function updateControls() {
  if (controlsInstance) {
    controlsInstance.update();
  }
}

export function getControls() {
  return controlsInstance;
}

export function resetControls() {
  if (controlsInstance) {
    controlsInstance.target.copy(defaultTargetPos);
    controlsInstance.update();
  }
}
