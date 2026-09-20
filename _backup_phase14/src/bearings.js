/**
 * Gear Factory 3D — Bearings & Structural Supports
 *
 * Requirements & Features:
 * - Deep-groove ball bearing with stationary outer ring, rotating inner ring, chrome balls & retainer cage
 * - Open cast iron bearing housing with perimeter hex bolts and grease port
 * - Shaft support assembly pairing bearing with mounting bulkhead
 * - Heavy-duty base mounting feet with anchor bolts
 */

import * as THREE from 'three';

/**
 * Creates a high-fidelity industrial deep-groove ball bearing.
 * Default parameters: { outerRadius = 5.0, innerRadius = 2.5, width = 2.0, ballCount = 10 }
 *
 * Requirements:
 * 1. Stationary outer ring: Thick ring-shaped geometry, metallic dark-gray material.
 * 2. Rotating inner ring: Smaller ring/cylinder, metallic steel, rotates with shaft.
 * 3. Visible bearing balls: 10 small chrome spheres evenly spaced around pitch circle.
 * 4. Bearing axis strictly matches shaft axis (X-axis).
 *
 * @param {Object} options - Bearing dimensions and materials
 * @returns {THREE.Group} Complete ball bearing assembly
 */
export function createBallBearing(options = {}) {
  const {
    outerRadius = 5.0,
    innerRadius = 2.5,
    width = 2.0,
    ballCount = 10,
    outerColor = 0x34404e, // Hardened bearing alloy outer raceway
    innerColor = 0xb8c8d8, // Precision ground mirror-smooth inner ring
    ballColor = 0xf4f8fc, // Mirror chrome bearing spheres
    metalness = 0.96,
    roughness = 0.14,
  } = options;

  const bearingGroup = new THREE.Group();

  // Radial dimensions
  const radialSpan = outerRadius - innerRadius;
  const innerRingOuterR = innerRadius + radialSpan * 0.28;
  const outerRingInnerR = outerRadius - radialSpan * 0.28;
  const ballPitchR = (innerRingOuterR + outerRingInnerR) * 0.5;
  const ballRadius = (outerRingInnerR - innerRingOuterR) * 0.46;

  // 1. Stationary Outer Ring (Thick precision ring with chamfered edges)
  const outerRingGroup = new THREE.Group();
  const outerShape = new THREE.Shape();
  outerShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const outerHole = new THREE.Path();
  outerHole.absarc(0, 0, outerRingInnerR, 0, Math.PI * 2, true);
  outerShape.holes.push(outerHole);

  const outerGeom = new THREE.ExtrudeGeometry(outerShape, {
    depth: width * 0.72,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: width * 0.03,
    bevelThickness: width * 0.03,
  });
  outerGeom.center();
  outerGeom.rotateY(Math.PI / 2); // Concentric with X-axis shaft

  const outerMat = new THREE.MeshStandardMaterial({
    color: outerColor,
    metalness: 0.90,
    roughness: 0.35,
  });
  const outerRingMesh = new THREE.Mesh(outerGeom, outerMat);
  outerRingMesh.castShadow = true;
  outerRingMesh.receiveShadow = true;
  outerRingGroup.add(outerRingMesh);
  bearingGroup.add(outerRingGroup);

  // 2. Rotating Inner Ring (Precision ground steel, rotates with shaft)
  const innerRingGroup = new THREE.Group();
  const innerShape = new THREE.Shape();
  innerShape.absarc(0, 0, innerRingOuterR, 0, Math.PI * 2, false);
  const innerHole = new THREE.Path();
  innerHole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  innerShape.holes.push(innerHole);

  const innerGeom = new THREE.ExtrudeGeometry(innerShape, {
    depth: width * 0.70,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: width * 0.025,
    bevelThickness: width * 0.025,
  });
  innerGeom.center();
  innerGeom.rotateY(Math.PI / 2);

  const innerMat = new THREE.MeshStandardMaterial({
    color: innerColor,
    metalness: 0.98,
    roughness: 0.10,
  });
  const innerRingMesh = new THREE.Mesh(innerGeom, innerMat);
  innerRingMesh.castShadow = true;
  innerRingMesh.receiveShadow = true;
  innerRingGroup.add(innerRingMesh);

  // Precision drive keyway notch on inner ring face
  const notchGeo = new THREE.BoxGeometry(width * 0.72 + 0.02, width * 0.10, width * 0.10);
  const notchMat = new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 0.5 });
  const notchMesh = new THREE.Mesh(notchGeo, notchMat);
  notchMesh.position.set(0, innerRadius + width * 0.05, 0);
  innerRingGroup.add(notchMesh);

  bearingGroup.add(innerRingGroup);

  // 3. Visible Rolling Bearing Balls (Chrome spheres around pitch circle)
  const ballsGroup = new THREE.Group();
  const ballGeo = new THREE.SphereGeometry(ballRadius, 24, 24);
  const ballMat = new THREE.MeshStandardMaterial({
    color: ballColor,
    metalness: 1.0,
    roughness: 0.02,
  });

  for (let i = 0; i < ballCount; i++) {
    const angle = (i * Math.PI * 2) / ballCount;
    const bMesh = new THREE.Mesh(ballGeo, ballMat);
    bMesh.position.set(
      0,
      Math.sin(angle) * ballPitchR,
      Math.cos(angle) * ballPitchR
    );
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    ballsGroup.add(bMesh);
  }

  // Stamped Machined Bronze Separator Cage
  const cageMat = new THREE.MeshStandardMaterial({
    color: 0xb58028,
    metalness: 0.88,
    roughness: 0.26,
  });
  const cageTorus = new THREE.Mesh(
    new THREE.TorusGeometry(ballPitchR, ballRadius * 0.28, 12, 36),
    cageMat
  );
  cageTorus.rotation.y = Math.PI / 2;
  cageTorus.castShadow = true;
  ballsGroup.add(cageTorus);

  bearingGroup.add(ballsGroup);

  bearingGroup.userData = {
    type: 'ball_bearing',
    outerRadius,
    innerRadius,
    width,
    ballCount,
    innerRing: innerRingGroup,
    outerRing: outerRingGroup,
    balls: ballsGroup,
    innerRingGroup,
    outerRingGroup,
    ballsGroup,
  };

  return bearingGroup;
}

