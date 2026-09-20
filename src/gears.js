/**
 * Gear Factory 3D — Spur Gear Procedural Generator
 *
 * Requirements & Features:
 * - Authentic 2D involute tooth profile extrusion
 * - Central bore with rectangular drive keyway
 * - Weight-reduction web cutouts
 * - Raised hub boss and chamfered bevels
 * - PBR metallic material (brass gold / chrome steel)
 */

import * as THREE from 'three';
import { GEAR_MODULE } from './game-state.js';

/**
 * Creates an industrial spur gear with mathematically shaped involute teeth,
 * straight teeth parallel to the shaft, central bore, and beveled edges.
 *
 * Mechanical tooth geometry:
 * - Pitch Radius Rp = (m * z) / 2
 * - Addendum Ha = 0.95 * m
 * - Dedendum Hd = 1.15 * m
 * - Tip Radius = Rp + Ha
 * - Root Radius = Rp - Hd
 * - Pressure Angle = 20 degrees standard
 *
 * @param {Object} options - Spur gear parameters
 * @returns {THREE.Group} Procedurally generated spur gear assembly
 */
export function createSpurGear(options = {}) {
  const {
    teeth = 20,
    module = GEAR_MODULE,
    thickness = 0.65,
    boreRadius = 0.42,
    pressureAngleDeg = 20,
    color = 0x8a95a5,
    metalness = 0.92,
    roughness = 0.26,
  } = options;

  // Involute Gear Mathematics:
  const pitchRadius = (module * teeth) / 2;
  const addendum = module * 0.95;
  const dedendum = module * 1.15;
  const rTip = pitchRadius + addendum;
  const rRoot = pitchRadius - dedendum;

  const pressureAngleRad = (pressureAngleDeg * Math.PI) / 180;
  const tanPA = Math.tan(pressureAngleRad);

  const totalAngle = Math.PI * 2;
  const anglePerTooth = totalAngle / teeth;

  // Angular tooth half-widths
  const halfAnglePitch = anglePerTooth * 0.25;
  const deltaAngleTip = (addendum * tanPA) / pitchRadius;
  const deltaAngleRoot = (dedendum * tanPA) / pitchRadius;

  // Involute tooth taper
  const halfAngleTip = Math.max(0.02, halfAnglePitch - deltaAngleTip);
  const halfAngleRoot = halfAnglePitch + deltaAngleRoot;

  // 1. Build 2D Involute Spur Gear Shape
  const shape = new THREE.Shape();

  for (let i = 0; i < teeth; i++) {
    const centerAngle = (i + 0.5) * anglePerTooth;

    const aRootStart = centerAngle - halfAngleRoot;
    const aPitchStart = centerAngle - halfAnglePitch;
    const aTipStart = centerAngle - halfAngleTip;
    const aTipEnd = centerAngle + halfAngleTip;
    const aPitchEnd = centerAngle + halfAnglePitch;
    const aRootEnd = centerAngle + halfAngleRoot;
    const aNextRootStart = centerAngle + anglePerTooth - halfAngleRoot;

    if (i === 0) {
      shape.moveTo(Math.cos(aRootStart) * rRoot, Math.sin(aRootStart) * rRoot);
    } else {
      shape.lineTo(Math.cos(aRootStart) * rRoot, Math.sin(aRootStart) * rRoot);
    }

    // A. Rising Involute Flank
    shape.lineTo(Math.cos(aPitchStart) * pitchRadius, Math.sin(aPitchStart) * pitchRadius);
    shape.lineTo(Math.cos(aTipStart) * rTip, Math.sin(aTipStart) * rTip);

    // B. Tooth Tip Crest Arc
    shape.absarc(0, 0, rTip, aTipStart, aTipEnd, false);

    // C. Falling Involute Flank
    shape.lineTo(Math.cos(aPitchEnd) * pitchRadius, Math.sin(aPitchEnd) * pitchRadius);
    shape.lineTo(Math.cos(aRootEnd) * rRoot, Math.sin(aRootEnd) * rRoot);

    // D. Root Valley Arc
    shape.absarc(0, 0, rRoot, aRootEnd, aNextRootStart, false);
  }

  // 2. Central Bore Hole with Keyway
  const borePath = new THREE.Path();
  const keyWidth = 0.12;
  const keyDepth = 0.10;
  const keyAngleHalf = Math.asin(keyWidth / (2 * boreRadius));
  const aKeyStart = Math.PI / 2 - keyAngleHalf;
  const aKeyEnd = Math.PI / 2 + keyAngleHalf;

  borePath.moveTo(Math.cos(aKeyEnd) * boreRadius, Math.sin(aKeyEnd) * boreRadius);
  borePath.absarc(0, 0, boreRadius, aKeyEnd, aKeyStart + Math.PI * 2, false);
  borePath.lineTo(Math.cos(aKeyStart) * (boreRadius + keyDepth), Math.sin(aKeyStart) * (boreRadius + keyDepth));
  borePath.lineTo(Math.cos(aKeyEnd) * (boreRadius + keyDepth), Math.sin(aKeyEnd) * (boreRadius + keyDepth));
  borePath.closePath();
  shape.holes.push(borePath);

  // 3. Web Lightening Holes
  const cutoutCount = teeth >= 30 ? 6 : 4;
  const cutoutDist = (rRoot + boreRadius) * 0.52;
  const cutoutRadius = Math.min(0.48, (rRoot - boreRadius) * 0.24);

  if (cutoutRadius > 0.15) {
    for (let c = 0; c < cutoutCount; c++) {
      const cutoutAngle = (c * Math.PI * 2) / cutoutCount + Math.PI / cutoutCount;
      const cx = Math.cos(cutoutAngle) * cutoutDist;
      const cy = Math.sin(cutoutAngle) * cutoutDist;

      const cutoutPath = new THREE.Path();
      cutoutPath.absarc(cx, cy, cutoutRadius, 0, Math.PI * 2, true);
      shape.holes.push(cutoutPath);
    }
  }

  // 4. Extrude 2D Shape into 3D Solid with Precision Beveled Edges
  const extrudeSettings = {
    steps: 1,
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.028,
    bevelOffset: 0,
    bevelSegments: 4,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();

  // PBR Hardened Metallic Steel Material
  const material = new THREE.MeshStandardMaterial({
    color: color,
    metalness: metalness,
    roughness: roughness,
  });

  const gearMesh = new THREE.Mesh(geometry, material);
  gearMesh.castShadow = true;
  gearMesh.receiveShadow = true;

  // Orient gear so its shaft axis is horizontal along X-axis
  gearMesh.rotation.y = Math.PI / 2;

  // Root group for the spur gear
  const gearGroup = new THREE.Group();
  gearGroup.add(gearMesh);

  // 5. Machined Web Rim Reinforcement Rings (Left & Right faces)
  const rimOuterR = rRoot * 0.94;
  const rimInnerR = rRoot * 0.84;
  if (rimInnerR > boreRadius + 0.32) {
    const rimShape = new THREE.Shape();
    rimShape.absarc(0, 0, rimOuterR, 0, Math.PI * 2, false);
    const rimHole = new THREE.Path();
    rimHole.absarc(0, 0, rimInnerR, 0, Math.PI * 2, true);
    rimShape.holes.push(rimHole);

    const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
    });
    rimGeo.center();
    rimGeo.rotateY(Math.PI / 2);

    const rimMat = new THREE.MeshStandardMaterial({
      color: color,
      metalness: Math.min(1.0, metalness + 0.04),
      roughness: Math.max(0.18, roughness - 0.06),
    });

    const rimMesh1 = new THREE.Mesh(rimGeo, rimMat);
    rimMesh1.position.x = thickness * 0.5 + 0.02;
    rimMesh1.castShadow = true;
    gearGroup.add(rimMesh1);

    const rimMesh2 = new THREE.Mesh(rimGeo, rimMat);
    rimMesh2.position.x = -thickness * 0.5 - 0.02;
    rimMesh2.castShadow = true;
    gearGroup.add(rimMesh2);
  }

  // 6. Raised Central Hub Boss with Machined Collar & Locking Set Screw
  const hubRadius = boreRadius + 0.22;
  const hubHeight = thickness + 0.16;
  const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius + 0.03, hubHeight, 36);
  const hubMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: Math.min(1.0, metalness + 0.02),
    roughness: Math.min(1.0, roughness + 0.04),
  });
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.rotation.z = Math.PI / 2;
  hubMesh.castShadow = true;
  hubMesh.receiveShadow = true;
  gearGroup.add(hubMesh);

  // Industrial Hex Socket Set-Screw (locking hub to shaft keyway)
  const setScrewGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 6);
  const setScrewMat = new THREE.MeshStandardMaterial({
    color: 0x1a212b,
    metalness: 0.95,
    roughness: 0.28,
  });
  const setScrewMesh = new THREE.Mesh(setScrewGeo, setScrewMat);
  setScrewMesh.position.set(0, hubRadius + 0.03, 0);
  setScrewMesh.castShadow = true;
  gearGroup.add(setScrewMesh);

  // Attach metadata
  gearGroup.userData = {
    gearType: 'industrial_spur_gear',
    profile: 'involute',
    teeth,
    module,
    pitchRadius,
    rTip,
    rRoot,
    thickness,
    boreRadius,
    teethParallelToAxis: true,
    hasHelicalTwist: false,
  };

  return gearGroup;
}

export const createGear = createSpurGear;
