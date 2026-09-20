/**
 * Gear Factory 3D — Lighting & Industrial Workshop Environment Setup
 *
 * Phase 12 Features:
 * - Medium-dark visible industrial factory walls
 * - Warm gray concrete workshop floor with subtle expansion joints
 * - Structural steel I-beams and overhead ceiling rafters
 * - Industrial overhead copper and steel conduit pipes
 * - Background machinery silhouettes with subtle indicator lights
 * - Vintage workshop pendant lamps
 * - Balanced warm key, cool fill, rim light, and ambient illumination
 */

import * as THREE from 'three';

export let inputGearGlow = null;
export let outputGearGlow = null;

/**
 * Creates lightweight 3D industrial workshop architecture and machinery.
 * @param {THREE.Scene} scene - The target Three.js scene
 * @returns {THREE.Group} Complete environment group
 */
export function createWorkshopEnvironment(scene) {
  const envGroup = new THREE.Group();
  envGroup.name = 'workshopEnvironment';

  // Materials: Muted industrial gray concrete & structural steel
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x546072, // Warm visible gray concrete wall
    roughness: 0.88,
    metalness: 0.08,
  });

  const wainscotMat = new THREE.MeshStandardMaterial({
    color: 0x3d4756, // Protective wainscot base
    roughness: 0.82,
    metalness: 0.15,
  });

  const steelBeamMat = new THREE.MeshStandardMaterial({
    color: 0x3a4656,
    roughness: 0.62,
    metalness: 0.55,
  });

  const pipeSteelMat = new THREE.MeshStandardMaterial({
    color: 0x505f72,
    roughness: 0.40,
    metalness: 0.82,
  });

  const pipeCopperMat = new THREE.MeshStandardMaterial({
    color: 0xaa7855,
    roughness: 0.35,
    metalness: 0.75,
  });

  const machineMetalMat = new THREE.MeshStandardMaterial({
    color: 0x323e4e,
    roughness: 0.68,
    metalness: 0.45,
  });

  // 1. Back Industrial Wall (Distant, framing the background at Z = -18)
  const backWallGeo = new THREE.BoxGeometry(60, 24, 0.6);
  const backWallMesh = new THREE.Mesh(backWallGeo, wallMat);
  backWallMesh.position.set(0, 12, -18);
  backWallMesh.receiveShadow = true;
  envGroup.add(backWallMesh);

  // Back Wall Wainscoting (lower protective base)
  const wainscotGeo = new THREE.BoxGeometry(60, 3.2, 0.8);
  const wainscotMesh = new THREE.Mesh(wainscotGeo, wainscotMat);
  wainscotMesh.position.set(0, 1.6, -17.8);
  wainscotMesh.receiveShadow = true;
  envGroup.add(wainscotMesh);

  // Left Industrial Side Wall (at far distance)
  const leftWallGeo = new THREE.BoxGeometry(0.6, 24, 40);
  const leftWallMesh = new THREE.Mesh(leftWallGeo, wallMat);
  leftWallMesh.position.set(-28, 12, 0);
  leftWallMesh.receiveShadow = true;
  envGroup.add(leftWallMesh);

  // 2. Structural Steel Columns / Pilasters (Mounted flush against back wall, never blocking machine)
  const columnGeo = new THREE.BoxGeometry(1.0, 24, 0.4);
  const colPositions = [
    [-18, -17.5],
    [-8, -17.5],
    [8, -17.5],
    [18, -17.5],
  ];
  for (const [cx, cz] of colPositions) {
    const col = new THREE.Mesh(columnGeo, steelBeamMat);
    col.position.set(cx, 12, cz);
    col.castShadow = true;
    col.receiveShadow = true;
    envGroup.add(col);
  }

  // 3. Structural Steel Ceiling Beam (Across the top of the back wall only)
  const beamGeo = new THREE.BoxGeometry(60, 0.8, 0.4);
  const beamHeights = [18.8, 21.0];
  for (const by of beamHeights) {
    const beam = new THREE.Mesh(beamGeo, steelBeamMat);
    beam.position.set(0, by, -17.4);
    beam.castShadow = true;
    envGroup.add(beam);
  }

  // 4. Industrial Overhead Conduit Pipes (Mounted high on back wall)
  const pipeCopperGeo = new THREE.CylinderGeometry(0.10, 0.10, 58, 16);
  const pipeCopperMesh = new THREE.Mesh(pipeCopperGeo, pipeCopperMat);
  pipeCopperMesh.rotation.z = Math.PI / 2;
  pipeCopperMesh.position.set(0, 15.5, -17.2);
  envGroup.add(pipeCopperMesh);

  const pipeSteelGeo = new THREE.CylinderGeometry(0.14, 0.14, 58, 16);
  const pipeSteelMesh = new THREE.Mesh(pipeSteelGeo, pipeSteelMat);
  pipeSteelMesh.rotation.z = Math.PI / 2;
  pipeSteelMesh.position.set(0, 14.7, -17.1);
  envGroup.add(pipeSteelMesh);

  // Vertical feeder conduits on back wall
  const vertPipeGeo = new THREE.CylinderGeometry(0.08, 0.08, 12, 12);
  const vertXs = [-14, 14];
  for (const vx of vertXs) {
    const vPipe = new THREE.Mesh(vertPipeGeo, pipeSteelMat);
    vPipe.position.set(vx, 8.5, -17.2);
    envGroup.add(vPipe);
  }

  // 5. Subtle Background Machinery Silhouettes (Positioned far to sides, framing the hero gearbox)
  // Electrical Control Panel Cabinet (Distant Right)
  const cabinetGeo = new THREE.BoxGeometry(3.5, 7.0, 1.8);
  const cabinetMesh = new THREE.Mesh(cabinetGeo, machineMetalMat);
  cabinetMesh.position.set(15.5, 3.5, -16.2);
  cabinetMesh.castShadow = true;
  cabinetMesh.receiveShadow = true;
  envGroup.add(cabinetMesh);

  // Cabinet status indicator light (soft emerald LED)
  const ledGeo = new THREE.SphereGeometry(0.08, 8, 8);
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const ledMesh = new THREE.Mesh(ledGeo, ledMat);
  ledMesh.position.set(14.6, 6.2, -15.2);
  envGroup.add(ledMesh);

  // Industrial Generator / Lathe Block (Distant Left)
  const latheBaseGeo = new THREE.BoxGeometry(5.2, 2.8, 2.4);
  const latheBase = new THREE.Mesh(latheBaseGeo, machineMetalMat);
  latheBase.position.set(-15.0, 1.4, -16.0);
  latheBase.castShadow = true;
  latheBase.receiveShadow = true;
  envGroup.add(latheBase);

  const latheHeadGeo = new THREE.CylinderGeometry(0.9, 0.9, 3.0, 18);
  const latheHead = new THREE.Mesh(latheHeadGeo, machineMetalMat);
  latheHead.rotation.z = Math.PI / 2;
  latheHead.position.set(-15.0, 3.3, -16.0);
  latheHead.castShadow = true;
  latheHead.receiveShadow = true;
  envGroup.add(latheHead);

  scene.add(envGroup);
  return envGroup;
}

