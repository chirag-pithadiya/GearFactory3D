/**
 * Gear Factory 3D — Gearbox Housing, 3D Labels & Complete Mechanical Assembly
 *
 * Requirements & Features:
 * - Rectangular industrial casing with transparent acrylic inspection panels
 * - 3D billboard callout labels with leader lines
 * - Complete assembly builder coordinating motor, shafts, bearings, and spur gears
 * - Guaranteed clearance checks (2.0 to 5.0 units safe clearance)
 */

import * as THREE from 'three';
import { GEAR_MODULE, calculateGearOuterRadius, debugTelemetry } from './game-state.js';
import { createSpurGear } from './gears.js';
import { createMotor } from './motor.js';
import { createShaft } from './shafts.js';
import { createShaftSupport, createMountingFeet } from './bearings.js';
import { updateGlowPositions } from './lighting.js';

/**
 * Creates a rectangular industrial gearbox housing enclosing both gears,
 * featuring structural corner pillars, semi-transparent inspection windows,
 * top cover lid with lifting eye, and side panels with bearing pass-throughs.
 * @param {Object} options - Housing dimensions and colors
 * @returns {THREE.Group} Complete gearbox housing assembly
 */
export function createGearboxCasing(options = {}) {
  const {
    widthX = 2.6,
    heightY = 6.4,
    depthZ = 7.2,
    frameColor = 0x283d36, // Dark desaturated green-slate cast metal
    panelColor = 0x8ab2d6, // Optical inspection acrylic
    panelOpacity = 0.02,
    metalness = 0.55,
    roughness = 0.45,
  } = options;

  const casingGroup = new THREE.Group();
  const shaftY = options.shaftY || 3.6;

  // 1. Structural Cast Iron Rear Framing Stanchions & Low Front Mount Pedestals
  // Rear stanchions stay in the background framing the machine; front lugs stay at base level
  const rearPillarGeo = new THREE.BoxGeometry(0.28, heightY, 0.28);
  const frontLugGeo = new THREE.BoxGeometry(0.32, 0.65, 0.32);
  const castMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: metalness,
    roughness: roughness,
  });

  // Steel bolt material - clearly visible metallic fasteners
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x8a97a8,
    metalness: 0.92,
    roughness: 0.28,
  });
  const hexBoltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.10, 6);

  const xCorners = [-widthX * 0.5 + 0.14, widthX * 0.5 - 0.14];
  const zBack = -depthZ * 0.5 + 0.14;
  const zFront = depthZ * 0.5 - 0.14;

  // Background rear pillars (framing the machine without blocking sightlines)
  for (const cx of xCorners) {
    const rearPillar = new THREE.Mesh(rearPillarGeo, castMat);
    rearPillar.position.set(cx, heightY * 0.5, zBack);
    rearPillar.castShadow = true;
    rearPillar.receiveShadow = true;
    casingGroup.add(rearPillar);

    // Front low mounting pedestals (low profile, never crosses machine or gears)
    const frontLug = new THREE.Mesh(frontLugGeo, castMat);
    frontLug.position.set(cx, 0.65 * 0.5, zFront);
    frontLug.castShadow = true;
    frontLug.receiveShadow = true;
    casingGroup.add(frontLug);
  }

  // 2. Base Perimeter Flange Rails & Stiffeners (Sturdy cast machine bed)
  const railH = 0.28;
  const railXGeo = new THREE.BoxGeometry(widthX, railH, 0.28);
  const rFront = new THREE.Mesh(railXGeo, castMat);
  rFront.position.set(0, railH * 0.5, depthZ * 0.5 - 0.14);
  rFront.castShadow = true;
  rFront.receiveShadow = true;
  casingGroup.add(rFront);

  const rBack = new THREE.Mesh(railXGeo, castMat);
  rBack.position.set(0, railH * 0.5, -depthZ * 0.5 + 0.14);
  rBack.castShadow = true;
  rBack.receiveShadow = true;
  casingGroup.add(rBack);

  const railZGeo = new THREE.BoxGeometry(0.28, railH, depthZ);
  const rLeft = new THREE.Mesh(railZGeo, castMat);
  rLeft.position.set(-widthX * 0.5 + 0.14, railH * 0.5, 0);
  rLeft.castShadow = true;
  casingGroup.add(rLeft);

  const rRight = new THREE.Mesh(railZGeo, castMat);
  rRight.position.set(widthX * 0.5 - 0.14, railH * 0.5, 0);
  rRight.castShadow = true;
  casingGroup.add(rRight);

  // 3. Compact Industrial Inspection Cover & Lifting Eye (Snug Machine Cap, NOT an Oversized Roof)
  // Background rear cross-tie beam connecting the two rear pillars
  const tieGeo = new THREE.BoxGeometry(widthX - 0.28, 0.20, 0.20);
  const tieBeam = new THREE.Mesh(tieGeo, castMat);
  tieBeam.position.set(0, heightY, zBack);
  tieBeam.castShadow = true;
  casingGroup.add(tieBeam);

  // Compact inspection lid mounted on the rear casting bridge
  const lidH = 0.16;
  const coverW = Math.min(widthX * 0.45, 2.2);
  const coverD = Math.min(depthZ * 0.26, 1.8);
  const topCoverZ = zBack + coverD * 0.5;
  const topCoverGeo = new THREE.BoxGeometry(coverW, lidH, coverD);
  const topCoverMesh = new THREE.Mesh(topCoverGeo, castMat);
  topCoverMesh.position.set(0, heightY + lidH * 0.5, topCoverZ);
  topCoverMesh.castShadow = true;
  topCoverMesh.receiveShadow = true;
  casingGroup.add(topCoverMesh);

  // Top Inspection Service Cover (Raised cast plate with perimeter bolts)
  const hatchGeo = new THREE.BoxGeometry(coverW * 0.72, 0.06, coverD * 0.65);
  const hatchMat = new THREE.MeshStandardMaterial({
    color: 0x3d5249,
    metalness: 0.72,
    roughness: 0.38,
  });
  const hatchMesh = new THREE.Mesh(hatchGeo, hatchMat);
  hatchMesh.position.set(0, heightY + lidH + 0.03, topCoverZ);
  hatchMesh.castShadow = true;
  casingGroup.add(hatchMesh);

  // Inspection Cover Fastener Bolts (4 corners)
  const hx = coverW * 0.28;
  const hz = coverD * 0.24;
  const hatchBoltCorners = [
    [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]
  ];
  for (const [cx, cz] of hatchBoltCorners) {
    const hBolt = new THREE.Mesh(hexBoltGeo, boltMat);
    hBolt.position.set(cx, heightY + lidH + 0.06 + 0.03, topCoverZ + cz);
    hBolt.castShadow = true;
    casingGroup.add(hBolt);
  }

  // Heavy Drop-Forged Steel Lifting Eye Bolt on top
  const eyeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.20, 0.10, 18),
    new THREE.MeshStandardMaterial({ color: 0x6e7b8a, metalness: 0.90, roughness: 0.25 })
  );
  eyeBase.position.set(0, heightY + lidH + 0.06 + 0.05, topCoverZ);
  eyeBase.castShadow = true;
  casingGroup.add(eyeBase);

  const eyeTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.20, 0.055, 16, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a97a8, metalness: 0.94, roughness: 0.20 })
  );
  eyeTorus.position.set(0, heightY + lidH + 0.06 + 0.24, topCoverZ);
  eyeTorus.castShadow = true;
  casingGroup.add(eyeTorus);

  // 4. Background Rear Inspection Window Panel
  const windowMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    transparent: true,
    opacity: panelOpacity,
    roughness: 0.08,
    metalness: 0.25,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const backWindow = new THREE.Mesh(
    new THREE.PlaneGeometry(widthX - 0.28, heightY - 0.6),
    windowMat
  );
  backWindow.position.set(0, heightY * 0.5 + 0.1, -depthZ * 0.5 + 0.02);
  backWindow.rotation.y = Math.PI;
  casingGroup.add(backWindow);

  // Retaining Base Bezel (Low trim rail on the base)
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x3a4b44,
    metalness: 0.75,
    roughness: 0.35,
  });
  const bezelBarH = new THREE.BoxGeometry(widthX - 0.18, 0.08, 0.04);
  const bezelBottom = new THREE.Mesh(bezelBarH, bezelMat);
  bezelBottom.position.set(0, 0.35, depthZ * 0.5 + 0.01);
  casingGroup.add(bezelBottom);

  // 6. Cast-In Bearing Housing Bosses on Side Bulkheads
  // Sturdy cylindrical blisters integrated directly into cast iron side walls
  const bossGeo = new THREE.CylinderGeometry(0.82, 0.88, 0.35, 28);
  const bossMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: metalness,
    roughness: roughness + 0.05,
  });

  // Left Bearing Boss (Input Shaft)
  const leftBoss = new THREE.Mesh(bossGeo, bossMat);
  leftBoss.rotation.z = Math.PI / 2;
  leftBoss.position.set(-widthX * 0.5 - 0.12, shaftY, options.inputZ || -2.4);
  leftBoss.castShadow = true;
  leftBoss.receiveShadow = true;
  casingGroup.add(leftBoss);

  // Right Bearing Boss (Output Shaft)
  const rightBoss = new THREE.Mesh(bossGeo, bossMat);
  rightBoss.rotation.z = Math.PI / 2;
  rightBoss.position.set(widthX * 0.5 + 0.12, shaftY, options.outputZ || 2.4);
  rightBoss.castShadow = true;
  rightBoss.receiveShadow = true;
  casingGroup.add(rightBoss);

  // Radial Bearing Flange Retaining Bolts around each boss (6 bolts per housing)
  const bossBoltCount = 6;
  const bossBoltR = 0.65;
  for (let i = 0; i < bossBoltCount; i++) {
    const angle = (i * Math.PI * 2) / bossBoltCount;
    const by = Math.sin(angle) * bossBoltR;
    const bz = Math.cos(angle) * bossBoltR;

    // Left housing bolts
    const bLeft = new THREE.Mesh(hexBoltGeo, boltMat);
    bLeft.rotation.z = Math.PI / 2;
    bLeft.position.set(-widthX * 0.5 - 0.28, shaftY + by, (options.inputZ || -2.4) + bz);
    bLeft.castShadow = true;
    casingGroup.add(bLeft);

    // Right housing bolts
    const bRight = new THREE.Mesh(hexBoltGeo, boltMat);
    bRight.rotation.z = Math.PI / 2;
    bRight.position.set(widthX * 0.5 + 0.28, shaftY + by, (options.outputZ || 2.4) + bz);
    bRight.castShadow = true;
    casingGroup.add(bRight);
  }

  // 7. Industrial Oil Level Sight Glass on Front Lower Casing
  const sightGlassBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 18),
    new THREE.MeshStandardMaterial({ color: 0xb48c36, metalness: 0.90, roughness: 0.25 }) // Brass bezel
  );
  sightGlassBase.rotation.x = Math.PI / 2;
  sightGlassBase.position.set(widthX * 0.28, 1.2, depthZ * 0.5 + 0.03);
  casingGroup.add(sightGlassBase);

  const sightGlassWindow = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 18),
    new THREE.MeshStandardMaterial({ color: 0x996515, roughness: 0.1, metalness: 0.3 }) // Amber gear oil
  );
  sightGlassWindow.position.set(widthX * 0.28, 1.2, depthZ * 0.5 + 0.075);
  casingGroup.add(sightGlassWindow);

  // Magnetic Oil Drain Plug on Bottom Front
  const drainPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.10, 6),
    boltMat
  );
  drainPlug.rotation.x = Math.PI / 2;
  drainPlug.position.set(-widthX * 0.28, 0.15, depthZ * 0.5 + 0.03);
  casingGroup.add(drainPlug);

  // 8. Heavy-Duty Flanged Base Mounting Feet
  const feet = createMountingFeet({
    width: widthX,
    depth: depthZ,
  });
  casingGroup.add(feet);

  casingGroup.userData = {
    type: 'gearbox_casing',
    widthX,
    heightY,
    depthZ,
  };

  return casingGroup;
}