export const createBearing = createBallBearing;

/**
 * Creates an open industrial bearing mounting housing / flange bracket.
 * Grips outer ring securely while leaving face and balls 100% visible through window.
 * @param {Object} options - Housing parameters
 * @returns {THREE.Group} Bearing housing assembly
 */
export function createBearingHousing(options = {}) {
  const {
    bearingOuterRadius = 0.72,
    width = 0.38,
    housingOuterRadius = bearingOuterRadius + 0.16,
    color = 0x384452,
    metalness = 0.88,
    roughness = 0.32,
    flangeFacing = 1, // 1: mounting to left wall, -1: mounting to right wall
  } = options;

  const housingGroup = new THREE.Group();

  // 1. Open Annular Retaining Collar
  const collarShape = new THREE.Shape();
  collarShape.absarc(0, 0, housingOuterRadius, 0, Math.PI * 2, false);
  const collarHole = new THREE.Path();
  collarHole.absarc(0, 0, bearingOuterRadius * 0.99, 0, Math.PI * 2, true);
  collarShape.holes.push(collarHole);

  const collarGeom = new THREE.ExtrudeGeometry(collarShape, {
    depth: width * 0.4,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.015,
    bevelThickness: 0.015,
  });
  collarGeom.center();
  collarGeom.rotateY(Math.PI / 2);

  const housingMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: metalness,
    roughness: roughness,
  });
  const collarMesh = new THREE.Mesh(collarGeom, housingMat);
  collarMesh.position.x = -flangeFacing * (width * 0.20);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  housingGroup.add(collarMesh);

  // 2. Heavy Mounting Flange Bracket against casing bulkhead
  const bracketRadius = housingOuterRadius + 0.18;
  const bracketShape = new THREE.Shape();
  bracketShape.absarc(0, 0, bracketRadius, 0, Math.PI * 2, false);
  const bracketHole = new THREE.Path();
  bracketHole.absarc(0, 0, bearingOuterRadius * 0.99, 0, Math.PI * 2, true);
  bracketShape.holes.push(bracketHole);

  const bracketGeom = new THREE.ExtrudeGeometry(bracketShape, {
    depth: 0.10,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.01,
    bevelThickness: 0.01,
  });
  bracketGeom.center();
  bracketGeom.rotateY(Math.PI / 2);

  const bracketMesh = new THREE.Mesh(bracketGeom, housingMat);
  bracketMesh.position.x = -flangeFacing * (width * 0.42);
  bracketMesh.castShadow = true;
  bracketMesh.receiveShadow = true;
  housingGroup.add(bracketMesh);

  // 3. Four Perimeter Hex Mounting Bolts
  const boltCount = 4;
  const boltRadius = (housingOuterRadius + bracketRadius) * 0.5;
  const boltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.14, 6);
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.92,
    roughness: 0.25,
  });

  for (let i = 0; i < boltCount; i++) {
    const angle = (i * Math.PI * 2) / boltCount + Math.PI / 4;
    const bMesh = new THREE.Mesh(boltGeo, boltMat);
    bMesh.rotation.z = Math.PI / 2;
    bMesh.position.set(
      -flangeFacing * (width * 0.42),
      Math.sin(angle) * boltRadius,
      Math.cos(angle) * boltRadius
    );
    bMesh.castShadow = true;
    housingGroup.add(bMesh);
  }

  // 4. Industrial Lubrication Grease Nipple
  const greasePortGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.16, 12);
  const greaseMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    metalness: 0.92,
    roughness: 0.25,
  });
  const greasePort = new THREE.Mesh(greasePortGeo, greaseMat);
  greasePort.position.set(-flangeFacing * (width * 0.20), housingOuterRadius + 0.08, 0);
  greasePort.castShadow = true;
  housingGroup.add(greasePort);

  housingGroup.userData = {
    type: 'bearing_housing',
    bearingOuterRadius,
    housingOuterRadius,
    width,
  };

  return housingGroup;
}

