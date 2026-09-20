/**
 * Gear Factory 3D — Transmission Shafts Generator
 *
 * Requirements & Features:
 * - Precision ground chrome steel cylinder
 * - Optional flexible shaft coupling with clamping bolts
 * - Drive keyway bar for clear rotation visibility
 */

import * as THREE from 'three';

/**
 * Creates a precision metallic cylindrical shaft oriented along the X-axis.
 * Supports optional industrial flexible coupling collar and drive keyway.
 * @param {Object} options - Shaft specifications
 * @returns {THREE.Group} Shaft component assembly
 */
export function createShaft(options = {}) {
  const {
    radius = 0.28,
    length = 2.0,
    color = 0xa4b4c6, // Precision ground turned steel
    metalness = 0.95,
    roughness = 0.18,
    hasCoupling = false,
    couplingRadius = 0.44,
    couplingLength = 0.52,
  } = options;

  const shaftGroup = new THREE.Group();

  // 1. Main Precision Ground Cylindrical Shaft
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, length, 36);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: metalness,
    roughness: roughness,
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.rotation.z = Math.PI / 2;
  shaftMesh.castShadow = true;
  shaftMesh.receiveShadow = true;
  shaftGroup.add(shaftMesh);

  // 2. Chamfered Shaft Ends
  const endChamferGeo = new THREE.CylinderGeometry(radius * 0.88, radius, 0.06, 36);
  const leftEnd = new THREE.Mesh(endChamferGeo, shaftMat);
  leftEnd.rotation.z = Math.PI / 2;
  leftEnd.position.x = -length * 0.5 - 0.03;
  leftEnd.castShadow = true;
  shaftGroup.add(leftEnd);

  const rightEnd = new THREE.Mesh(endChamferGeo, shaftMat);
  rightEnd.rotation.z = -Math.PI / 2;
  rightEnd.position.x = length * 0.5 + 0.03;
  rightEnd.castShadow = true;
  shaftGroup.add(rightEnd);

  // 3. Stepped Bearing Retaining Shoulder Collar
  const collarR = radius + 0.045;
  const collarGeo = new THREE.CylinderGeometry(collarR, collarR, 0.12, 36);
  const collarMesh = new THREE.Mesh(collarGeo, shaftMat);
  collarMesh.rotation.z = Math.PI / 2;
  collarMesh.position.x = -length * 0.22;
  collarMesh.castShadow = true;
  shaftGroup.add(collarMesh);

  // 4. Industrial Flexible Jaw Coupling (connecting to motor shaft)
  if (hasCoupling) {
    const halfCoupLen = couplingLength * 0.42;
    const spiderLen = couplingLength * 0.16;
    const coupMat = new THREE.MeshStandardMaterial({
      color: 0x2e3846,
      metalness: 0.90,
      roughness: 0.32,
    });

    // Shaft-side Coupling Hub (metallic steel)
    const shaftHub = new THREE.Mesh(
      new THREE.CylinderGeometry(couplingRadius, couplingRadius, halfCoupLen, 28),
      coupMat
    );
    shaftHub.rotation.z = Math.PI / 2;
    shaftHub.position.x = -length * 0.5 + halfCoupLen * 0.5;
    shaftHub.castShadow = true;
    shaftGroup.add(shaftHub);

    // Motor-side Coupling Hub
    const motorHub = new THREE.Mesh(
      new THREE.CylinderGeometry(couplingRadius, couplingRadius, halfCoupLen, 28),
      coupMat
    );
    motorHub.rotation.z = Math.PI / 2;
    motorHub.position.x = -length * 0.5 - spiderLen - halfCoupLen * 0.5;
    motorHub.castShadow = true;
    shaftGroup.add(motorHub);

    // Polyurethane Elastomer Spider Insert (Vibration damper element)
    const spiderMat = new THREE.MeshStandardMaterial({
      color: 0xb43b2a, // Industrial elastomeric damper red
      metalness: 0.20,
      roughness: 0.45,
    });
    const spider = new THREE.Mesh(
      new THREE.CylinderGeometry(couplingRadius * 0.94, couplingRadius * 0.94, spiderLen, 24),
      spiderMat
    );
    spider.rotation.z = Math.PI / 2;
    spider.position.x = -length * 0.5 - spiderLen * 0.5;
    spider.castShadow = true;
    shaftGroup.add(spider);

    // Socket-Head Clamping Pinch Screws on Coupling Collar
    const clampBoltGeo = new THREE.CylinderGeometry(0.045, 0.045, couplingRadius * 2 + 0.06, 8);
    const clampBoltMat = new THREE.MeshStandardMaterial({ color: 0x141a22, metalness: 0.92, roughness: 0.25 });

    const cBolt1 = new THREE.Mesh(clampBoltGeo, clampBoltMat);
    cBolt1.position.set(-length * 0.5 + halfCoupLen * 0.5, 0, 0);
    cBolt1.castShadow = true;
    shaftGroup.add(cBolt1);

    const cBolt2 = new THREE.Mesh(clampBoltGeo, clampBoltMat);
    cBolt2.position.set(-length * 0.5 - spiderLen - halfCoupLen * 0.5, 0, 0);
    cBolt2.rotation.x = Math.PI / 2;
    cBolt2.castShadow = true;
    shaftGroup.add(cBolt2);
  }

  // 5. Precision Drive Keyway Slot & Fitted Carbon Steel Key
  const keyLength = length * 0.45;
  const keyWidth = 0.065;
  const keyHeight = 0.065;
  const keyGeo = new THREE.BoxGeometry(keyLength, keyHeight, keyWidth);
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0x222a36,
    metalness: 0.88,
    roughness: 0.35,
  });
  const keyMesh = new THREE.Mesh(keyGeo, keyMat);
  keyMesh.position.set(length * 0.12, radius * 0.95, 0);
  keyMesh.castShadow = true;
  shaftGroup.add(keyMesh);

  shaftGroup.userData = {
    type: 'shaft',
    radius,
    length,
  };

  return shaftGroup;
}