/**
 * Creates a high-contrast 3D billboard callout label using crisp HTML5 Canvas texture.
 * @param {string} text - Title text
 * @param {Object} options - Subtext, colors, scale
 * @returns {THREE.Group} Billboard sprite group
 */
export function createLabel(text, options = {}) {
  const {
    fontSize = 32,
    textColor = '#ffffff',
    bgColor = 'rgba(15, 23, 42, 0.88)',
    borderColor = '#38bdf8',
    subtext = '',
    scale = 1.0,
  } = options;

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 512;
  labelCanvas.height = 144;
  const ctx = labelCanvas.getContext('2d');

  // Background rounded rectangle badge
  const r = 20;
  const x = 16, y = 14, w = 480, h = 116;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  // Left Status Indicator Accent Dot
  ctx.beginPath();
  ctx.arc(x + 36, y + h / 2, 9, 0, Math.PI * 2);
  ctx.fillStyle = borderColor;
  ctx.fill();

  // Primary Label Text
  ctx.font = `bold ${fontSize}px 'Outfit', 'Inter', sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = subtext ? 'bottom' : 'middle';
  ctx.fillText(text, x + 58, subtext ? y + h / 2 + 2 : y + h / 2);

  // Subtext if provided
  if (subtext) {
    ctx.font = `600 18px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(subtext, x + 58, y + h / 2 + 24);
  }

  const texture = new THREE.CanvasTexture(labelCanvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(3.2 * scale, 0.9 * scale, 1.0);
  sprite.position.set(0, 1.0 * scale, 0);

  const group = new THREE.Group();
  group.add(sprite);

  // Anchor dot at target point
  const anchorGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const anchorMat = new THREE.MeshBasicMaterial({ color: borderColor });
  const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat);
  group.add(anchorMesh);

  // Leader line from anchor (0,0,0) to sprite
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.8 * scale, 0),
  ]);
  const lineMat = new THREE.LineBasicMaterial({
    color: borderColor,
    transparent: true,
    opacity: 0.55,
  });
  const leaderLine = new THREE.Line(lineGeo, lineMat);
  group.add(leaderLine);

  group.userData = { isLabelGroup: true, labelText: text };
  return group;
}

