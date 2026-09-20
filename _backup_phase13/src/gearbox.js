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
    heightY = 6.4,
    depthZ = 7.2,
    frameColor = 0x274035, // Dark desaturated green cast metal (classic machine enamel)
    panelColor = 0x9ec7eb, // Optical inspection acrylic
    panelOpacity = 0.16,
    metalness = 0.44,
    roughness = 0.58,
  } = options;

  const casingGroup = new THREE.Group();
  const shaftY = options.shaftY || 3.6;
  const inputZ = options.inputZ !== undefined ? options.inputZ : -2.4;
  const outputZ = options.outputZ !== undefined ? options.outputZ : 2.4;

  const wallThick = 0.36;
  const halfW = widthX * 0.5;
  const halfD = depthZ * 0.5;
  const sumpH = 1.35;
  const casingTopY = heightY;

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
    color: 0x1d3027,
    metalness: 0.38,
    roughness: 0.65,
  });

  // Precision machined surfaces (boss faces, seal retainers, split flange line)
  const machinedMat = new THREE.MeshStandardMaterial({
    color: 0x6e7e8c,
    metalness: 0.90,
    roughness: 0.28,
  });

  // Dark metallic window bezel (gunmetal / nitrided steel)
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x20272e,
    metalness: 0.86,
    roughness: 0.30,
  });

  // Zinc / chrome plated steel fasteners
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x8a97a8,
    metalness: 0.92,
    roughness: 0.26,
  });
  const hexBoltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.10, 6);

  // Large industrial optical inspection glass/acrylic
  const windowMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    transparent: true,
    opacity: panelOpacity,
    roughness: 0.05,
    metalness: 0.20,
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
  const baseW = widthX + wallThick * 2 + 0.30;
  const baseD = depthZ + wallThick * 2 + 0.30;

  // Solid cast machine base block (sitting solidly on factory floor at Y = 0)
  const sumpGeo = new THREE.BoxGeometry(baseW, sumpH, baseD);
  const sumpMesh = new THREE.Mesh(sumpGeo, castMat);
  sumpMesh.position.set(0, sumpH * 0.5, 0);
  sumpMesh.castShadow = true;
  sumpMesh.receiveShadow = true;
  casingGroup.add(sumpMesh);

  // Lower flared skirting flange
  const skirtH = 0.32;
  const skirtGeo = new THREE.BoxGeometry(baseW + 0.45, skirtH, baseD + 0.45);
  const skirtMesh = new THREE.Mesh(skirtGeo, castDarkMat);
  skirtMesh.position.set(0, skirtH * 0.5, 0);
  skirtMesh.castShadow = true;
  skirtMesh.receiveShadow = true;
  casingGroup.add(skirtMesh);

  // Four Heavy Cast Mounting Feet with foundation anchor bolts
  const footW = 0.78;
  const footH = 0.28;
  const footD = 0.78;
  const footGeo = new THREE.BoxGeometry(footW, footH, footD);
  const anchorBoltGeo = new THREE.CylinderGeometry(0.08, 0.08, footH + 0.16, 16);
  const washerGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16);

  const footXPos = [-baseW * 0.5 - footW * 0.30, baseW * 0.5 + footW * 0.30];
  const footZPos = [-baseD * 0.5 + footD * 0.40, baseD * 0.5 - footD * 0.40];

  for (const fx of footXPos) {
    for (const fz of footZPos) {
      // Cast mounting foot pad
      const foot = new THREE.Mesh(footGeo, castMat);
      foot.position.set(fx, footH * 0.5, fz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      casingGroup.add(foot);

      // Foot vertical reinforcing gusset
      const gussetGeo = new THREE.BoxGeometry(0.12, sumpH * 0.70, 0.35);
      const gusset = new THREE.Mesh(gussetGeo, castMat);
      const gussetX = fx > 0 ? fx - footW * 0.35 : fx + footW * 0.35;
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

  // Oil Level Sight Glass on Front Sump Face
  const sightZ = halfD + wallThick + 0.16;
  const sightBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.20, 0.08, 20),
    brassMat
  );
  sightBase.rotation.x = Math.PI / 2;
  sightBase.position.set(halfW * 0.35, sumpH * 0.65, sightZ);
  casingGroup.add(sightBase);

  const sightWindow = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 20),
    oilMat
  );
  sightWindow.position.set(halfW * 0.35, sumpH * 0.65, sightZ + 0.045);
  casingGroup.add(sightWindow);

  // Magnetic Oil Drain Plug on Lower Front
  const drainPlug = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.12, 6),
    boltMat
  );
  drainPlug.rotation.x = Math.PI / 2;
  drainPlug.position.set(-halfW * 0.35, 0.35, sightZ);
  casingGroup.add(drainPlug);

  // --------------------------------------------------------------------------
  // 2. Solid Rear Housing Wall with Structural Stiffener Ribs
  // --------------------------------------------------------------------------
  const backWallH = casingTopY - sumpH;
  const backWallGeo = new THREE.BoxGeometry(widthX + wallThick * 2, backWallH, wallThick);
  const backWallMesh = new THREE.Mesh(backWallGeo, castMat);
  backWallMesh.position.set(0, sumpH + backWallH * 0.5, -halfD - wallThick * 0.5);
  backWallMesh.castShadow = true;
  backWallMesh.receiveShadow = true;
  casingGroup.add(backWallMesh);

  // Vertical structural reinforcing ribs on rear casting
  const ribZ = -halfD - wallThick - 0.06;
  const vRibGeo = new THREE.BoxGeometry(0.18, backWallH - 0.40, 0.12);
  const ribXs = [-halfW * 0.65, 0, halfW * 0.65];
  for (const rx of ribXs) {
    const vRib = new THREE.Mesh(vRibGeo, castDarkMat);
    vRib.position.set(rx, sumpH + backWallH * 0.5, ribZ);
    vRib.castShadow = true;
    casingGroup.add(vRib);
  }

  // Industrial specification / rating plate with corner rivets
  const nameplateGeo = new THREE.BoxGeometry(Math.min(widthX * 0.55, 2.2), 0.75, 0.03);
  const nameplateMat = new THREE.MeshStandardMaterial({
    color: 0x485868,
    metalness: 0.88,
    roughness: 0.32,
  });
  const nameplateMesh = new THREE.Mesh(nameplateGeo, nameplateMat);
  nameplateMesh.position.set(0, shaftY + 0.8, ribZ - 0.02);
  casingGroup.add(nameplateMesh);

  const npx = Math.min(widthX * 0.55, 2.2) * 0.42;
  const npy = 0.75 * 0.38;
  const plateRivets = [[-npx, -npy], [npx, -npy], [-npx, npy], [npx, npy]];
  for (const [px, py] of plateRivets) {
    const rivet = new THREE.Mesh(
      new THREE.SphereGeometry(0.032, 8, 8),
      boltMat
    );
    rivet.position.set(px, shaftY + 0.8 + py, ribZ - 0.04);
    casingGroup.add(rivet);
  }

  // --------------------------------------------------------------------------
  // 3. Solid Left Housing Section & Input Bearing Housing Boss
  // --------------------------------------------------------------------------
  const sideWallH = casingTopY - sumpH;
  const sideWallD = depthZ + wallThick * 2;

  // Solid Left Structural Bulkhead Frame (with authentic open viewing port into gears)
  const leftApronH = Math.max(0.4, (shaftY - 1.25) - sumpH);
  const leftApron = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, leftApronH, sideWallD),
    castMat
  );
  leftApron.position.set(-halfW - wallThick * 0.5, sumpH + leftApronH * 0.5, 0);
  leftApron.castShadow = true;
  leftApron.receiveShadow = true;
  casingGroup.add(leftApron);

  const leftHeaderH = 0.80;
  const leftHeader = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, leftHeaderH, sideWallD),
    castMat
  );
  leftHeader.position.set(-halfW - wallThick * 0.5, casingTopY - leftHeaderH * 0.5, 0);
  leftHeader.castShadow = true;
  leftHeader.receiveShadow = true;
  casingGroup.add(leftHeader);

  // Left Rear Corner Pillar (behind input bearing boss)
  const leftRearPillarD = Math.max(0.4, (inputZ - 0.95) - (-halfD - wallThick));
  const leftMidH = casingTopY - leftHeaderH - (sumpH + leftApronH);
  const leftMidY = (sumpH + leftApronH) + leftMidH * 0.5;

  const leftRearPillar = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, leftMidH, leftRearPillarD),
    castMat
  );
  leftRearPillar.position.set(
    -halfW - wallThick * 0.5,
    leftMidY,
    (-halfD - wallThick) + leftRearPillarD * 0.5
  );
  leftRearPillar.castShadow = true;
  leftRearPillar.receiveShadow = true;
  casingGroup.add(leftRearPillar);

  // Left Front Corner Pillar (in front of output blind boss)
  const leftFrontPillarD = Math.max(0.4, (halfD + wallThick) - (outputZ + 0.95));
  const leftFrontPillar = new THREE.Mesh(
    new THREE.BoxGeometry(wallThick, leftMidH, leftFrontPillarD),
    castMat
  );
  leftFrontPillar.position.set(
    -halfW - wallThick * 0.5,
    leftMidY,
    (halfD + wallThick) - leftFrontPillarD * 0.5
  );
  leftFrontPillar.castShadow = true;
  leftFrontPillar.receiveShadow = true;
  casingGroup.add(leftFrontPillar);

  // Left Bearing Boss — Input Shaft Pass-Through Housing (Motor Drive Side)
  const bossRadius = 0.94;
  const bossLength = 0.48;
  const leftBossGeo = new THREE.CylinderGeometry(bossRadius, bossRadius + 0.08, bossLength, 32);
  const leftBossMesh = new THREE.Mesh(leftBossGeo, castMat);
  leftBossMesh.rotation.z = Math.PI / 2;
  leftBossMesh.position.set(-halfW - wallThick - bossLength * 0.5, shaftY, inputZ);
  leftBossMesh.castShadow = true;
  leftBossMesh.receiveShadow = true;
  casingGroup.add(leftBossMesh);

  // Machined Bearing Retaining Flange Collar
  const flangeCollarGeo = new THREE.CylinderGeometry(bossRadius + 0.18, bossRadius + 0.18, 0.10, 32);
  const flangeCollar = new THREE.Mesh(flangeCollarGeo, machinedMat);
  flangeCollar.rotation.z = Math.PI / 2;
  flangeCollar.position.set(-halfW - wallThick - bossLength + 0.05, shaftY, inputZ);
  flangeCollar.castShadow = true;
  casingGroup.add(flangeCollar);

  // Nitrile rubber oil lip seal ring surrounding input shaft
  const sealRingGeo = new THREE.TorusGeometry(0.38, 0.05, 12, 28);
  const sealRing = new THREE.Mesh(sealRingGeo, sealMat);
  sealRing.rotation.y = Math.PI / 2;
  sealRing.position.set(-halfW - wallThick - bossLength - 0.01, shaftY, inputZ);
  casingGroup.add(sealRing);

  // 6 Radial Retaining Hex Bolts around Input Flange
  const boltCircleR = bossRadius + 0.08;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * boltCircleR;
    const bz = Math.cos(angle) * boltCircleR;
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(-halfW - wallThick - bossLength + 0.10, shaftY + by, inputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // Left Output Shaft Blind Bearing Hub (Dead-End Bearing Cover)
  const blindBossGeo = new THREE.CylinderGeometry(0.86, 0.92, 0.32, 28);
  const leftBlindBoss = new THREE.Mesh(blindBossGeo, castMat);
  leftBlindBoss.rotation.z = Math.PI / 2;
  leftBlindBoss.position.set(-halfW - wallThick - 0.16, shaftY, outputZ);
  leftBlindBoss.castShadow = true;
  casingGroup.add(leftBlindBoss);

  // Blind cover end flange with bolts
  const blindFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 0.96, 0.08, 28),
    machinedMat
  );
  blindFlange.rotation.z = Math.PI / 2;
  blindFlange.position.set(-halfW - wallThick - 0.32, shaftY, outputZ);
  casingGroup.add(blindFlange);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * 0.78;
    const bz = Math.cos(angle) * 0.78;
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(-halfW - wallThick - 0.36, shaftY + by, outputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // Side Optical Observation Port on Left Wall (Preserves 3/4 sightline into gear teeth)
  const sideWinH = Math.max(2.4, (casingTopY - sumpH) * 0.55);
  const sideWinD = Math.max(3.6, Math.abs(outputZ - inputZ) * 1.25);
  const sideWinGeo = new THREE.PlaneGeometry(sideWinD, sideWinH);
  const sideWinMesh = new THREE.Mesh(sideWinGeo, windowMat);
  sideWinMesh.rotation.y = -Math.PI / 2;
  sideWinMesh.position.set(-halfW - wallThick - 0.02, shaftY + 0.4, (inputZ + outputZ) * 0.5);
  casingGroup.add(sideWinMesh);

  // Side viewing window dark metal retaining bezel
  const sideBezelThick = 0.08;
  const sTopBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, sideBezelThick, sideWinD + 0.16), bezelMat);
  sTopBar.position.set(-halfW - wallThick - 0.03, shaftY + 0.4 + sideWinH * 0.5, (inputZ + outputZ) * 0.5);
  casingGroup.add(sTopBar);

  const sBotBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, sideBezelThick, sideWinD + 0.16), bezelMat);
  sBotBar.position.set(-halfW - wallThick - 0.03, shaftY + 0.4 - sideWinH * 0.5, (inputZ + outputZ) * 0.5);
  casingGroup.add(sBotBar);

  // --------------------------------------------------------------------------
  // 4. Solid Right Housing Section & Output Bearing Housing Boss
  // --------------------------------------------------------------------------
  // Solid Right Structural Bulkhead Wall
  const rightWallGeo = new THREE.BoxGeometry(wallThick, sideWallH, sideWallD);
  const rightWallMesh = new THREE.Mesh(rightWallGeo, castMat);
  rightWallMesh.position.set(halfW + wallThick * 0.5, sumpH + sideWallH * 0.5, 0);
  rightWallMesh.castShadow = true;
  rightWallMesh.receiveShadow = true;
  casingGroup.add(rightWallMesh);

  // Right Bearing Boss — Output Shaft Pass-Through Housing (Driven Machine Side)
  const outBossRadius = 0.98;
  const outBossLength = 0.48;
  const rightBossGeo = new THREE.CylinderGeometry(outBossRadius, outBossRadius + 0.08, outBossLength, 32);
  const rightBossMesh = new THREE.Mesh(rightBossGeo, castMat);
  rightBossMesh.rotation.z = -Math.PI / 2;
  rightBossMesh.position.set(halfW + wallThick + outBossLength * 0.5, shaftY, outputZ);
  rightBossMesh.castShadow = true;
  rightBossMesh.receiveShadow = true;
  casingGroup.add(rightBossMesh);

  // Machined Output Flange Collar
  const outFlangeCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(outBossRadius + 0.18, outBossRadius + 0.18, 0.10, 32),
    machinedMat
  );
  outFlangeCollar.rotation.z = -Math.PI / 2;
  outFlangeCollar.position.set(halfW + wallThick + outBossLength - 0.05, shaftY, outputZ);
  outFlangeCollar.castShadow = true;
  casingGroup.add(outFlangeCollar);

  // Oil seal ring surrounding output shaft
  const outSealRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.05, 12, 28),
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
    b.position.set(halfW + wallThick + outBossLength - 0.10, shaftY + by, outputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // Right Input Shaft Blind Bearing Hub (Dead-End Bearing Cover)
  const rightBlindBoss = new THREE.Mesh(blindBossGeo, castMat);
  rightBlindBoss.rotation.z = -Math.PI / 2;
  rightBlindBoss.position.set(halfW + wallThick + 0.16, shaftY, inputZ);
  rightBlindBoss.castShadow = true;
  casingGroup.add(rightBlindBoss);

  const rightBlindFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(0.96, 0.96, 0.08, 28),
    machinedMat
  );
  rightBlindFlange.rotation.z = -Math.PI / 2;
  rightBlindFlange.position.set(halfW + wallThick + 0.32, shaftY, inputZ);
  casingGroup.add(rightBlindFlange);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const by = Math.sin(angle) * 0.78;
    const bz = Math.cos(angle) * 0.78;
    const b = new THREE.Mesh(hexBoltGeo, boltMat);
    b.rotation.z = -Math.PI / 2;
    b.position.set(halfW + wallThick + 0.36, shaftY + by, inputZ + bz);
    b.castShadow = true;
    casingGroup.add(b);
  }

  // --------------------------------------------------------------------------
  // 5. Solid Top Housing, Parting Flange, Service Cover & Lifting Eye
  // --------------------------------------------------------------------------
  const topCoverH = 0.42;
  const topCoverW = widthX + wallThick * 2 + 0.25;
  const topCoverD = depthZ + wallThick * 2 + 0.25;

  // Solid Cast Machine Crown / Roof
  const topCrownGeo = new THREE.BoxGeometry(topCoverW, topCoverH, topCoverD);
  const topCrownMesh = new THREE.Mesh(topCrownGeo, castMat);
  topCrownMesh.position.set(0, casingTopY + topCoverH * 0.5, 0);
  topCrownMesh.castShadow = true;
  topCrownMesh.receiveShadow = true;
  casingGroup.add(topCrownMesh);

  // Horizontal Parting Line Joint Flange (where top and bottom castings join)
  const partFlangeH = 0.16;
  const partFlangeW = topCoverW + 0.20;
  const partFlangeD = topCoverD + 0.20;

  // Front & Back Parting Flange Rails
  const pRailX = new THREE.BoxGeometry(partFlangeW, partFlangeH, 0.14);
  const pFront = new THREE.Mesh(pRailX, machinedMat);
  pFront.position.set(0, casingTopY - 0.08, halfD + wallThick + 0.07);
  casingGroup.add(pFront);

  const pBack = new THREE.Mesh(pRailX, machinedMat);
  pBack.position.set(0, casingTopY - 0.08, -halfD - wallThick - 0.07);
  casingGroup.add(pBack);

  // Parting Flange Joint Clamping Hex Bolts (spaced evenly across front & back)
  const partBoltSpacing = 1.4;
  const numPartBolts = Math.max(3, Math.floor(partFlangeW / partBoltSpacing));
  for (let i = 0; i < numPartBolts; i++) {
    const bx = -partFlangeW * 0.45 + (i / (numPartBolts - 1)) * partFlangeW * 0.90;
    const bF = new THREE.Mesh(hexBoltGeo, boltMat);
    bF.position.set(bx, casingTopY - 0.08, halfD + wallThick + 0.15);
    bF.rotation.x = Math.PI / 2;
    casingGroup.add(bF);

    const bB = new THREE.Mesh(hexBoltGeo, boltMat);
    bB.position.set(bx, casingTopY - 0.08, -halfD - wallThick - 0.15);
    bB.rotation.x = -Math.PI / 2;
    casingGroup.add(bB);
  }

  // Raised Top Inspection Service Access Hatch
  const hatchW = Math.min(widthX * 0.60, 2.4);
  const hatchD = Math.min(depthZ * 0.35, 2.2);
  const hatchPlateGeo = new THREE.BoxGeometry(hatchW, 0.10, hatchD);
  const hatchPlateMesh = new THREE.Mesh(hatchPlateGeo, castDarkMat);
  hatchPlateMesh.position.set(0, casingTopY + topCoverH + 0.05, 0);
  hatchPlateMesh.castShadow = true;
  hatchPlateMesh.receiveShadow = true;
  casingGroup.add(hatchPlateMesh);

  // Hatch Fastener Bolts (4 corners + 2 center)
  const hbx = hatchW * 0.40;
  const hbz = hatchD * 0.38;
  const hatchBolts = [
    [-hbx, -hbz], [0, -hbz], [hbx, -hbz],
    [-hbx, hbz], [0, hbz], [hbx, hbz]
  ];
  for (const [cx, cz] of hatchBolts) {
    const hBolt = new THREE.Mesh(hexBoltGeo, boltMat);
    hBolt.position.set(cx, casingTopY + topCoverH + 0.10 + 0.04, cz);
    hBolt.castShadow = true;
    casingGroup.add(hBolt);
  }

  // Heavy Drop-Forged Steel Lifting Eye Bolt
  const eyeBaseGeo = new THREE.CylinderGeometry(0.20, 0.25, 0.14, 20);
  const eyeBase = new THREE.Mesh(eyeBaseGeo, machinedMat);
  eyeBase.position.set(0, casingTopY + topCoverH + 0.10 + 0.07, 0);
  eyeBase.castShadow = true;
  casingGroup.add(eyeBase);

  const eyeTorusGeo = new THREE.TorusGeometry(0.26, 0.075, 16, 28);
  const eyeTorus = new THREE.Mesh(eyeTorusGeo, boltMat);
  eyeTorus.position.set(0, casingTopY + topCoverH + 0.10 + 0.32, 0);
  eyeTorus.castShadow = true;
  casingGroup.add(eyeTorus);

  // --------------------------------------------------------------------------
  // 6. Front Housing Section & LARGE TRANSPARENT INSPECTION WINDOW
  // --------------------------------------------------------------------------
  // Upper Solid Cast Header Wall above the Window
  const frontHeaderH = 0.85;
  const frontHeaderGeo = new THREE.BoxGeometry(widthX + wallThick * 2, frontHeaderH, wallThick);
  const frontHeader = new THREE.Mesh(frontHeaderGeo, castMat);
  frontHeader.position.set(0, casingTopY - frontHeaderH * 0.5, halfD + wallThick * 0.5);
  frontHeader.castShadow = true;
  casingGroup.add(frontHeader);

  // Lower Solid Cast Apron Wall below the Window
  const frontApronH = 0.65;
  const frontApronGeo = new THREE.BoxGeometry(widthX + wallThick * 2, frontApronH, wallThick);
  const frontApron = new THREE.Mesh(frontApronGeo, castMat);
  frontApron.position.set(0, sumpH + frontApronH * 0.5, halfD + wallThick * 0.5);
  frontApron.castShadow = true;
  casingGroup.add(frontApron);

  // Left & Right Solid Cast Upright Stiles framing the Window
  const uprightW = 0.42;
  const uprightH = (casingTopY - frontHeaderH) - (sumpH + frontApronH);
  const uprightY = sumpH + frontApronH + uprightH * 0.5;

  const leftUprightGeo = new THREE.BoxGeometry(uprightW, uprightH, wallThick);
  const leftUpright = new THREE.Mesh(leftUprightGeo, castMat);
  leftUpright.position.set(-halfW - wallThick * 0.5 + uprightW * 0.5, uprightY, halfD + wallThick * 0.5);
  leftUpright.castShadow = true;
  casingGroup.add(leftUpright);

  const rightUpright = new THREE.Mesh(leftUprightGeo, castMat);
  rightUpright.position.set(halfW + wallThick * 0.5 - uprightW * 0.5, uprightY, halfD + wallThick * 0.5);
  rightUpright.castShadow = true;
  casingGroup.add(rightUpright);

  // The Inspection Window Opening Dimensions
  const winW = (widthX + wallThick * 2) - uprightW * 2;
  const winH = uprightH;
  const winZ = halfD + wallThick + 0.02;

  // Dark Metallic Machined Window Frame / Bezel
  const bezelThick = 0.12;
  const bezelDepth = 0.08;

  // Top Bezel Bar
  const bTop = new THREE.Mesh(new THREE.BoxGeometry(winW + bezelThick * 2, bezelThick, bezelDepth), bezelMat);
  bTop.position.set(0, uprightY + winH * 0.5, winZ);
  bTop.castShadow = true;
  casingGroup.add(bTop);

  // Bottom Bezel Bar
  const bBot = new THREE.Mesh(new THREE.BoxGeometry(winW + bezelThick * 2, bezelThick, bezelDepth), bezelMat);
  bBot.position.set(0, uprightY - winH * 0.5, winZ);
  bBot.castShadow = true;
  casingGroup.add(bBot);

  // Left Bezel Bar
  const bLeft = new THREE.Mesh(new THREE.BoxGeometry(bezelThick, winH, bezelDepth), bezelMat);
  bLeft.position.set(-winW * 0.5 - bezelThick * 0.5, uprightY, winZ);
  bLeft.castShadow = true;
  casingGroup.add(bLeft);

  // Right Bezel Bar
  const bRight = new THREE.Mesh(new THREE.BoxGeometry(bezelThick, winH, bezelDepth), bezelMat);
  bRight.position.set(winW * 0.5 + bezelThick * 0.5, uprightY, winZ);
  bRight.castShadow = true;
  casingGroup.add(bRight);

  // Window Frame Perimeter Clamping Hex Bolts
  const boltsPerX = Math.max(3, Math.floor(winW / 1.3));
  for (let i = 0; i < boltsPerX; i++) {
    const bx = -winW * 0.45 + (i / (boltsPerX - 1)) * winW * 0.90;
    // Top frame bolts
    const bT = new THREE.Mesh(hexBoltGeo, boltMat);
    bT.rotation.x = Math.PI / 2;
    bT.position.set(bx, uprightY + winH * 0.5, winZ + 0.05);
    casingGroup.add(bT);

    // Bottom frame bolts
    const bB = new THREE.Mesh(hexBoltGeo, boltMat);
    bB.rotation.x = Math.PI / 2;
    bB.position.set(bx, uprightY - winH * 0.5, winZ + 0.05);
    casingGroup.add(bB);
  }

  const boltsPerY = Math.max(2, Math.floor(winH / 1.4));
  for (let i = 0; i < boltsPerY; i++) {
    const by = -winH * 0.40 + (i / (boltsPerY - 1)) * winH * 0.80;
    // Left frame bolts
    const bL = new THREE.Mesh(hexBoltGeo, boltMat);
    bL.rotation.x = Math.PI / 2;
    bL.position.set(-winW * 0.5 - bezelThick * 0.5, uprightY + by, winZ + 0.05);
    casingGroup.add(bL);

    // Right frame bolts
    const bR = new THREE.Mesh(hexBoltGeo, boltMat);
    bR.rotation.x = Math.PI / 2;
    bR.position.set(winW * 0.5 + bezelThick * 0.5, uprightY + by, winZ + 0.05);
    casingGroup.add(bR);
  }

  // Thick Transparent Industrial Optical Acrylic Glass Pane
  const frontGlassGeo = new THREE.PlaneGeometry(winW, winH);
  const frontGlassMesh = new THREE.Mesh(frontGlassGeo, windowMat);
  frontGlassMesh.position.set(0, uprightY, winZ - 0.01);
  casingGroup.add(frontGlassMesh);

  // --------------------------------------------------------------------------
  // 7. Non-Blocking Raycasting Guarantee
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
