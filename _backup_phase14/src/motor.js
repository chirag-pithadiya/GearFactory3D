/**
 * Gear Factory 3D — Industrial Electric Motor Generator
 *
 * Requirements & Features:
 * - Cylindrical stator body with cooling fins
 * - Ventilated rear fan cowl end cover
 * - Front B5 drive-end mounting flange
 * - Terminal electrical junction box
 * - Structural mounting pedestal base
 * - Rotating drive shaft extension
 */

import * as THREE from 'three';

/**
 * Creates an industrial electric motor drive unit oriented along the X-axis.
 * @param {Object} options - Motor dimensions, colors, and pedestal height
 * @returns {THREE.Group} Complete electric motor assembly
 */
export function createMotor(options = {}) {
  const {
    radius = 1.15,
    length = 2.4,
    bodyColor = 0x17304c, // Classic deep industrial machine blue
    endCoverColor = 0x102236,
    flangeColor = 0x1f3854,
    shaftRadius = 0.28,
    shaftLength = 1.0,
    metalness = 0.72,
    roughness = 0.40,
    finCount = 16,
  } = options;

  const motorGroup = new THREE.Group();

  // Bolt material
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x151c24,
    metalness: 0.92,
    roughness: 0.28,
  });
  const hexBoltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6);

  // 1. Main Cylindrical Stator Body (oriented along X-axis)
  const bodyGeo = new THREE.CylinderGeometry(radius, radius, length, 36);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: metalness,
    roughness: roughness,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.rotation.z = Math.PI / 2;
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  motorGroup.add(bodyMesh);

  // 2. Longitudinal Industrial Cooling Fins (Extending along the stator body)
  const finMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: Math.min(1.0, metalness + 0.08),
    roughness: roughness,
  });
  const finLength = length * 0.90;
  const finHeight = 0.14;
  const finThickness = 0.04;
  const finGeo = new THREE.BoxGeometry(finLength, finHeight, finThickness);

  for (let i = 0; i < finCount; i++) {
    const angle = (i * Math.PI * 2) / finCount;
    // Skip top where terminal box sits
    if (angle > Math.PI * 0.35 && angle < Math.PI * 0.65) continue;
    // Skip bottom where base pedestal attaches
    if (angle > Math.PI * 1.35 && angle < Math.PI * 1.65) continue;

    const finMesh = new THREE.Mesh(finGeo, finMat);
    const finR = radius + finHeight * 0.5 - 0.01;
    finMesh.position.set(0, Math.sin(angle) * finR, Math.cos(angle) * finR);
    finMesh.rotation.x = -angle;
    finMesh.castShadow = true;
    motorGroup.add(finMesh);
  }

  // 3. Stator Rating & Spec Nameplate on Side
  const plateGeo = new THREE.BoxGeometry(0.55, 0.32, 0.02);
  const plateMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.88,
    roughness: 0.25,
  });
  const nameplate = new THREE.Mesh(plateGeo, plateMat);
  nameplate.position.set(0, 0, radius + 0.05);
  nameplate.castShadow = true;
  motorGroup.add(nameplate);

  // 4. Rear Fan Shroud Cowl (-X end)
  const endCoverRadius = radius * 0.94;
  const endCoverLength = 0.55;
  const endCoverGeo = new THREE.CylinderGeometry(endCoverRadius * 0.88, endCoverRadius, endCoverLength, 36);
  const endCoverMat = new THREE.MeshStandardMaterial({
    color: endCoverColor,
    metalness: 0.82,
    roughness: 0.32,
  });
  const endCoverMesh = new THREE.Mesh(endCoverGeo, endCoverMat);
  endCoverMesh.rotation.z = Math.PI / 2;
  endCoverMesh.position.x = -length * 0.5 - endCoverLength * 0.5;
  endCoverMesh.castShadow = true;
  endCoverMesh.receiveShadow = true;
  motorGroup.add(endCoverMesh);

  // Fan Cowl Rear Intake Grille Ring
  const grilleRing = new THREE.Mesh(
    new THREE.TorusGeometry(endCoverRadius * 0.55, 0.06, 12, 24),
    boltMat
  );
  grilleRing.rotation.y = Math.PI / 2;
  grilleRing.position.x = -length * 0.5 - endCoverLength - 0.01;
  motorGroup.add(grilleRing);

  // 5. Front Drive-End Flange (B5 Face on +X)
  const flangeRadius = radius * 1.24;
  const flangeLength = 0.18;
  const flangeGeo = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeLength, 36);
  const flangeMat = new THREE.MeshStandardMaterial({
    color: flangeColor,
    metalness: 0.88,
    roughness: 0.28,
  });
  const flangeMesh = new THREE.Mesh(flangeGeo, flangeMat);
  flangeMesh.rotation.z = Math.PI / 2;
  flangeMesh.position.x = length * 0.5 + flangeLength * 0.5;
  flangeMesh.castShadow = true;
  flangeMesh.receiveShadow = true;
  motorGroup.add(flangeMesh);

  // Front Flange Mounting Bolts (4 perimeter cap screws)
  const flangeBoltR = (radius + flangeRadius) * 0.5;
  for (let b = 0; b < 4; b++) {
    const angle = (b * Math.PI * 2) / 4 + Math.PI / 4;
    const bMesh = new THREE.Mesh(hexBoltGeo, boltMat);
    bMesh.rotation.z = Math.PI / 2;
    bMesh.position.set(
      length * 0.5 + flangeLength + 0.02,
      Math.sin(angle) * flangeBoltR,
      Math.cos(angle) * flangeBoltR
    );
    bMesh.castShadow = true;
    motorGroup.add(bMesh);
  }

  // 6. Die-Cast Terminal Wiring Junction Box on Top (+Y)
  const termGeo = new THREE.BoxGeometry(0.72, 0.38, 0.58);
  const termMat = new THREE.MeshStandardMaterial({
    color: endCoverColor,
    metalness: 0.78,
    roughness: 0.35,
  });
  const termMesh = new THREE.Mesh(termGeo, termMat);
  termMesh.position.set(0, radius + 0.19, 0);
  termMesh.castShadow = true;
  termMesh.receiveShadow = true;
  motorGroup.add(termMesh);

  // Terminal Box Lid with Chamfer
  const termLidGeo = new THREE.BoxGeometry(0.76, 0.08, 0.62);
  const termLidMesh = new THREE.Mesh(termLidGeo, termMat);
  termLidMesh.position.set(0, radius + 0.38 + 0.04, 0);
  termLidMesh.castShadow = true;
  motorGroup.add(termLidMesh);

  // Terminal Lid Fastener Screws (4 corners)
  const tbx = 0.30;
  const tbz = 0.23;
  const termScrewCorners = [[-tbx, -tbz], [tbx, -tbz], [-tbx, tbz], [tbx, tbz]];
  for (const [sx, sz] of termScrewCorners) {
    const sMesh = new THREE.Mesh(hexBoltGeo, boltMat);
    sMesh.position.set(sx, radius + 0.42 + 0.02, sz);
    sMesh.scale.set(0.7, 0.7, 0.7);
    sMesh.castShadow = true;
    motorGroup.add(sMesh);
  }

  // Cable Gland / Conduit Knockout on Terminal Box Side (+Z)
  const glandBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16),
    new THREE.MeshStandardMaterial({ color: 0xb48c36, metalness: 0.90, roughness: 0.25 }) // Brass gland
  );
  glandBase.rotation.x = Math.PI / 2;
  glandBase.position.set(0, radius + 0.19, 0.29 + 0.07);
  glandBase.castShadow = true;
  motorGroup.add(glandBase);

  // 7. Heavy-Duty Cast Iron Foot Mounting Pedestal (resting at floor Y = 0)
  const shaftY = options.shaftY || 3.6;
  const pedestalHeight = Math.max(0.4, shaftY - radius);
  const baseWidth = length * 0.86;
  const baseDepth = radius * 1.85;
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1c2430,
    roughness: 0.58,
    metalness: 0.65,
  });
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, pedestalHeight, baseDepth), baseMat);
  baseMesh.position.set(0, -radius - pedestalHeight * 0.5, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  motorGroup.add(baseMesh);

  // Floor Base Mounting Flange with 4 Heavy Anchor Studs & Nuts
  const footFlangeH = 0.24;
  const footFlangeW = baseWidth + 0.40;
  const footFlangeD = baseDepth + 0.40;
  const footFlangeMesh = new THREE.Mesh(new THREE.BoxGeometry(footFlangeW, footFlangeH, footFlangeD), baseMat);
  footFlangeMesh.position.set(0, -radius - pedestalHeight + footFlangeH * 0.5, 0);
  footFlangeMesh.castShadow = true;
  footFlangeMesh.receiveShadow = true;
  motorGroup.add(footFlangeMesh);

  // Floor Anchor Bolts (4 corners of pedestal base)
  const fx = footFlangeW * 0.42;
  const fz = footFlangeD * 0.42;
  const floorBoltCorners = [[-fx, -fz], [fx, -fz], [-fx, fz], [fx, fz]];
  const anchorBoltGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.28, 6);
  for (const [ax, az] of floorBoltCorners) {
    const aBolt = new THREE.Mesh(anchorBoltGeo, boltMat);
    aBolt.position.set(ax, -radius - pedestalHeight + footFlangeH + 0.06, az);
    aBolt.castShadow = true;
    motorGroup.add(aBolt);
  }

  // 8. Motor Output Drive Shaft Extension (+X)
  const motorShaftGroup = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 32);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0xa4b4c6,
    metalness: 0.95,
    roughness: 0.18,
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.rotation.z = Math.PI / 2;
  shaftMesh.position.x = length * 0.5 + flangeLength + shaftLength * 0.5;
  shaftMesh.castShadow = true;
  motorShaftGroup.add(shaftMesh);

  // Drive Keyway Bar on Motor Shaft
  const mKeyGeo = new THREE.BoxGeometry(shaftLength * 0.6, 0.05, 0.05);
  const mKeyMat = new THREE.MeshStandardMaterial({ color: 0x222a36, metalness: 0.88, roughness: 0.35 });
  const mKeyMesh = new THREE.Mesh(mKeyGeo, mKeyMat);
  mKeyMesh.position.set(length * 0.5 + flangeLength + shaftLength * 0.5, shaftRadius * 0.94, 0);
  motorShaftGroup.add(mKeyMesh);

  motorGroup.add(motorShaftGroup);
  motorGroup.userData = {
    type: 'electric_motor',
    shaftGroup: motorShaftGroup,
    shaftMesh: shaftMesh,
    shaftLength: shaftLength,
    totalLength: length + endCoverLength + flangeLength + shaftLength,
  };

  return motorGroup;
}