/**
 * Creates a complete industrial shaft support assembly combining
 * a precision deep-groove ball bearing and an open flanged mounting housing.
 * @param {Object} options - Support specifications
 * @returns {THREE.Group} Shaft support unit
 */
export function createShaftSupport(options = {}) {
  const {
    shaftRadius = 0.32,
    innerRadius = shaftRadius + 0.012,
    outerRadius = shaftRadius * 2.25,
    width = shaftRadius * 1.05,
    ballCount = 10,
    targetShaft = 'input',
    housingColor = 0x384452,
    outerColor = 0x2b333e,
    innerColor = 0xa8b8ca,
    flangeFacing = 1,
  } = options;

  const supportGroup = new THREE.Group();

  const housing = createBearingHousing({
    bearingOuterRadius: outerRadius,
    width: width + 0.04,
    color: housingColor,
    flangeFacing,
  });
  supportGroup.add(housing);

  const bearing = createBallBearing({
    innerRadius: innerRadius,
    outerRadius: outerRadius,
    width: width,
    ballCount: ballCount,
    innerColor: innerColor,
    outerColor: outerColor,
  });
  supportGroup.add(bearing);

  const innerRing = bearing.userData.innerRing;
  const outerRing = bearing.userData.outerRing;
  const balls = bearing.userData.balls;

  supportGroup.userData = {
    type: 'shaft_support',
    targetShaft,
    shaftRadius,
    bearing,
    housing,
    innerRing,
    outerRing,
    balls,
  };

  return supportGroup;
}

/**
 * Creates four heavy-duty industrial mounting feet for the gearbox base.
 * @param {Object} options - Foot dimensions
 * @returns {THREE.Group}
 */
export function createMountingFeet(options = {}) {
  const {
    width = 2.6,
    depth = 7.0,
    footSize = { x: 0.75, y: 0.22, z: 0.75 },
    color = 0x27313f,
    metalness = 0.85,
    roughness = 0.45,
  } = options;

  const group = new THREE.Group();
  const footGeo = new THREE.BoxGeometry(footSize.x, footSize.y, footSize.z);
  const footMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: metalness,
    roughness: roughness,
  });

  const boltGeo = new THREE.CylinderGeometry(0.08, 0.08, footSize.y + 0.08, 16);
  const boltMat = new THREE.MeshStandardMaterial({ color: 0x121720, metalness: 0.9, roughness: 0.3 });

  const xOffsets = [-width * 0.5 + footSize.x * 0.45, width * 0.5 - footSize.x * 0.45];
  const zOffsets = [-depth * 0.5 + footSize.z * 0.45, depth * 0.5 - footSize.z * 0.45];

  for (const ox of xOffsets) {
    for (const oz of zOffsets) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(ox, footSize.y * 0.5, oz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      group.add(foot);

      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(ox, footSize.y * 0.5, oz);
      bolt.castShadow = true;
      group.add(bolt);
    }
  }

  group.userData = { type: 'mounting_feet' };
  return group;
}