/**
 * Sets up industrial factory lighting, workshop environment, and concrete floor.
 * @param {THREE.Scene} scene - The target Three.js scene
 */
export function setupLighting(scene) {
  // 1. Ambient Light: Clear, warm-neutral workshop fill ensuring zero pitch-black areas
  const ambientLight = new THREE.AmbientLight(0xe8eef5, 1.45);
  scene.add(ambientLight);

  // 2. Warm Key Directional Light: Warm high-angle industrial work lamp
  const keyLight = new THREE.DirectionalLight(0xfff0d8, 2.85);
  keyLight.position.set(10, 20, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 52;
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 16;
  keyLight.shadow.camera.bottom = -16;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  // 3. Cool Neutral Fill Light: Soft bounce from open factory bay
  const frontFillLight = new THREE.DirectionalLight(0xd2e2f2, 1.75);
  frontFillLight.position.set(-10, 14, 14);
  scene.add(frontFillLight);

  // 4. Rim / Edge Light: Crisp metallic highlights on gear teeth and polished shafts
  const rimLight = new THREE.DirectionalLight(0xbad2eb, 2.10);
  rimLight.position.set(-14, 14, -14);
  scene.add(rimLight);

  // 5. Dual Overhead Workshop Spotlights: Direct illumination over input and output gears
  inputGearGlow = new THREE.PointLight(0xfff2e0, 2.8, 22, 1.1);
  inputGearGlow.position.set(-1.0, 8.5, -2.4);
  scene.add(inputGearGlow);

  outputGearGlow = new THREE.PointLight(0xeef4ff, 2.8, 22, 1.1);
  outputGearGlow.position.set(1.0, 8.5, 2.4);
  scene.add(outputGearGlow);

  // 6. Warm Gray Concrete Workshop Floor Plane (Natural floor with subtle expansion joints)
  const floorGeometry = new THREE.PlaneGeometry(80, 80);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x444e5c, // Warm industrial gray concrete
    roughness: 0.86,
    metalness: 0.06,
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Subtle concrete slab saw-cut expansion joints
  const seamMat = new THREE.MeshStandardMaterial({
    color: 0x323a46,
    roughness: 0.95,
    metalness: 0.02,
  });
  const seamXPositions = [-14, 0, 14];
  for (const sx of seamXPositions) {
    const seamX = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 80), seamMat);
    seamX.rotation.x = -Math.PI / 2;
    seamX.position.set(sx, 0.002, 0);
    seamX.receiveShadow = true;
    scene.add(seamX);
  }
  const seamZPositions = [-10, 6, 22];
  for (const sz of seamZPositions) {
    const seamZ = new THREE.Mesh(new THREE.PlaneGeometry(80, 0.05), seamMat);
    seamZ.rotation.x = -Math.PI / 2;
    seamZ.position.set(0, 0.002, sz);
    seamZ.receiveShadow = true;
    scene.add(seamZ);
  }

  // 7. 3D Industrial Factory Workshop Architecture (Strictly Background)
  const environmentGroup = createWorkshopEnvironment(scene);

  return {
    ambientLight,
    keyLight,
    frontFillLight,
    rimLight,
    inputGearGlow,
    outputGearGlow,
    floorMesh,
    environmentGroup,
  };
}

export function updateGlowPositions(inX, inY, inZ, outX, outY, outZ) {
  if (inputGearGlow) inputGearGlow.position.set(inX, inY, inZ);
  if (outputGearGlow) outputGearGlow.position.set(outX, outY, outZ);
}