/**
 * Creates a subtle curved directional arc indicator with arrowhead.
 * Shows rotation direction (CW or CCW) on gear face for beginner learning.
 *
 * @param {number} radius - Arc radius
 * @param {boolean} isClockwise - true for CW, false for CCW
 * @param {number} color - Hex color
 * @returns {THREE.Group} Direction arrow group
 */
export function createDirectionIndicator(radius = 1.6, isClockwise = true, color = 0xf59e0b) {
  const dirGroup = new THREE.Group();

  // 1. Semi-circular arc ring (about 120 degrees = 2.09 rad)
  const arcLength = Math.PI * 0.70;
  const ringGeo = new THREE.RingGeometry(radius - 0.07, radius + 0.07, 28, 1, 0, arcLength);
  const ringMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arcMesh = new THREE.Mesh(ringGeo, ringMat);
  dirGroup.add(arcMesh);

  // 2. Arrowhead cone at the end of arc
  const arrowGeo = new THREE.ConeGeometry(0.18, 0.40, 3);
  const arrowMat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const arrowMesh = new THREE.Mesh(arrowGeo, arrowMat);
  const tipAngle = arcLength;
  arrowMesh.position.set(radius * Math.cos(tipAngle), radius * Math.sin(tipAngle), 0);
  arrowMesh.rotation.z = tipAngle + (isClockwise ? -Math.PI / 2 : Math.PI / 2);
  dirGroup.add(arrowMesh);

  // Face perpendicular to X axis
  dirGroup.rotation.y = Math.PI / 2;
  dirGroup.userData = { isDirectionArrow: true, isClockwise };
  return dirGroup;
}

