/**
 * Gear Factory 3D — Lighting & Environment Setup
 */

import * as THREE from 'three';

export let inputGearGlow = null;
export let outputGearGlow = null;

/**
 * Sets up industrial factory lighting and ground plane.
 * @param {THREE.Scene} scene - The target Three.js scene
 */
export function setupLighting(scene) {
  // Ambient Light for soft fill
  const ambientLight = new THREE.AmbientLight(0xdde7f4, 1.15);
  scene.add(ambientLight);

  // Key Directional Light casting soft realistic shadows (5600K neutral studio key)
  const keyLight = new THREE.DirectionalLight(0xfffaee, 2.7);
  keyLight.position.set(9, 18, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 48;
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  // Front Fill Light for crystal-clear internal visibility
  const frontFillLight = new THREE.DirectionalLight(0xd0e0f2, 1.6);
  frontFillLight.position.set(-6, 12, 15);
  scene.add(frontFillLight);

  // Rim Light highlighting metallic gear edges
  const rimLight = new THREE.DirectionalLight(0xa5c4e8, 1.6);
  rimLight.position.set(-14, 10, -10);
  scene.add(rimLight);

  // Point Lights inside gearbox providing clean neutral illumination on gear faces
  inputGearGlow = new THREE.PointLight(0xfff6ea, 2.2, 16, 1.2);
  inputGearGlow.position.set(-1.0, 7.5, -3.2);
  scene.add(inputGearGlow);

  outputGearGlow = new THREE.PointLight(0xedf4fc, 2.2, 16, 1.2);
  outputGearGlow.position.set(1.0, 7.5, 1.6);
  scene.add(outputGearGlow);

  // Factory Floor Plane receiving shadows (matte industrial concrete workshop floor)
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x141822,
    roughness: 0.80,
    metalness: 0.20,
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Precision Grid Helper with subtle slate engineering styling
  const gridHelper = new THREE.GridHelper(30, 30, 0x475569, 0x1e2634);
  gridHelper.position.y = 0.005;
  scene.add(gridHelper);

  return {
    ambientLight,
    keyLight,
    frontFillLight,
    rimLight,
    inputGearGlow,
    outputGearGlow,
    floorMesh,
    gridHelper,
  };
}

export function updateGlowPositions(inX, inY, inZ, outX, outY, outZ) {
  if (inputGearGlow) inputGearGlow.position.set(inX, inY, inZ);
  if (outputGearGlow) outputGearGlow.position.set(outX, outY, outZ);
}
