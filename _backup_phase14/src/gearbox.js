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
/**
 * Creates a complete industrial reduction gearbox housing enclosing the gear mechanism.
 * Features solid cast metal main housing, lower oil sump with foundation mounting feet,
 * machined bearing boss housings with oil seals and flange bolts, top cover with service hatch
 * and lifting eye, and a large transparent front inspection window with dark metallic bolted bezel.
 *
 * @param {Object} options - Housing dimensions and coordinates
 * @returns {THREE.Group} Complete industrial gearbox housing assembly
 */
export function createGearboxCasing(options = {}) {
  const {
    widthX = 2.6,
    heightY = 7.0,
    depthZ = 11.5,
    frameColor = 0x243b30, // Dark desaturated green / blue-green cast metal (classic machine enamel)
    panelColor = 0xe8f4fc, // Optical inspection acrylic with subtle neutral tint
    panelOpacity = 0.12,
    metalness = 0.25,
    roughness = 0.65,
  } = options;

  const casingGroup = new THREE.Group();
  const shaftY = options.shaftY || 4.2;
  const inputZ = options.inputZ !== undefined ? options.inputZ : -2.4;
  const outputZ = options.outputZ !== undefined ? options.outputZ : 2.4;

  const wallThick = 0.32;
  const halfW = widthX * 0.5;
  const halfD = depthZ * 0.5;
  const sumpH = 1.05;
  const casingTopY = heightY;

  // External overall dimensions
  const extW = widthX + wallThick * 2;
  const extD = depthZ + wallThick * 2;
  const extH = casingTopY;

  // --------------------------------------------------------------------------
  // Core Industrial Materials
  // --------------------------------------------------------------------------
  // Primary cast iron machine enamel (dark desaturated industrial green)
  const castMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: metalness,
    roughness: roughness,
  });

  // Darker recessed / structural cast iron
  const castDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1a2c22,
    metalness: 0.22,
    roughness: 0.72,
  });

  // Precision machined surfaces (split flange line, boss faces, seal retainers)
  const machinedMat = new THREE.MeshStandardMaterial({
    color: 0x647484,
    metalness: 0.88,
    roughness: 0.28,
  });

  // Dark metallic window bezel (gunmetal / nitrided steel)
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x1c2228,
    metalness: 0.88,
    roughness: 0.28,
  });

  // Zinc / chrome plated steel fasteners
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x7c8c9c,
    metalness: 0.90,
    roughness: 0.28,
  });
  const hexBoltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.10, 6);

  // Large industrial optical inspection glass/acrylic
  const windowMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    transparent: true,
    opacity: panelOpacity,
    roughness: 0.04,
    metalness: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Brass oil sight glass fitting
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xbfa038,
    metalness: 0.90,
    roughness: 0.26,
  });

  // Amber gear lubricating oil
  const oilMat = new THREE.MeshStandardMaterial({
    color: 0x996515,
    metalness: 0.30,
    roughness: 0.10,
  });

  // Industrial elastomeric oil lip seal
  const sealMat = new THREE.MeshStandardMaterial({
    color: 0x14181c,
    metalness: 0.15,
    roughness: 0.70,
  });

  // --------------------------------------------------------------------------
  // 1. Lower Machine Bed / Oil Sump Housing & Mounting Feet
  // --------------------------------------------------------------------------
  // Solid cast machine base bed (resting solidly on factory floor at Y = 0)
  const sumpGeo = new THREE.BoxGeometry(extW + 0.12, sumpH, extD + 0.12);
  const sumpMesh = new THREE.Mesh(sumpGeo, castMat);
  sumpMesh.position.set(0, sumpH * 0.5, 0);
  sumpMesh.castShadow = true;
  sumpMesh.receiveShadow = true;
  casingGroup.add(sumpMesh);

  // Lower flared skirting flange
  const skirtH = 0.28;
  const skirtGeo = new THREE.BoxGeometry(extW + 0.44, skirtH, extD + 0.44);
  const skirtMesh = new THREE.Mesh(skirtGeo, castDarkMat);
  skirtMesh.position.set(0, skirtH * 0.5, 0);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  casingGroup.add(skirtMesh);

  // Four Heavy Cast Corner Mounting Feet with foundation anchor bolts
  const footW = 0.72;
  const footH = 0.26;
  const footD = 0.72;
  const footGeo = new THREE.BoxGeometry(footW, footH, footD);
  const anchorBoltGeo = new THREE.CylinderGeometry(0.075, 0.075, footH + 0.16, 16);
  const washerGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16);

  const footXPos = [-extW * 0.5 - footW * 0.22, extW * 0.5 + footW * 0.22];
  const footZPos = [-extD * 0.5 + footD * 0.35, extD * 0.5 - footD * 0.35];

  for (const fx of footXPos) {
    for (const fz of footZPos) {
      // Cast mounting foot pad
      const foot = new THREE.Mesh(footGeo, castMat);
      foot.position.set(fx, footH * 0.5, fz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      casingGroup.add(foot);

      // Foot vertical reinforcing gusset
      const gussetGeo = new THREE.BoxGeometry(0.12, sumpH * 0.65, 0.32);
      const gusset = new THREE.Mesh(gussetGeo, castMat);
      const gussetX = fx > 0 ? fx - footW * 0.32 : fx + footW * 0.32;
      gusset.position.set(gussetX, sumpH * 0.40, fz);
      casingGroup.add(gusset);

      // Steel foundation anchor bolt, washer & hex nut
      const washer = new THREE.Mesh(washerGeo, boltMat);
      washer.position.set(fx, footH + 0.02, fz);
      casingGroup.add(washer);

      const bolt = new THREE.Mesh(anchorBoltGeo, boltMat);
      bolt.position.set(fx, footH * 0.5 + 0.08, fz);
      bolt.castShadow = true;
      casingGroup.add(bolt);
    }
  }

  // Oil Level Sight Glass on Front Sump Face (below window)
  const sightX = -halfW - wallThick - 0.08;
  const sightZ = (inputZ + outputZ) * 0.5 + 0.65;
  const sightBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20),
    brassMat
  );
  sightBase.rotation.z = Math.PI / 2;
  sightBase.position.set(sightX, sumpH * 0.65, sightZ);
  casingGroup.add(sightBase);

  const sightWindow = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 20),
    oilMat
  );
  sightWindow.rotation.y = -Math.PI / 2;
  sightWindow.position.set(sightX - 0.045, sumpH * 0.65, sightZ);
  casingGroup.add(sightWindow);

  // Magnetic Oil Drain Plug on Lower Front
  const drainPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.10, 6),
    boltMat
  );
  drainPlug.rotation.z = Math.PI / 2;
  drainPlug.position.set(sightX, 0.35, (inputZ + outputZ) * 0.5 - 0.65);
  casingGroup.add(drainPlug);

  // --------------------------------------------------------------------------
  // 2. Horizontal Split Parting Line Flange (Shaft Centerline Y = shaftY)
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 2. Horizontal Split Parting Line Flange (Shaft Centerline Y = shaftY)
  // --------------------------------------------------------------------------
  const partFlangeH = 0.16;

  // Rear full continuous parting rail
  const pRailBack = new THREE.Mesh(new THREE.BoxGeometry(0.14, partFlangeH, extD + 0.20), machinedMat);
  pRailBack.position.set(halfW + wallThick + 0.07, shaftY, 0);
  casingGroup.add(pRailBack);

  // --------------------------------------------------------------------------
  // 3. Front Machine Face (-X side facing camera) with 50-60% INSPECTION WINDOW
  // --------------------------------------------------------------------------
  const sideWallH = casingTopY - sumpH;
  const winCenterZ = (inputZ + outputZ) * 0.5;

  // Window opening dimensions: generously frames both gears without cutting off top or bottom teeth
  const winTopMargin = 0.52;
  const winMaxY = casingTopY - winTopMargin;
  const winMinY = Math.max(sumpH + 0.35, shaftY - (casingTopY - shaftY) + 0.25);
  const winH = winMaxY - winMinY;

  const winSideMargin = Math.max(1.5, extD * 0.18);
  const winW = extD - winSideMargin * 2;
  const winMinZ = winCenterZ - winW * 0.5;
  const winMaxZ = winCenterZ + winW * 0.5;

  const frontX = -halfW - wallThick * 0.5;

  // Front Split Parting Rails (ONLY on solid bulkheads outside the window, never across the glass!)
  const leftRailD = Math.max(0.1, winMinZ - (-halfD - wallThick));
  if (leftRailD > 0.15) {
    const pRailLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, partFlangeH, leftRailD), machinedMat);
    pRailLeft.position.set(-halfW - wallThick - 0.07, shaftY, (-halfD - wallThick) + leftRailD * 0.5);
    casingGroup.add(pRailLeft);
  }
  const rightRailD = Math.max(0.1, (halfD + wallThick) - winMaxZ);
  if (rightRailD > 0.15) {
    const pRailRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, partFlangeH, rightRailD), machinedMat);
    pRailRight.position.set(-halfW - wallThick - 0.07, shaftY, (halfD + wallThick) - rightRailD * 0.5);
    casingGroup.add(pRailRight);
  }

  // Parting line clamping hex bolts along split rails
  const numSplitBolts = Math.max(4, Math.floor(extD / 1.6));
  for (let i = 0; i < numSplitBolts; i++) {
    const bz = -extD * 0.44 + (i / (numSplitBolts - 1)) * extD * 0.88;
    // Rear bolts
    const bBack = new THREE.Mesh(hexBoltGeo, boltMat);
    bBack.position.set(halfW + wallThick + 0.14, shaftY + 0.04, bz);
    casingGroup.add(bBack);

    // Front bolts only outside the window
    if (bz < winMinZ - 0.2 || bz > winMaxZ + 0.2) {
      const bFront = new THREE.Mesh(hexBoltGeo, boltMat);
      bFront.position.set(-halfW - wallThick - 0.14, shaftY + 0.04, bz);
      casingGroup.add(bFront);
    }
  }

  // Front Left Solid Bulkhead (from left end to window)
  const leftBulkheadD = winMinZ - (-halfD - wallThick);
  if (leftBulkheadD > 0.1) {
    const leftBulkhead = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, sideWallH, leftBulkheadD),
      castMat
    );
    leftBulkhead.position.set(frontX, sumpH + sideWallH * 0.5, (-halfD - wallThick) + leftBulkheadD * 0.5);
    leftBulkhead.castShadow = true;
    leftBulkhead.receiveShadow = true;
    casingGroup.add(leftBulkhead);
  }

  // Front Right Solid Bulkhead (from window to right end)
  const rightBulkheadD = (halfD + wallThick) - winMaxZ;
  if (rightBulkheadD > 0.1) {
    const rightBulkhead = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, sideWallH, rightBulkheadD),
      castMat
    );
    rightBulkhead.position.set(frontX, sumpH + sideWallH * 0.5, (halfD + wallThick) - rightBulkheadD * 0.5);
    rightBulkhead.castShadow = true;
    rightBulkhead.receiveShadow = true;
    casingGroup.add(rightBulkhead);
  }

  // Front Lower Solid Apron (below the window, above the sump)
  const apronH = winMinY - sumpH;
  if (apronH > 0.1) {
    const apron = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, apronH, winW),
      castMat
    );
    apron.position.set(frontX, sumpH + apronH * 0.5, winCenterZ);
    apron.castShadow = true;
    apron.receiveShadow = true;
    casingGroup.add(apron);
  }

  // Front Upper Solid Header (above the window, below the top cover)
  const headerH = casingTopY - winMaxY;
  if (headerH > 0.1) {
    const header = new THREE.Mesh(
      new THREE.BoxGeometry(wallThick, headerH, winW),
      castMat
    );
    header.position.set(frontX, casingTopY - headerH * 0.5, winCenterZ);
    header.castShadow = true;
    header.receiveShadow = true;
    casingGroup.add(header);
  }

  // Front Bearing Boss: Input Shaft Pass-Through Housing (Motor Drive Side)
  // Precision machined flanged collar around the input drive shaft entry
  const bossRadius = 0.54;
  const bossLength = 0.42;
  const frontBossGeo = new THREE.CylinderGeometry(bossRadius, bossRadius + 0.05, bossLength, 28);
  const frontBossMesh = new THREE.Mesh(frontBossGeo, castMat);
  frontBossMesh.rotation.z = Math.PI / 2;
  frontBossMesh.position.set(-halfW - wallThick - bossLength * 0.5, shaftY, inputZ);
  frontBossMesh.castShadow = true;
  frontBossMesh.receiveShadow = true;
  casingGroup.add(frontBossMesh);

  // Machined Bearing Retaining Flange Collar
  const flangeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(bossRadius + 0.12, bossRadius + 0.12, 0.08, 28),
    machinedMat
  );
  flangeCollar.rotation.z = Math.PI / 2;
  flangeCollar.position.set(-halfW - wallThick - bossLength + 0.04, shaftY, inputZ);
  flangeCollar.castShadow = true;
  casingGroup.add(flangeCollar);

  // Rubber lip oil seal ring
  const sealRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.038, 12, 28),
    sealMat
  );
  sealRing.rotation.y = Math.PI / 2;
  sealRing.position.set(-halfW - wallThick - bossLength - 0.01, shaftY, inputZ);
  casingGroup.add(sealRing);

  // 6 Radial Retaining Hex Bolts around Input Bearing Flange
  const boltCircleR = bossRadius + 0.07;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * boltCircleR;
    const bz = Math.cos(angle) * boltCircleR;
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(-halfW - wallThick - bossLength + 0.08, shaftY + by, inputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // --------------------------------------------------------------------------
  // 4. Framed 50-60% Transparent Inspection Window
  // --------------------------------------------------------------------------
  const winX = -halfW - wallThick - 0.02;
  const bezelThick = 0.12;
  const bezelDepth = 0.08;

  // Dark Nitrided Steel Bezel Frame Bars
  // Top Bezel Bar
  const bTop = new THREE.Mesh(new THREE.BoxGeometry(bezelDepth, bezelThick, winW + bezelThick * 2), bezelMat);
  bTop.position.set(winX - 0.02, winMaxY + bezelThick * 0.5, winCenterZ);
  casingGroup.add(bTop);

  // Bottom Bezel Bar
  const bBot = new THREE.Mesh(new THREE.BoxGeometry(bezelDepth, bezelThick, winW + bezelThick * 2), bezelMat);
  bBot.position.set(winX - 0.02, winMinY - bezelThick * 0.5, winCenterZ);
  casingGroup.add(bBot);

  // Left Bezel Bar
  const bLeft = new THREE.Mesh(new THREE.BoxGeometry(bezelDepth, winH, bezelThick), bezelMat);
  bLeft.position.set(winX - 0.02, shaftY, winMinZ - bezelThick * 0.5);
  casingGroup.add(bLeft);

  // Right Bezel Bar
  const bRight = new THREE.Mesh(new THREE.BoxGeometry(bezelDepth, winH, bezelThick), bezelMat);
  bRight.position.set(winX - 0.02, shaftY, winMaxZ + bezelThick * 0.5);
  casingGroup.add(bRight);

  // 8 Perimeter Hex Clamping Bolts around Window Frame
  const frameBoltZ = [-winW * 0.35, 0, winW * 0.35];
  for (const fz of frameBoltZ) {
    const bT = new THREE.Mesh(hexBoltGeo, boltMat);
    bT.rotation.z = Math.PI / 2;
    bT.position.set(winX - 0.06, winMaxY + bezelThick * 0.5, winCenterZ + fz);
    casingGroup.add(bT);

    const bB = new THREE.Mesh(hexBoltGeo, boltMat);
    bB.rotation.z = Math.PI / 2;
    bB.position.set(winX - 0.06, winMinY - bezelThick * 0.5, winCenterZ + fz);
    casingGroup.add(bB);
  }

  // Transparent Optical Glass Pane
  const glassGeo = new THREE.PlaneGeometry(winW, winH);
  const glassMesh = new THREE.Mesh(glassGeo, windowMat);
  glassMesh.rotation.y = -Math.PI / 2;
  glassMesh.position.set(winX - 0.01, shaftY, winCenterZ);
  casingGroup.add(glassMesh);

  // Internal Warm Spotlight illuminating the bright steel gears from within
  const intGearLight = new THREE.PointLight(0xffedd5, 1.8, 10, 1.2);
  intGearLight.position.set(0, shaftY + 0.3, winCenterZ);
  casingGroup.add(intGearLight);

  // --------------------------------------------------------------------------
  // 5. Rear Machine Face (+X side) with Output Bearing Housing Boss
  // --------------------------------------------------------------------------
  const backX = halfW + wallThick * 0.5;

  // Solid Rear Cast Bulkhead Wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, sideWallH, extD),
    castMat
  );
  backWall.position.set(backX, sumpH + sideWallH * 0.5, 0);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  casingGroup.add(backWall);

  // Rear Bearing Boss: Output Shaft Pass-Through Housing (Driven Machine Side)
  const outBossRadius = 0.96;
  const outBossLength = 0.46;
  const rearBossGeo = new THREE.CylinderGeometry(outBossRadius, outBossRadius + 0.06, outBossLength, 32);
  const rearBossMesh = new THREE.Mesh(rearBossGeo, castMat);
  rearBossMesh.rotation.z = -Math.PI / 2;
  rearBossMesh.position.set(halfW + wallThick + outBossLength * 0.5, shaftY, outputZ);
  rearBossMesh.castShadow = true;
  rearBossMesh.receiveShadow = true;
  casingGroup.add(rearBossMesh);

  // Machined Output Flange Collar
  const outFlangeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(outBossRadius + 0.16, outBossRadius + 0.16, 0.10, 32),
    machinedMat
  );
  outFlangeCollar.rotation.z = -Math.PI / 2;
  outFlangeCollar.position.set(halfW + wallThick + outBossLength - 0.05, shaftY, outputZ);
  outFlangeCollar.castShadow = true;
  casingGroup.add(outFlangeCollar);

  // Rubber lip oil seal ring
  const outSealRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.40, 0.045, 12, 28),
    sealMat
  );
  outSealRing.rotation.y = Math.PI / 2;
  outSealRing.position.set(halfW + wallThick + outBossLength + 0.01, shaftY, outputZ);
  casingGroup.add(outSealRing);

  // 6 Radial Retaining Hex Bolts around Output Flange
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * (outBossRadius + 0.08);
    const bz = Math.cos(angle) * (outBossRadius + 0.08);
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = -Math.PI / 2;
    b.position.set(halfW + wallThick + outBossLength - 0.09, shaftY + by, outputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // Rear Input Shaft Blind Bearing Hub (dead-end cover for input shaft on rear)
  const blindBossGeo = new THREE.CylinderGeometry(0.82, 0.88, 0.28, 28);
  const rearBlindBoss = new THREE.Mesh(blindBossGeo, castMat);
  rearBlindBoss.rotation.z = -Math.PI / 2;
  rearBlindBoss.position.set(halfW + wallThick + 0.14, shaftY, inputZ);
  rearBlindBoss.castShadow = true;
  casingGroup.add(rearBlindBoss);

  const rearBlindFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.92, 0.92, 0.08, 28),
    machinedMat
  );
  rearBlindFlange.rotation.z = -Math.PI / 2;
  rearBlindFlange.position.set(halfW + wallThick + 0.28, shaftY, inputZ);
  casingGroup.add(rearBlindFlange);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * 0.74;
    const bz = Math.cos(angle) * 0.74;
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = -Math.PI / 2;
    b.position.set(halfW + wallThick + 0.32, shaftY + by, inputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // Rear Vertical Reinforcing Ribs
  const rearRibGeo = new THREE.BoxGeometry(0.14, sideWallH - 0.6, 0.16);
  const rearRibZs = [-extD * 0.28, 0, extD * 0.28];
  for (const rz of rearRibZs) {
    const rib = new THREE.Mesh(rearRibGeo, castDarkMat);
    rib.position.set(backX + wallThick * 0.5 + 0.07, sumpH + sideWallH * 0.5, rz);
    casingGroup.add(rib);
  }

  // --------------------------------------------------------------------------
  // 6. Left and Right End Bulkhead Walls (-Z and +Z)
  // --------------------------------------------------------------------------
  const endWallGeo = new THREE.BoxGeometry(widthX, sideWallH, wallThick);

  // Left End Wall (-Z)
  const leftEndWall = new THREE.Mesh(endWallGeo, castMat);
  leftEndWall.position.set(0, sumpH + sideWallH * 0.5, -halfD - wallThick * 0.5);
  leftEndWall.castShadow = true;
  leftEndWall.receiveShadow = true;
  casingGroup.add(leftEndWall);

  // Right End Wall (+Z)
  const rightEndWall = new THREE.Mesh(endWallGeo, castMat);
  rightEndWall.position.set(0, sumpH + sideWallH * 0.5, halfD + wallThick * 0.5);
  rightEndWall.castShadow = true;
  rightEndWall.receiveShadow = true;
  casingGroup.add(rightEndWall);

  // Industrial specification / rating plate on Right End Wall (+Z)
  const nameplateW = Math.min(widthX * 0.65, 1.8);
  const nameplateH = 0.65;
  const nameplateGeo = new THREE.BoxGeometry(nameplateW, nameplateH, 0.03);
  const nameplateMat = new THREE.MeshStandardMaterial({
    color: 0x4a5a6a,
    metalness: 0.88,
    roughness: 0.30,
  });
  const nameplateMesh = new THREE.Mesh(nameplateGeo, nameplateMat);
  nameplateMesh.position.set(0, shaftY + 0.5, halfD + wallThick + 0.02);
  casingGroup.add(nameplateMesh);

  // Nameplate corner rivets
  const npx = nameplateW * 0.42;
  const npy = nameplateH * 0.38;
  const plateRivets = [[-npx, -npy], [npx, -npy], [-npx, npy], [npx, npy]];
  for (const [px, py] of plateRivets) {
    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      boltMat
    );
    rivet.position.set(px, shaftY + 0.5 + py, halfD + wallThick + 0.04);
    casingGroup.add(rivet);
  }

  // --------------------------------------------------------------------------
  // 7. Top Housing Cover, Service Hatch & Lifting Eye
  // --------------------------------------------------------------------------
  const topCoverH = 0.36;
  const topCoverW = extW + 0.16;
  const topCoverD = extD + 0.16;

  // Solid Cast Machine Crown / Roof
  const topCrownGeo = new THREE.BoxGeometry(topCoverW, topCoverH, topCoverD);
  const topCrownMesh = new THREE.Mesh(topCrownGeo, castMat);
  topCrownMesh.position.set(0, casingTopY + topCoverH * 0.5, 0);
  topCrownMesh.castShadow = true;
  topCrownMesh.receiveShadow = true;
  casingGroup.add(topCrownMesh);

  // Chamfered upper casting drafts (giving the gearbox sloped, manufactured shoulders)
  const draftGeo = new THREE.BoxGeometry(topCoverW - 0.20, 0.18, topCoverD - 0.20);
  const draftMesh = new THREE.Mesh(draftGeo, castDarkMat);
  draftMesh.position.set(0, casingTopY + topCoverH + 0.09, 0);
  casingGroup.add(draftMesh);

  // Raised Top Inspection Service Access Hatch
  const hatchW = Math.min(widthX * 0.60, 1.8);
  const hatchD = Math.min(depthZ * 0.28, 2.4);
  const hatchPlateGeo = new THREE.BoxGeometry(hatchW, 0.08, hatchD);
  const hatchPlateMesh = new THREE.Mesh(hatchPlateGeo, machinedMat);
  hatchPlateMesh.position.set(0, casingTopY + topCoverH + 0.18 + 0.04, 0);
  hatchPlateMesh.castShadow = true;
  hatchPlateMesh.receiveShadow = true;
  casingGroup.add(hatchPlateMesh);

  // Hatch Fastener Bolts (6 perimeter bolts)
  const hbx = hatchW * 0.38;
  const hbz = hatchD * 0.38;
  const hatchBolts = [
    [-hbx, -hbz], [0, -hbz], [hbx, -hbz],
    [-hbx, hbz], [0, hbz], [hbx, hbz]
  ];
  for (const [cx, cz] of hatchBolts) {
    const hBolt = new THREE.Mesh(hexBoltGeo, boltMat);
    hBolt.position.set(cx, casingTopY + topCoverH + 0.18 + 0.08, cz);
    hBolt.castShadow = true;
    casingGroup.add(hBolt);
  }

  // Heavy Drop-Forged Steel Lifting Eye Bolt
  const eyeBaseGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.12, 20);
  const eyeBase = new THREE.Mesh(eyeBaseGeo, machinedMat);
  eyeBase.position.set(0, casingTopY + topCoverH + 0.18 + 0.06, 0);
  eyeBase.castShadow = true;
  casingGroup.add(eyeBase);

  const eyeTorusGeo = new THREE.TorusGeometry(0.24, 0.07, 16, 28);
  const eyeTorus = new THREE.Mesh(eyeTorusGeo, boltMat);
  eyeTorus.position.set(0, casingTopY + topCoverH + 0.18 + 0.28, 0);
  eyeTorus.castShadow = true;
  casingGroup.add(eyeTorus);

  // --------------------------------------------------------------------------
  // 8. Non-Blocking Raycasting Guarantee
  // --------------------------------------------------------------------------
  // Ensure that no mesh in the casing blocks or consumes raycasting events
  // so gear drag-and-drop, shaft clicks, and drop targets function flawlessly.
  casingGroup.traverse((child) => {
    if (child.isMesh) {
      child.raycast = () => {};
    }
  });

  casingGroup.userData = {
    type: 'gearbox_casing',
    widthX,
    heightY,
    depthZ,
    shaftY,
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

  // Safe compact clearance around every gear (enforces compact heavy gearbox)
  const safeClearance = 0.55;

  // 2. Shaft Elevation Y: Guarantees safe bottom clearance above floor sump
  const floorRailHeight = 0.38;
  const currentShaftElevationY = maxGearOuterRadius + safeClearance + floorRailHeight;
  const shaftY = currentShaftElevationY;

  // 3. Parallel Shaft Z Positions
  const totalGearSpanZ = centerDistance + inDim.gearOuterRadius + outDim.gearOuterRadius;
  const halfGearSpanZ = totalGearSpanZ * 0.5;

  const posZInput = -halfGearSpanZ + inDim.gearOuterRadius;
  const posZOutput = +halfGearSpanZ - outDim.gearOuterRadius;

  // 4. Calculate Casing Internal Dimensions (Width:Height ratio target: 1.65)
  const casingInternalWidthX = Math.max(2.4, inDim.hubThickness + 1.2);
  const casingInternalHeightY = shaftY + maxGearOuterRadius + safeClearance;
  const targetRatio = 1.65;
  const casingInternalDepthZ = Math.max(totalGearSpanZ + safeClearance * 2, casingInternalHeightY * targetRatio - 0.6);

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
  // Deep industrial blue cast housing firmly anchored to factory floor
  const motorLength = 2.6;
  const motorFlangeLength = 0.18;
  const motorShaftLength = 1.1;
  const motorFrontFlangeX = -casingInternalWidthX * 0.5 - 2.2;
  const motorX = motorFrontFlangeX - motorLength * 0.5 - motorFlangeLength;
  const motor = createMotor({
    radius: 1.25,
    length: motorLength,
    shaftY: shaftY,
    bodyColor: 0x163452, // Deep industrial machine blue
    endCoverColor: 0x102236,
    flangeColor: 0x1b3c5e,
    shaftRadius: 0.32,
    shaftLength: motorShaftLength,
  });
  motor.position.set(motorX, shaftY, posZInput);
  scene.add(motor);
  const motorShaft = motor.userData.shaftGroup;

  // 9. Create Input Shaft (Polished chrome turned steel)
  // Connecting Motor -> Coupling -> Input Bearing Boss -> Gearbox
  const couplingContactX = motorFrontFlangeX + motorShaftLength; // motor shaft tip
  const inputShaftTotalLength = Math.abs(couplingContactX) + casingInternalWidthX * 0.5 + 0.4;
  const inputShaftCenterX = couplingContactX + inputShaftTotalLength * 0.5;
  const inputShaft = createShaft({
    radius: 0.32,
    length: inputShaftTotalLength,
    color: 0xd4e2ee, // Bright polished steel
    metalness: 0.96,
    roughness: 0.16,
    hasCoupling: true,
  });
  inputShaft.position.set(inputShaftCenterX, shaftY, posZInput);
  scene.add(inputShaft);

  // 10. Create Input Gear (Bright polished steel, CW) or Slot Locator Ring
  let inputGear = null;
  let inputSlotMarker = null;
  let inputDirectionArrow = null;
  if (selectedInputTeeth) {
    inputGear = createSpurGear({
      teeth: selectedInputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.42,
      color: 0xc8d6e5, // Bright polished steel
      metalness: 0.95,
      roughness: 0.18,
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

  // 11. Create Output Gear (Hardened alloy gear steel, CCW) or Slot Locator Ring
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
      color: 0xc8d6e5, // Bright polished steel
      metalness: 0.95,
      roughness: 0.18,
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