/**
 * Rebuilds the complete 3D industrial gearbox assembly with safe internal clearances.
 * @param {THREE.Scene} scene - Scene to assemble components in
 * @param {Object} state - Main simulation state
 * @param {number|null} selectedInputTeeth - Teeth count for input gear (or null for bare shaft)
 * @param {number|null} selectedOutputTeeth - Teeth count for output gear (or null for bare shaft)
 * @param {Object} oldAssembly - Previous assembly objects to clean up
 * @returns {Object} New assembly references
 */
export function buildGearTrain(scene, state, selectedInputTeeth = 20, selectedOutputTeeth = 30, oldAssembly = {}) {
  // 1. Calculate complete outer radius of each gear
  const effInTeeth = selectedInputTeeth || 20;
  const effOutTeeth = selectedOutputTeeth || 30;
  const inDim = calculateGearOuterRadius(effInTeeth, GEAR_MODULE);
  const outDim = calculateGearOuterRadius(effOutTeeth, GEAR_MODULE);

  const centerDistance = inDim.pitchRadius + outDim.pitchRadius;
  const maxGearOuterRadius = Math.max(inDim.gearOuterRadius, outDim.gearOuterRadius);
  const maxGearDiameter = maxGearOuterRadius * 2;

  // Safe clearance around every gear (2.5 units)
  const safeClearance = 2.5;

  // 2. Shaft Elevation Y: Guarantees safe bottom clearance above floor rail
  const floorRailHeight = 0.25;
  const currentShaftElevationY = maxGearOuterRadius + safeClearance + floorRailHeight;
  const shaftY = currentShaftElevationY;

  // 3. Parallel Shaft Z Positions
  const totalGearSpanZ = centerDistance + inDim.gearOuterRadius + outDim.gearOuterRadius;
  const halfGearSpanZ = totalGearSpanZ * 0.5;

  const posZInput = -halfGearSpanZ + inDim.gearOuterRadius;
  const posZOutput = +halfGearSpanZ - outDim.gearOuterRadius;

  // 4. Calculate Casing Internal Dimensions
  const casingInternalWidthX = inDim.hubThickness + safeClearance * 2;
  const casingInternalHeightY = shaftY + maxGearOuterRadius + safeClearance;
  const casingInternalDepthZ = totalGearSpanZ + safeClearance * 2;

  // 5. Update Debug Telemetry
  debugTelemetry.inputGearCenter = { x: 0, y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) };
  debugTelemetry.outputGearCenter = { x: 0, y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) };
  debugTelemetry.inputGearOuterRadius = Number(inDim.gearOuterRadius.toFixed(3));
  debugTelemetry.outputGearOuterRadius = Number(outDim.gearOuterRadius.toFixed(3));
  debugTelemetry.inputGearDiameter = Number(inDim.gearDiameter.toFixed(3));
  debugTelemetry.outputGearDiameter = Number(outDim.gearDiameter.toFixed(3));
  debugTelemetry.casingInternalDimensions = {
    widthX: Number(casingInternalWidthX.toFixed(3)),
    heightY: Number(casingInternalHeightY.toFixed(3)),
    lengthZ: Number(casingInternalDepthZ.toFixed(3)),
  };
  debugTelemetry.clearanceChecks = {
    clearanceX: Number((casingInternalWidthX * 0.5 - inDim.hubThickness * 0.5).toFixed(3)),
    clearanceYBottom: Number((shaftY - maxGearOuterRadius - floorRailHeight).toFixed(3)),
    clearanceYTop: Number((casingInternalHeightY - (shaftY + maxGearOuterRadius)).toFixed(3)),
    clearanceZFront: Number((casingInternalDepthZ * 0.5 - (posZOutput + outDim.gearOuterRadius)).toFixed(3)),
    clearanceZBack: Number((-posZInput + inDim.gearOuterRadius - casingInternalDepthZ * 0.5) * -1).toFixed(3),
  };

  // 6. Clean up previous objects from scene
  if (oldAssembly.motor) scene.remove(oldAssembly.motor);
  if (oldAssembly.inputShaft) scene.remove(oldAssembly.inputShaft);
  if (oldAssembly.outputShaft) scene.remove(oldAssembly.outputShaft);
  if (oldAssembly.inputGear) scene.remove(oldAssembly.inputGear);
  if (oldAssembly.outputGear) scene.remove(oldAssembly.outputGear);
  if (oldAssembly.inputSlotMarker) scene.remove(oldAssembly.inputSlotMarker);
  if (oldAssembly.outputSlotMarker) scene.remove(oldAssembly.outputSlotMarker);
  if (oldAssembly.inputDirectionArrow) scene.remove(oldAssembly.inputDirectionArrow);
  if (oldAssembly.outputDirectionArrow) scene.remove(oldAssembly.outputDirectionArrow);
  if (oldAssembly.gearboxCasing) scene.remove(oldAssembly.gearboxCasing);
  if (oldAssembly.labelsGroup) scene.remove(oldAssembly.labelsGroup);
  if (oldAssembly.engagementContactFlash) scene.remove(oldAssembly.engagementContactFlash);
  if (oldAssembly.bearingSupports) {
    oldAssembly.bearingSupports.forEach((s) => scene.remove(s));
  }
  const bearingSupports = [];

  // 7. Create Gearbox Casing
  const gearboxCasing = createGearboxCasing({
    widthX: casingInternalWidthX,
    heightY: casingInternalHeightY,
    depthZ: casingInternalDepthZ,
    shaftY: shaftY,
    inputZ: posZInput,
    outputZ: posZOutput,
  });
  gearboxCasing.position.set(0, 0, 0);
  scene.add(gearboxCasing);

  // 8. Create Electric Motor on left side (-X)
  const motorX = -casingInternalWidthX * 0.5 - 2.5;
  const motor = createMotor({
    radius: 1.25,
    length: 2.6,
    shaftY: shaftY,
    bodyColor: 0x1a3350,
    endCoverColor: 0x122236,
    shaftRadius: 0.32,
    shaftLength: 1.1,
  });
  motor.position.set(motorX, shaftY, posZInput);
  scene.add(motor);
  const motorShaft = motor.userData.shaftGroup;  // 9. Create Input Shaft (Polished chrome steel)
  const inputShaftTotalLength = casingInternalWidthX + 1.4;
  const inputShaftCenterX = -0.7;
  const inputShaft = createShaft({
    radius: 0.32,
    length: inputShaftTotalLength,
    color: 0xe8f0f8,
    metalness: 0.95,
    roughness: 0.15,
    hasCoupling: true,
  });
  inputShaft.position.set(inputShaftCenterX, shaftY, posZInput);
  scene.add(inputShaft);

  // 10. Create Input Gear (High-clarity precision machined steel, CW) or Slot Locator Ring
  let inputGear = null;
  let inputSlotMarker = null;
  let inputDirectionArrow = null;
  if (selectedInputTeeth) {
    inputGear = createSpurGear({
      teeth: selectedInputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.42,
      color: 0xd8e4f0, // Polished high-clarity mechanical steel
      metalness: 0.92,
      roughness: 0.20,
    });
    inputGear.position.set(0, shaftY, posZInput);
    scene.add(inputGear);

    // Subtle CW Direction Indicator Arrow
    const inArrowRadius = Math.max(0.85, inDim.pitchRadius * 0.70);
    inputDirectionArrow = createDirectionIndicator(inArrowRadius, true, 0xf59e0b);
    inputDirectionArrow.position.set(0.38, shaftY, posZInput);
    scene.add(inputDirectionArrow);
  } else {
    // 3D Input Shaft Placement Slot Locator Ring
    const slotGeo = new THREE.TorusGeometry(0.55, 0.05, 12, 32);
    const slotMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.65,
      wireframe: true,
    });
    inputSlotMarker = new THREE.Mesh(slotGeo, slotMat);
    inputSlotMarker.rotation.y = Math.PI / 2;
    inputSlotMarker.position.set(0, shaftY, posZInput);
    inputSlotMarker.userData = { isShaftSlot: true, slotType: 'input' };
    scene.add(inputSlotMarker);
  }

  // 11. Create Output Gear (High-clarity precision machined steel, CCW) or Slot Locator Ring
  let outputGear = null;
  let outputSlotMarker = null;
  let outputDirectionArrow = null;
  let initialPhaseOutput = 0.0;
  if (selectedOutputTeeth) {
    outputGear = createSpurGear({
      teeth: selectedOutputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.50,
      color: 0xd0dce8, // Polished high-clarity mechanical steel
      metalness: 0.92,
      roughness: 0.22,
    });
    outputGear.position.set(0, shaftY, posZOutput);
    scene.add(outputGear);

    initialPhaseOutput = Math.PI / selectedOutputTeeth;
    outputGear.rotation.x = initialPhaseOutput;

    // Subtle CCW Direction Indicator Arrow
    const outArrowRadius = Math.max(0.85, outDim.pitchRadius * 0.70);
    outputDirectionArrow = createDirectionIndicator(outArrowRadius, false, 0x38bdf8);
    outputDirectionArrow.position.set(0.38, shaftY, posZOutput);
    scene.add(outputDirectionArrow);
  } else {
    // 3D Output Shaft Placement Slot Locator Ring
    const slotGeo = new THREE.TorusGeometry(0.65, 0.05, 12, 32);
    const slotMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      wireframe: true,
    });
    outputSlotMarker = new THREE.Mesh(slotGeo, slotMat);
    outputSlotMarker.rotation.y = Math.PI / 2;
    outputSlotMarker.position.set(0, shaftY, posZOutput);
    outputSlotMarker.userData = { isShaftSlot: true, slotType: 'output' };
    scene.add(outputSlotMarker);
  }

  // Phase 6: Contact point highlight flash at pitch line
  const flashGeo = new THREE.RingGeometry(0.12, 0.50, 24);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const engagementContactFlash = new THREE.Mesh(flashGeo, flashMat);
  engagementContactFlash.position.set(0, shaftY, (posZInput + posZOutput) * 0.5);
  scene.add(engagementContactFlash);

  // 12. Create Output Shaft (Polished chrome steel)
  const outputShaftTotalLength = casingInternalWidthX + 6.0;
  const outputShaftCenterX = 3.0;
  const outputShaft = createShaft({
    radius: 0.40,
    length: outputShaftTotalLength,
    color: 0xe8f0f8,
    metalness: 0.95,
    roughness: 0.15,
    hasCoupling: false,
  });
  outputShaft.position.set(outputShaftCenterX, shaftY, posZOutput);
  outputShaft.rotation.x = initialPhaseOutput;
  scene.add(outputShaft);

  // 13. Create Realistic Bearing Supports
  const bearingX = casingInternalWidthX * 0.5 - 0.40;

  // 13a. Input Shaft Bearings
  const inputSupportLeft = createShaftSupport({
    shaftRadius: 0.32,
    innerRadius: 0.33,
    outerRadius: 0.72,
    width: 0.34,
    ballCount: 10,
    targetShaft: 'input',
    housingColor: 0x32463e,
    flangeFacing: 1,
  });
  inputSupportLeft.position.set(-bearingX, shaftY, posZInput);
  scene.add(inputSupportLeft);
  bearingSupports.push(inputSupportLeft);

  const inputSupportRight = createShaftSupport({
    shaftRadius: 0.32,
    innerRadius: 0.33,
    outerRadius: 0.72,
    width: 0.34,
    ballCount: 10,
    targetShaft: 'input',
    housingColor: 0x32463e,
    flangeFacing: -1,
  });
  inputSupportRight.position.set(bearingX, shaftY, posZInput);
  scene.add(inputSupportRight);
  bearingSupports.push(inputSupportRight);

  // 13b. Output Shaft Bearings
  const outputSupportLeft = createShaftSupport({
    shaftRadius: 0.40,
    innerRadius: 0.41,
    outerRadius: 0.86,
    width: 0.38,
    ballCount: 10,
    targetShaft: 'output',
    housingColor: 0x32463e,
    flangeFacing: 1,
  });
  outputSupportLeft.position.set(-bearingX, shaftY, posZOutput);
  scene.add(outputSupportLeft);
  bearingSupports.push(outputSupportLeft);

  const outputSupportRight = createShaftSupport({
    shaftRadius: 0.40,
    innerRadius: 0.41,
    outerRadius: 0.86,
    width: 0.38,
    ballCount: 10,
    targetShaft: 'output',
    housingColor: 0x32463e,
    flangeFacing: -1,
  });
  outputSupportRight.position.set(bearingX, shaftY, posZOutput);
  scene.add(outputSupportRight);
  bearingSupports.push(outputSupportRight);

  // 14. 3D Visual Labels Group
  const labelsGroup = new THREE.Group();

  const labelMotor = createLabel('MOTOR', {
    borderColor: '#38bdf8',
    subtext: `${state.targetInputRPM.toFixed(0)} RPM • Drive Unit`,
    scale: 0.95,
  });
  labelMotor.position.set(motorX, shaftY + 2.5, posZInput);
  labelsGroup.add(labelMotor);

  const labelInShaft = createLabel('MOTOR SHAFT', {
    borderColor: '#e5a93c',
    subtext: 'Coupled • CW Rotation ↻',
    scale: 0.90,
  });
  labelInShaft.position.set(-inputShaftTotalLength * 0.4, shaftY + 1.4, posZInput);
  labelsGroup.add(labelInShaft);

  const labelInGear = createLabel('INPUT GEAR', {
    borderColor: '#e5a93c',
    subtext: selectedInputTeeth ? `${selectedInputTeeth}T Drive Gear • ↻ CW` : 'Unmounted • Bare Shaft',
    scale: 0.90,
  });
  labelInGear.position.set(0, shaftY + inDim.gearOuterRadius + 1.2, posZInput);
  labelsGroup.add(labelInGear);

  const labelOutGear = createLabel('OUTPUT GEAR', {
    borderColor: '#60a5fa',
    subtext: selectedOutputTeeth ? `${selectedOutputTeeth}T Driven Gear • ↺ CCW` : 'Unmounted • Bare Shaft',
    scale: 0.90,
  });
  labelOutGear.position.set(0, shaftY + outDim.gearOuterRadius + 1.2, posZOutput);
  labelsGroup.add(labelOutGear);

  const labelOutShaft = createLabel('MACHINE SHAFT', {
    borderColor: '#60a5fa',
    subtext: 'Output Drive • CCW Rotation ↺',
    scale: 0.90,
  });
  labelOutShaft.position.set(casingInternalWidthX * 0.5 + 2.8, shaftY + 1.4, posZOutput);
  labelsGroup.add(labelOutShaft);

  const labelGearbox = createLabel('GEARBOX', {
    borderColor: '#a3e635',
    subtext: 'Industrial Enclosure',
    scale: 0.95,
  });
  labelGearbox.position.set(0, casingInternalHeightY + 1.2, 0);
  labelsGroup.add(labelGearbox);

  const labelBearing = createLabel('BEARING SUPPORTS', {
    borderColor: '#c084fc',
    subtext: '4x Ball Bearings • Straddle Mount',
    scale: 0.90,
  });
  labelBearing.position.set(bearingX, shaftY + 1.8, posZInput);
  labelsGroup.add(labelBearing);

  scene.add(labelsGroup);

  // Update light glow positions
  updateGlowPositions(-1.0, shaftY + 3.0, posZInput, 1.0, shaftY + 3.0, posZOutput);

  // Expose bearing telemetry
  debugTelemetry.bearingSupports = {
    bearingX: Number(bearingX.toFixed(3)),
    inputLeft: { x: Number((-bearingX).toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) },
    inputRight: { x: Number(bearingX.toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) },
    outputLeft: { x: Number((-bearingX).toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) },
    outputRight: { x: Number(bearingX.toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) },
  };

  return {
    motor,
    motorShaft,
    inputShaft,
    outputShaft,
    inputGear,
    outputGear,
    inputSlotMarker,
    outputSlotMarker,
    inputDirectionArrow,
    outputDirectionArrow,
    gearboxCasing,
    labelsGroup,
    bearingSupports,
    inputSupportLeft,
    inputSupportRight,
    outputSupportLeft,
    outputSupportRight,
    initialPhaseOutput,
    currentShaftElevationY,
    shaftY,
    posZInput,
    posZOutput,
    inputPosition: new THREE.Vector3(0, shaftY, posZInput),
    outputPosition: new THREE.Vector3(0, shaftY, posZOutput),
    engagementContactFlash,
  };
}
