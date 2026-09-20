/**
 * Gear Factory 3D — Simple Gearbox Simulator
 *
 * Requirements & Features:
 * - Two meshing spur gears using existing createSpurGear() function
 * - Input Gear: Default 20 teeth, Clockwise rotation, default 100 RPM
 * - Output Gear: Default 40 teeth, Counter-Clockwise rotation, default 50 RPM
 * - Automatic Calculation of Gear Ratio: gearRatio = outputTeeth / inputTeeth
 * - Automatic Calculation of Output RPM: outputRPM = inputRPM * inputTeeth / outputTeeth
 * - Real-time speed updates whenever parameters change
 * - Input validation: Teeth > 0, RPM >= 0, prevents invalid/empty values from breaking scene
 * - Start, Stop, Reset buttons, OrbitControls, and responsive layout
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ==========================================================================
   1. Simulation State & Gearbox Specifications
   ========================================================================== */
const state = {
  isRunning: false,
  inputTeeth: 20,
  outputTeeth: 40,
  targetInputRPM: 100.0,
  targetOutputRPM: 50.0, // outputRPM = inputRPM * inputTeeth / outputTeeth
  currentInputRPM: 0.0,
  currentOutputRPM: 0.0,
  gearRatio: 40 / 20, // gearRatio = outputTeeth / inputTeeth = 2.00
  inputAngle: 0.0,
  outputAngle: 0.0,
  maxMeterRPM: 150.0,
  accelerationRate: 60.0, // RPM change per second
};

// Common Gear Module (Ensures identical tooth pitch for true conjugate meshing)
const GEAR_MODULE = 0.16;

/* ==========================================================================
   2. DOM Element References
   ========================================================================== */
const canvas = document.getElementById('webgl-canvas');
const statusBadgeEl = document.getElementById('system-status');
const statusLabelEl = statusBadgeEl ? statusBadgeEl.querySelector('.status-label') : null;
const validationStatusEl = document.getElementById('validation-status');

// Gearbox Input Fields
const inputRpmField = document.getElementById('input-rpm-field');
const inputTeethField = document.getElementById('input-teeth-field');
const outputTeethField = document.getElementById('output-teeth-field');

// Live Telemetry Displays
const inputRpmValEl = document.getElementById('input-rpm-val');
const outputRpmValEl = document.getElementById('output-rpm-val');
const inputMeterFillEl = document.getElementById('input-meter-fill');
const outputMeterFillEl = document.getElementById('output-meter-fill');

const statInputTeethEl = document.getElementById('stat-input-teeth');
const statOutputTeethEl = document.getElementById('stat-output-teeth');
const statInputRpmDisplayEl = document.getElementById('stat-input-rpm-display');
const statOutputRpmDisplayEl = document.getElementById('stat-output-rpm-display');
const statGearRatioEl = document.getElementById('stat-gear-ratio');
const gearRatioTagEl = document.getElementById('gear-ratio-tag');

// Legacy compatibility elements
const legacyRpmValueEl = document.getElementById('rpm-value');
const legacyStatTeethEl = document.getElementById('stat-teeth');

// Primary Control Buttons
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnReset = document.getElementById('btn-reset');
const btnCameraReset = document.getElementById('btn-camera-reset');

// Multi-Level Puzzle DOM Elements
const puzzleLevelIndicatorEl = document.getElementById('puzzle-level-indicator');
const puzzleLevelPillEl = document.getElementById('puzzle-level-pill');
const puzzleLevelTitleEl = document.getElementById('puzzle-level-title');
const puzzleLevelNumberEl = document.getElementById('puzzle-level-number');
const puzzleGameStatusEl = document.getElementById('puzzle-game-status');
const puzzleStatusTextEl = document.getElementById('puzzle-status-text');
const puzzleStatusValEl = document.getElementById('puzzle-status-val');
const puzzleInputTeethEl = document.getElementById('puzzle-input-teeth');
const puzzleOutputTeethEl = document.getElementById('puzzle-output-teeth');
const puzzleInputRpmEl = document.getElementById('puzzle-input-rpm');
const puzzleTargetOutputRpmEl = document.getElementById('puzzle-target-output-rpm');
const puzzleCurrentOutputRpmEl = document.getElementById('puzzle-current-output-rpm');
const puzzleCurrentRatioEl = document.getElementById('puzzle-current-ratio');
const puzzleRatioTargetEl = document.getElementById('puzzle-ratio-target');
const puzzleSuccessBannerEl = document.getElementById('puzzle-success-banner');
const puzzleFailBannerEl = document.getElementById('puzzle-fail-banner');
const btnPrevLevel = document.getElementById('btn-prev-level');
const btnNextLevel = document.getElementById('btn-next-level');
const btnCheckSolution = document.getElementById('btn-check-solution');
const btnResetLevel = document.getElementById('btn-reset-level');

// Gear Inventory & Verification DOM Elements
const selectedInputGearDisplayEl = document.getElementById('selected-input-gear-display');
const selectedOutputGearDisplayEl = document.getElementById('selected-output-gear-display');
const resultInputGearEl = document.getElementById('result-input-gear');
const resultOutputGearEl = document.getElementById('result-output-gear');
const puzzleCalculatedOutputRpmEl = document.getElementById('puzzle-calculated-output-rpm');
const puzzleResultTargetRpmEl = document.getElementById('puzzle-result-target-rpm');
const verificationStatusPillEl = document.getElementById('verification-status-pill');
const btnClearSelection = document.getElementById('btn-clear-selection');

/* ==========================================================================
   3. Three.js Scene, Camera, and Renderer Setup
   ========================================================================== */
const container = document.getElementById("three-container");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d14);
scene.fog = new THREE.FogExp2(0x0a0d14, 0.028);

// Perspective Camera positioned to frame both meshing gears
const camera = new THREE.PerspectiveCamera(
  45,
  container && container.clientHeight > 0 ? (container.clientWidth / container.clientHeight) : (window.innerWidth / window.innerHeight),
  0.1,
  100
);
const defaultCameraPos = new THREE.Vector3(-14.5, 14.0, 22.0);
const defaultTargetPos = new THREE.Vector3(0.5, 6.0, 0);
camera.position.copy(defaultCameraPos);

// WebGL Renderer with soft shadows and ACESFilmic tone mapping
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: 'high-performance',
});

if (container && container.clientHeight > 0) {
  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  camera.aspect =
    container.clientWidth / container.clientHeight;

  camera.updateProjectionMatrix();
} else {
  renderer.setSize(window.innerWidth, window.innerHeight);
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// Orbit Controls with damping
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.copy(defaultTargetPos);
controls.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent camera dipping below floor
controls.minDistance = 3.0;
controls.maxDistance = 60.0;

/* ==========================================================================
   4. Factory Lighting & Environment
   ========================================================================== */
// Ambient Light for soft fill
const ambientLight = new THREE.AmbientLight(0xdce5f2, 1.15);
scene.add(ambientLight);

// Key Directional Light casting shadows
const keyLight = new THREE.DirectionalLight(0xfff8ee, 2.6);
keyLight.position.set(10, 18, 12);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 2048;
keyLight.shadow.mapSize.height = 2048;
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 48;
keyLight.shadow.camera.left = -14;
keyLight.shadow.camera.right = 14;
keyLight.shadow.camera.top = 14;
keyLight.shadow.camera.bottom = -14;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight);

// Front Fill Light for crystal-clear internal visibility through acrylic panels
const frontFillLight = new THREE.DirectionalLight(0xcfdcf0, 1.35);
frontFillLight.position.set(-6, 10, 16);
scene.add(frontFillLight);

// Rim Light highlighting metallic gear edges
const rimLight = new THREE.DirectionalLight(0x5a88c2, 1.4);
rimLight.position.set(-12, 8, -10);
scene.add(rimLight);

// Point Lights inside gearbox illuminating each gear and bearing cluster
const inputGearGlow = new THREE.PointLight(0xffd79e, 2.0, 16, 1.5);
inputGearGlow.position.set(-1.0, 7.5, -3.2);
scene.add(inputGearGlow);

const outputGearGlow = new THREE.PointLight(0xb0c8e8, 2.0, 16, 1.5);
outputGearGlow.position.set(1.0, 7.5, 1.6);
scene.add(outputGearGlow);

// Factory Floor Plane receiving shadows
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({
  color: 0x121722,
  roughness: 0.65,
  metalness: 0.35,
});
const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
floorMesh.rotation.x = -Math.PI / 2;
floorMesh.position.y = 0;
floorMesh.receiveShadow = true;
scene.add(floorMesh);

// Precision Grid Helper with industrial steel styling
const gridHelper = new THREE.GridHelper(30, 30, 0x8a929e, 0x1f2736);
gridHelper.position.y = 0.005;
scene.add(gridHelper);

/* ==========================================================================
   5. Reusable createSpurGear() Function — Authentic Involute Profile
   ========================================================================== */
/**
 * Creates an industrial spur gear with mathematically shaped involute teeth,
 * straight teeth parallel to the shaft, central bore, and beveled edges.
 */
function createSpurGear(options = {}) {
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
  // Pitch Radius Rp = (module * teeth) / 2
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

  // 4. Extrude 2D Shape into 3D Solid with Beveled Edges
  const extrudeSettings = {
    steps: 1,
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelOffset: 0,
    bevelSegments: 3,
  };

  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();

  // PBR Metallic Material
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

  // 5. Raised Central Hub Boss
  const hubRadius = boreRadius + 0.24;
  const hubHeight = thickness + 0.14;
  const hubGeo = new THREE.CylinderGeometry(hubRadius, hubRadius + 0.04, hubHeight, 32);
  const hubMat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: Math.min(1.0, metalness + 0.02),
    roughness: Math.min(1.0, roughness + 0.08),
  });
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.rotation.z = Math.PI / 2;
  hubMesh.castShadow = true;
  hubMesh.receiveShadow = true;
  gearGroup.add(hubMesh);

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

const createGear = createSpurGear;

/* ==========================================================================
   6. Industrial Gearbox Components: Motor, Shafts, Casing & Labels
   ========================================================================== */

/**
 * Creates an industrial electric motor with cooling ribs, rear end cover,
 * terminal junction box, mounting foot, and extending drive shaft.
 */
function createMotor(options = {}) {
  const {
    radius = 1.15,
    length = 2.4,
    bodyColor = 0x1a3350, // Dark blue cylindrical motor body
    endCoverColor = 0x122236,
    flangeColor = 0x2c3a4d,
    shaftRadius = 0.28,
    shaftLength = 1.0,
    metalness = 0.78,
    roughness = 0.32,
    ribCount = 8,
  } = options;

  const motorGroup = new THREE.Group();

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

  // 2. Cooling Ribs along the cylindrical body
  const ribMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: Math.min(1.0, metalness + 0.1),
    roughness: roughness,
  });
  const ribSpan = length * 0.75;
  const ribStart = -ribSpan * 0.5;
  const ribStep = ribSpan / (ribCount - 1);
  for (let i = 0; i < ribCount; i++) {
    const rx = ribStart + i * ribStep;
    const ribGeo = new THREE.CylinderGeometry(radius + 0.07, radius + 0.07, 0.06, 36);
    const ribMesh = new THREE.Mesh(ribGeo, ribMat);
    ribMesh.rotation.z = Math.PI / 2;
    ribMesh.position.x = rx;
    ribMesh.castShadow = true;
    motorGroup.add(ribMesh);
  }

  // 3. Smaller Circular End Cover (Fan Cowl at rear / far left: -X)
  const endCoverRadius = radius * 0.92;
  const endCoverLength = 0.45;
  const endCoverGeo = new THREE.CylinderGeometry(endCoverRadius * 0.92, endCoverRadius, endCoverLength, 36);
  const endCoverMat = new THREE.MeshStandardMaterial({
    color: endCoverColor,
    metalness: 0.85,
    roughness: 0.25,
  });
  const endCoverMesh = new THREE.Mesh(endCoverGeo, endCoverMat);
  endCoverMesh.rotation.z = Math.PI / 2;
  endCoverMesh.position.x = -length * 0.5 - endCoverLength * 0.5;
  endCoverMesh.castShadow = true;
  motorGroup.add(endCoverMesh);

  // 4. Front Mounting Flange (B5 Drive-End Flange on right: +X)
  const flangeRadius = radius * 1.22;
  const flangeLength = 0.16;
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
  motorGroup.add(flangeMesh);

  // 5. Terminal Wiring Box on top (+Y)
  const termGeo = new THREE.BoxGeometry(0.65, 0.38, 0.55);
  const termMat = new THREE.MeshStandardMaterial({
    color: endCoverColor,
    metalness: 0.8,
    roughness: 0.3,
  });
  const termMesh = new THREE.Mesh(termGeo, termMat);
  termMesh.position.set(0, radius + 0.19, 0);
  termMesh.castShadow = true;
  motorGroup.add(termMesh);

  // 6. Motor Mounting Base Pedestal (resting on the floor at Y = 0)
  const shaftY = options.shaftY || 3.6;
  const pedestalHeight = Math.max(0.4, shaftY - radius);
  const baseWidth = length * 0.85;
  const baseDepth = radius * 1.8;
  const baseMat = new THREE.MeshStandardMaterial({
    color: 0x1e2733,
    roughness: 0.5,
    metalness: 0.6,
  });
  const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(baseWidth, pedestalHeight, baseDepth), baseMat);
  baseMesh.position.set(0, -radius - pedestalHeight * 0.5, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  motorGroup.add(baseMesh);

  // Pedestal Foot Flange with anchor bolts at floor level
  const footFlangeH = 0.22;
  const footFlangeW = baseWidth + 0.35;
  const footFlangeD = baseDepth + 0.35;
  const footFlangeMesh = new THREE.Mesh(new THREE.BoxGeometry(footFlangeW, footFlangeH, footFlangeD), baseMat);
  footFlangeMesh.position.set(0, -radius - pedestalHeight + footFlangeH * 0.5, 0);
  footFlangeMesh.castShadow = true;
  footFlangeMesh.receiveShadow = true;
  motorGroup.add(footFlangeMesh);

  // 7. Small Motor Shaft extending toward the gearbox (+X)
  const motorShaftGroup = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 32);
  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0xa0acbc,
    metalness: 0.95,
    roughness: 0.18,
  });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.rotation.z = Math.PI / 2;
  shaftMesh.position.x = length * 0.5 + flangeLength + shaftLength * 0.5;
  shaftMesh.castShadow = true;
  motorShaftGroup.add(shaftMesh);

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

/**
 * Creates a precision metallic cylindrical shaft oriented along the X-axis.
 * Supports optional industrial flexible coupling collar and drive keyway.
 */
function createShaft(options = {}) {
  const {
    radius = 0.28,
    length = 2.0,
    color = 0x8a95a5, // Precision ground chrome steel
    metalness = 0.94,
    roughness = 0.20,
    hasCoupling = false,
    couplingRadius = 0.44,
    couplingLength = 0.46,
  } = options;

  const shaftGroup = new THREE.Group();

  // 1. Main Shaft Cylinder along X-axis
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, length, 32);
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

  // 2. Optional Flexible Shaft Coupling (for Input Shaft connecting to motor)
  if (hasCoupling) {
    const coupGeo = new THREE.CylinderGeometry(couplingRadius, couplingRadius, couplingLength, 24);
    const coupMat = new THREE.MeshStandardMaterial({
      color: 0x364152,
      metalness: 0.90,
      roughness: 0.35,
    });
    const coupMesh = new THREE.Mesh(coupGeo, coupMat);
    coupMesh.rotation.z = Math.PI / 2;
    coupMesh.position.x = -length * 0.5 + couplingLength * 0.5;
    coupMesh.castShadow = true;
    shaftGroup.add(coupMesh);

    // Simulated radial clamping bolts on coupling
    for (let b = 0; b < 4; b++) {
      const bAngle = (b * Math.PI) / 2;
      const bGeo = new THREE.CylinderGeometry(0.05, 0.05, couplingRadius * 2 + 0.04, 8);
      const bMat = new THREE.MeshStandardMaterial({ color: 0x1f2631, metalness: 0.9, roughness: 0.4 });
      const bMesh = new THREE.Mesh(bGeo, bMat);
      bMesh.position.set(-length * 0.5 + couplingLength * 0.5, 0, 0);
      bMesh.rotation.x = bAngle;
      shaftGroup.add(bMesh);
    }
  }

  // 3. Drive Keyway Bar (provides clear visual confirmation of rotation)
  const keyGeo = new THREE.BoxGeometry(length * 0.45, 0.07, 0.07);
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0x252e3b,
    metalness: 0.85,
    roughness: 0.4,
  });
  const keyMesh = new THREE.Mesh(keyGeo, keyMat);
  keyMesh.position.set(length * 0.15, radius * 0.95, 0);
  shaftGroup.add(keyMesh);

  shaftGroup.userData = {
    type: 'shaft',
    radius,
    length,
  };

  return shaftGroup;
}

/**
 * Creates a high-fidelity industrial deep-groove ball bearing.
 * Reusable function with default parameters:
 * { outerRadius = 5.0, innerRadius = 2.5, width = 2.0, ballCount = 10 }
 *
 * Requirements:
 * 1. Stationary outer ring: Thick ring-shaped geometry, metallic dark-gray material, fixed to housing.
 * 2. Rotating inner ring: Smaller ring/cylinder, metallic steel material, rotates with shaft.
 * 3. Visible bearing balls: 10 small chrome spheres evenly spaced around pitch circle.
 * 4. Bearing axis strictly matches shaft axis (X-axis) so shaft passes through inner ring.
 * 5. Outer ring & balls remain stationary, inner ring rotates with shaft.
 */
function createBallBearing(options = {}) {
  const {
    outerRadius = 5.0,
    innerRadius = 2.5,
    width = 2.0,
    ballCount = 10,
    outerColor = 0x2b333e, // Metallic dark-gray
    innerColor = 0xa8b8ca, // Precision ground metallic steel
    ballColor = 0xffffff, // Mirror chrome
    metalness = 0.94,
    roughness = 0.22,
  } = options;

  const bearingGroup = new THREE.Group();

  // Radial dimensions
  const radialSpan = outerRadius - innerRadius;
  const innerRingOuterR = innerRadius + radialSpan * 0.28;
  const outerRingInnerR = outerRadius - radialSpan * 0.28;
  const ballPitchR = (innerRingOuterR + outerRingInnerR) * 0.5;
  const ballRadius = (outerRingInnerR - innerRingOuterR) * 0.46;

  // 1. Stationary Outer Ring (Thick ring-shaped geometry, metallic dark-gray)
  const outerRingGroup = new THREE.Group();
  const outerShape = new THREE.Shape();
  outerShape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const outerHole = new THREE.Path();
  outerHole.absarc(0, 0, outerRingInnerR, 0, Math.PI * 2, true);
  outerShape.holes.push(outerHole);

  const outerGeom = new THREE.ExtrudeGeometry(outerShape, {
    depth: width * 0.68,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: width * 0.025,
    bevelThickness: width * 0.025,
  });
  outerGeom.center();
  outerGeom.rotateY(Math.PI / 2); // Orient concentric with X-axis shaft

  const outerMat = new THREE.MeshStandardMaterial({
    color: outerColor,
    metalness: 0.88,
    roughness: 0.32,
  });
  const outerRingMesh = new THREE.Mesh(outerGeom, outerMat);
  outerRingMesh.castShadow = true;
  outerRingMesh.receiveShadow = true;
  outerRingGroup.add(outerRingMesh);
  bearingGroup.add(outerRingGroup);

  // 2. Rotating Inner Ring (Smaller ring/cylinder, metallic steel, rotates with shaft)
  const innerRingGroup = new THREE.Group();
  const innerShape = new THREE.Shape();
  innerShape.absarc(0, 0, innerRingOuterR, 0, Math.PI * 2, false);
  const innerHole = new THREE.Path();
  innerHole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  innerShape.holes.push(innerHole);

  const innerGeom = new THREE.ExtrudeGeometry(innerShape, {
    depth: width * 0.66,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: width * 0.02,
    bevelThickness: width * 0.02,
  });
  innerGeom.center();
  innerGeom.rotateY(Math.PI / 2); // Orient concentric with X-axis shaft

  const innerMat = new THREE.MeshStandardMaterial({
    color: innerColor,
    metalness: 0.96,
    roughness: 0.16,
  });
  const innerRingMesh = new THREE.Mesh(innerGeom, innerMat);
  innerRingMesh.castShadow = true;
  innerRingMesh.receiveShadow = true;
  innerRingGroup.add(innerRingMesh);

  // Precision drive keyway notch on inner ring face
  const notchGeo = new THREE.BoxGeometry(width + 0.02, width * 0.12, width * 0.12);
  const notchMat = new THREE.MeshStandardMaterial({ color: 0x181f29, roughness: 0.5 });
  const notchMesh = new THREE.Mesh(notchGeo, notchMat);
  notchMesh.position.set(0, innerRadius + width * 0.06, 0);
  innerRingGroup.add(notchMesh);

  bearingGroup.add(innerRingGroup);

  // 3. Visible Bearing Balls (Evenly spaced chrome spheres around pitch circle)
  const ballsGroup = new THREE.Group();
  const ballGeo = new THREE.SphereGeometry(ballRadius, 24, 24);
  const ballMat = new THREE.MeshStandardMaterial({
    color: ballColor,
    metalness: 1.0,
    roughness: 0.04,
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

  // Toroidal bronze ball retainer cage
  const cageMat = new THREE.MeshStandardMaterial({
    color: 0xc27803,
    metalness: 0.85,
    roughness: 0.30,
  });
  const cageTorus = new THREE.Mesh(
    new THREE.TorusGeometry(ballPitchR, ballRadius * 0.26, 12, 36),
    cageMat
  );
  cageTorus.rotation.y = Math.PI / 2;
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

// Backward compatibility alias
const createBearing = createBallBearing;

/**
 * Creates an open industrial bearing mounting housing / flange bracket.
 * Fixed to the gearbox casing wall, gripping the outer ring from the outside
 * while leaving the face (balls and rings) 100% visible through the inspection window.
 */
function createBearingHousing(options = {}) {
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

  // 1. Open Annular Retaining Collar (Hollow ring gripping ONLY the outer diameter of the outer ring)
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
  // Mount toward outer casing wall (-X for left, +X for right)
  collarMesh.position.x = -flangeFacing * (width * 0.20);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  housingGroup.add(collarMesh);

  // 2. Heavy Mounting Flange Bracket against casing bulkhead (Hollow so shaft passes through cleanly)
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
  // Placed against casing side wall (-X for left wall, +X for right wall)
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
 */
function createShaftSupport(options = {}) {
  const {
    shaftRadius = 0.32,
    innerRadius = shaftRadius + 0.012,
    outerRadius = shaftRadius * 2.25,
    width = shaftRadius * 1.05,
    ballCount = 10,
    targetShaft = 'input', // 'input' or 'output'
    housingColor = 0x384452,
    outerColor = 0x2b333e,
    innerColor = 0xa8b8ca,
    flangeFacing = 1,
  } = options;

  const supportGroup = new THREE.Group();

  // 1. Bearing Housing (Stationary open bracket on casing wall)
  const housing = createBearingHousing({
    bearingOuterRadius: outerRadius,
    width: width + 0.04,
    color: housingColor,
    flangeFacing,
  });
  supportGroup.add(housing);

  // 2. Ball Bearing Component (createBallBearing)
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
 */
function createMountingFeet(options = {}) {
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

  // 4 corner positions at base
  const xOffsets = [-width * 0.5 + footSize.x * 0.45, width * 0.5 - footSize.x * 0.45];
  const zOffsets = [-depth * 0.5 + footSize.z * 0.45, depth * 0.5 - footSize.z * 0.45];

  for (const ox of xOffsets) {
    for (const oz of zOffsets) {
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(ox, footSize.y * 0.5, oz);
      foot.castShadow = true;
      foot.receiveShadow = true;
      group.add(foot);

      // Anchor Bolt with lock washer
      const bolt = new THREE.Mesh(boltGeo, boltMat);
      bolt.position.set(ox, footSize.y * 0.5, oz);
      bolt.castShadow = true;
      group.add(bolt);
    }
  }

  group.userData = { type: 'mounting_feet' };
  return group;
}

/**
 * Creates a rectangular industrial gearbox housing enclosing both gears,
 * featuring structural corner pillars, semi-transparent inspection windows,
 * top cover lid with lifting eye, and side panels with bearing pass-throughs.
 */
function createGearboxCasing(options = {}) {
  const {
    widthX = 2.6,
    heightY = 6.4,
    depthZ = 7.2,
    frameColor = 0x3d4754, // Cast iron metallic gray
    panelColor = 0x8ab2d6, // Inspection acrylic window
    panelOpacity = 0.32,
    metalness = 0.86,
    roughness = 0.28,
  } = options;

  const casingGroup = new THREE.Group();

  // 1. Four Structural Corner Pillars
  const pillarGeo = new THREE.BoxGeometry(0.24, heightY, 0.24);
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: metalness,
    roughness: roughness,
  });

  const xCorners = [-widthX * 0.5 + 0.12, widthX * 0.5 - 0.12];
  const zCorners = [-depthZ * 0.5 + 0.12, depthZ * 0.5 - 0.12];

  for (const cx of xCorners) {
    for (const cz of zCorners) {
      const pillar = new THREE.Mesh(pillarGeo, frameMat);
      pillar.position.set(cx, heightY * 0.5, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      casingGroup.add(pillar);
    }
  }

  // 2. Base Perimeter Flange Rails
  const railH = 0.25;
  const railXGeo = new THREE.BoxGeometry(widthX, railH, 0.24);
  const rFront = new THREE.Mesh(railXGeo, frameMat);
  rFront.position.set(0, railH * 0.5, depthZ * 0.5 - 0.12);
  rFront.castShadow = true;
  casingGroup.add(rFront);

  const rBack = new THREE.Mesh(railXGeo, frameMat);
  rBack.position.set(0, railH * 0.5, -depthZ * 0.5 + 0.12);
  rBack.castShadow = true;
  casingGroup.add(rBack);

  const railZGeo = new THREE.BoxGeometry(0.24, railH, depthZ);
  const rLeft = new THREE.Mesh(railZGeo, frameMat);
  rLeft.position.set(-widthX * 0.5 + 0.12, railH * 0.5, 0);
  rLeft.castShadow = true;
  casingGroup.add(rLeft);

  const rRight = new THREE.Mesh(railZGeo, frameMat);
  rRight.position.set(widthX * 0.5 - 0.12, railH * 0.5, 0);
  rRight.castShadow = true;
  casingGroup.add(rRight);

  // 3. Top Cover Lid with Hex Bolted Flange & Lifting Eye Bolt
  const lidH = 0.24;
  const topCoverGeo = new THREE.BoxGeometry(widthX + 0.2, lidH, depthZ + 0.2);
  const topCoverMesh = new THREE.Mesh(topCoverGeo, frameMat);
  topCoverMesh.position.set(0, heightY + lidH * 0.5, 0);
  topCoverMesh.castShadow = true;
  topCoverMesh.receiveShadow = true;
  casingGroup.add(topCoverMesh);

  // Lifting Eye Bolt on top center
  const eyeTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.08, 16, 24),
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.2 })
  );
  eyeTorus.position.set(0, heightY + lidH + 0.34, 0);
  eyeTorus.castShadow = true;
  casingGroup.add(eyeTorus);

  // 4. Semi-Transparent / Inspection Windows (Front & Back)
  // Transparent acrylic panels allow the meshing gears to remain 100% visible
  const windowMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    transparent: true,
    opacity: panelOpacity,
    roughness: 0.12,
    metalness: 0.35,
    depthWrite: false, // Prevents z-buffer sorting artifacts with inside gears
    side: THREE.DoubleSide,
  });

  const windowGeo = new THREE.PlaneGeometry(widthX - 0.28, heightY - 0.6);
  const frontWindow = new THREE.Mesh(windowGeo, windowMat);
  frontWindow.position.set(0, heightY * 0.5 + 0.1, depthZ * 0.5 - 0.02);
  casingGroup.add(frontWindow);

  const backWindow = new THREE.Mesh(windowGeo, windowMat);
  backWindow.position.set(0, heightY * 0.5 + 0.1, -depthZ * 0.5 + 0.02);
  backWindow.rotation.y = Math.PI;
  casingGroup.add(backWindow);

  // Side Inspection Windows (Left & Right walls)
  const sideWindowGeo = new THREE.PlaneGeometry(depthZ - 0.28, heightY - 0.6);
  const rightSideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
  rightSideWindow.rotation.y = Math.PI / 2;
  rightSideWindow.position.set(widthX * 0.5 - 0.02, heightY * 0.5 + 0.1, 0);
  casingGroup.add(rightSideWindow);

  const leftSideWindow = new THREE.Mesh(sideWindowGeo, windowMat);
  leftSideWindow.rotation.y = -Math.PI / 2;
  leftSideWindow.position.set(-widthX * 0.5 + 0.02, heightY * 0.5 + 0.1, 0);
  casingGroup.add(leftSideWindow);

  // 5. Left & Right Side Panels with Shaft Bearing Retainers
  const bearingFlangeGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.28, 24);
  const bearingMat = new THREE.MeshStandardMaterial({
    color: 0x2b3542,
    metalness: 0.92,
    roughness: 0.25,
  });

  // Left bearing retainer (Input shaft pass-through)
  const leftBearing = new THREE.Mesh(bearingFlangeGeo, bearingMat);
  leftBearing.rotation.z = Math.PI / 2;
  leftBearing.position.set(-widthX * 0.5 - 0.08, options.shaftY || 3.6, options.inputZ || -2.4);
  leftBearing.castShadow = true;
  casingGroup.add(leftBearing);

  // Right bearing retainer (Output shaft pass-through)
  const rightBearing = new THREE.Mesh(bearingFlangeGeo, bearingMat);
  rightBearing.rotation.z = Math.PI / 2;
  rightBearing.position.set(widthX * 0.5 + 0.08, options.shaftY || 3.6, options.outputZ || 2.4);
  rightBearing.castShadow = true;
  casingGroup.add(rightBearing);

  // 6. Integrated Four Mounting Feet
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
 */
function createLabel(text, options = {}) {
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

  // Group containing Sprite, Anchor Sphere, and Leader Line
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

/* ==========================================================================
   7. Gearbox Kinematics, Safe Clearances & 3D Assembly Construction
   ========================================================================== */

/**
 * Calculates complete gear outer radius and geometry parameters.
 * Requirement 3: gearOuterRadius = gearBodyRadius + toothDepth
 */
function calculateGearOuterRadius(teeth, module = GEAR_MODULE) {
  const pitchRadius = (module * teeth) / 2;
  const addendum = module * 0.95;
  const dedendum = module * 1.15;
  const toothDepth = addendum + dedendum;
  const gearBodyRadius = pitchRadius - dedendum; // root circle radius
  // Requirement 3: gearOuterRadius = gearBodyRadius + toothDepth
  const gearOuterRadius = gearBodyRadius + toothDepth; // = pitchRadius + addendum (crest tip radius)
  const gearDiameter = gearOuterRadius * 2;
  const gearThickness = 0.65;
  const hubThickness = 0.79;

  return {
    teeth,
    module,
    pitchRadius,
    gearBodyRadius,
    toothDepth,
    gearOuterRadius,
    gearDiameter,
    gearThickness,
    hubThickness,
  };
}

// Variables holding current 3D component instances
let motor = null;
let motorShaft = null;
let inputShaft = null;
let outputShaft = null;
let inputGear = null;
let outputGear = null;
let gearboxCasing = null;
let labelsGroup = null;
let bearingSupports = [];
let inputSupportLeft = null;
let inputSupportRight = null;
let outputSupportLeft = null;
let outputSupportRight = null;
let initialPhaseOutput = 0.0;
let currentShaftElevationY = 6.2;
let selectedInputTeeth = 20;
let selectedOutputTeeth = 30;

/**
 * Rebuilds the industrial gearbox assembly with guaranteed safe clearances (2 to 5 units).
 * Ensures both gears are completely enclosed inside the housing without any clipping.
 */
function buildGearTrain() {
  // 1. Calculate complete outer radius of each gear (Requirement 3)
  const effInTeeth = selectedInputTeeth || 20;
  const effOutTeeth = selectedOutputTeeth || 30;
  const inDim = calculateGearOuterRadius(effInTeeth, GEAR_MODULE);
  const outDim = calculateGearOuterRadius(effOutTeeth, GEAR_MODULE);

  const centerDistance = inDim.pitchRadius + outDim.pitchRadius;
  const maxGearOuterRadius = Math.max(inDim.gearOuterRadius, outDim.gearOuterRadius);
  const maxGearDiameter = maxGearOuterRadius * 2;

  // Requirement 6: Safe clearance around every gear (clearance = 2 to 5 Three.js units)
  const safeClearance = 2.5; // Exactly in the range 2.0 to 5.0 Three.js units

  // 2. Shaft Elevation Y: Guarantees safe bottom clearance above floor rail
  const floorRailHeight = 0.25;
  currentShaftElevationY = maxGearOuterRadius + safeClearance + floorRailHeight;
  const shaftY = currentShaftElevationY;

  // 3. Parallel Shaft Z Positions: Symmetrically centered around Z = 0
  const totalGearSpanZ = centerDistance + inDim.gearOuterRadius + outDim.gearOuterRadius;
  const halfGearSpanZ = totalGearSpanZ * 0.5;

  const posZInput = -halfGearSpanZ + inDim.gearOuterRadius;
  const posZOutput = +halfGearSpanZ - outDim.gearOuterRadius;

  // 4. Calculate Casing Internal Dimensions (Requirement 7)
  // Must be larger than: complete gear diameter, gear thickness, shaft clearance, tooth clearance
  const casingInternalWidthX = inDim.hubThickness + safeClearance * 2; // ~ 5.79 units (X clearance: ~2.5 each side)
  const casingInternalHeightY = shaftY + maxGearOuterRadius + safeClearance; // ~ 12.1 units (Y clearance: ~2.5 top & bottom)
  const casingInternalDepthZ = totalGearSpanZ + safeClearance * 2; // ~ 14.9 units (Z clearance: ~2.5 front & back)

  // 5. Requirement 13: Console/Debug Values
  const debugTelemetry = {
    inputGearCenter: { x: 0, y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) },
    outputGearCenter: { x: 0, y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) },
    inputGearOuterRadius: Number(inDim.gearOuterRadius.toFixed(3)),
    outputGearOuterRadius: Number(outDim.gearOuterRadius.toFixed(3)),
    inputGearDiameter: Number(inDim.gearDiameter.toFixed(3)),
    outputGearDiameter: Number(outDim.gearDiameter.toFixed(3)),
    casingInternalDimensions: {
      widthX: Number(casingInternalWidthX.toFixed(3)),
      heightY: Number(casingInternalHeightY.toFixed(3)),
      lengthZ: Number(casingInternalDepthZ.toFixed(3)),
    },
    safeClearanceUnits: safeClearance,
    clearanceChecks: {
      clearanceX: Number((casingInternalWidthX * 0.5 - inDim.hubThickness * 0.5).toFixed(3)),
      clearanceYBottom: Number((shaftY - maxGearOuterRadius - floorRailHeight).toFixed(3)),
      clearanceYTop: Number((casingInternalHeightY - (shaftY + maxGearOuterRadius)).toFixed(3)),
      clearanceZFront: Number((casingInternalDepthZ * 0.5 - (posZOutput + outDim.gearOuterRadius)).toFixed(3)),
      clearanceZBack: Number((-posZInput + inDim.gearOuterRadius - casingInternalDepthZ * 0.5) * -1).toFixed(3),
    },
  };

  console.log('=== GEARBOX ASSEMBLY DIMENSIONS & CLEARANCE TELEMETRY ===');
  console.log('Input Gear Center:', debugTelemetry.inputGearCenter);
  console.log('Output Gear Center:', debugTelemetry.outputGearCenter);
  console.log(`Input Gear Outer Radius: ${debugTelemetry.inputGearOuterRadius} units (Diameter: ${debugTelemetry.inputGearDiameter})`);
  console.log(`Output Gear Outer Radius: ${debugTelemetry.outputGearOuterRadius} units (Diameter: ${debugTelemetry.outputGearDiameter})`);
  console.log('Casing Internal Dimensions:', debugTelemetry.casingInternalDimensions);
  console.log('Tooth & Shaft Clearance Check:', debugTelemetry.clearanceChecks);

  // 6. Clean up previous objects from scene
  if (motor) scene.remove(motor);
  if (inputShaft) scene.remove(inputShaft);
  if (outputShaft) scene.remove(outputShaft);
  if (inputGear) scene.remove(inputGear);
  if (outputGear) scene.remove(outputGear);
  if (gearboxCasing) scene.remove(gearboxCasing);
  if (labelsGroup) scene.remove(labelsGroup);
  bearingSupports.forEach((s) => scene.remove(s));
  bearingSupports = [];

  // 7. Create Gearbox Casing (Requirement 1, 10, 11)
  // Transparent front & side panels keep gears completely visible inside
  gearboxCasing = createGearboxCasing({
    widthX: casingInternalWidthX,
    heightY: casingInternalHeightY,
    depthZ: casingInternalDepthZ,
    shaftY: shaftY,
    inputZ: posZInput,
    outputZ: posZOutput,
  });
  gearboxCasing.position.set(0, 0, 0);
  scene.add(gearboxCasing);

  // 8. Create Electric Motor on the left side (-X)
  const motorX = -casingInternalWidthX * 0.5 - 2.5;
  motor = createMotor({
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
  motorShaft = motor.userData.shaftGroup;

  // 9. Create Input Shaft (Connects motor shaft through input gear to right casing bearing)
  // Straddle-mounted support spanning across both casing walls
  const inputShaftTotalLength = casingInternalWidthX + 1.4;
  const inputShaftCenterX = -0.7; // (-casingInternalWidthX * 0.5 - 1.4 + casingInternalWidthX * 0.5) / 2
  inputShaft = createShaft({
    radius: 0.32,
    length: inputShaftTotalLength,
    color: 0x94a3b8,
    hasCoupling: true,
  });
  inputShaft.position.set(inputShaftCenterX, shaftY, posZInput);
  scene.add(inputShaft);

  // 10. Create Input Gear (Brass Gold, rotates Clockwise)
  if (selectedInputTeeth) {
    inputGear = createSpurGear({
      teeth: selectedInputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.42,
      color: 0xd4a044, // Burnished Brass Gold
      metalness: 0.90,
      roughness: 0.28,
    });
    inputGear.position.set(0, shaftY, posZInput);
    scene.add(inputGear);
  } else {
    inputGear = null;
  }

  // 11. Create Output Gear (Chrome Steel, rotates Counter-Clockwise)
  if (selectedOutputTeeth) {
    outputGear = createSpurGear({
      teeth: selectedOutputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.50,
      color: 0x7c8d9f, // Industrial Chrome Steel
      metalness: 0.94,
      roughness: 0.22,
    });
    outputGear.position.set(0, shaftY, posZOutput);
    scene.add(outputGear);

    // Meshing alignment phase: Offset output gear so tooth fits into input gap
    initialPhaseOutput = Math.PI / selectedOutputTeeth;
    outputGear.rotation.x = initialPhaseOutput;
  } else {
    outputGear = null;
    initialPhaseOutput = 0.0;
  }

  // 12. Create Output Shaft (Extends from left bearing through output gear to external drive)
  // Straddle-mounted support spanning across both casing walls with extended takeoff
  const outputShaftTotalLength = casingInternalWidthX + 6.0;
  const outputShaftCenterX = 3.0; // (-casingInternalWidthX * 0.5 + casingInternalWidthX * 0.5 + 6.0) / 2
  outputShaft = createShaft({
    radius: 0.40,
    length: outputShaftTotalLength,
    color: 0x8a95a5,
    hasCoupling: false,
  });
  outputShaft.position.set(outputShaftCenterX, shaftY, posZOutput);
  outputShaft.rotation.x = initialPhaseOutput;
  scene.add(outputShaft);

  // 13. Create Realistic Bearing Supports (Left and Right for both shafts)
  // Positioned near casing walls, inside the casing, with zero gear overlap
  const bearingX = casingInternalWidthX * 0.5 - 0.40; // ~ 2.495 from center (wall is at 2.895)

  // 13a. Input Shaft Bearings (Left & Right) - 10 Chrome Balls, Dark Outer Ring, Steel Inner Ring
  inputSupportLeft = createShaftSupport({
    shaftRadius: 0.32,
    innerRadius: 0.33,
    outerRadius: 0.72,
    width: 0.34,
    ballCount: 10,
    targetShaft: 'input',
    housingColor: 0x384452,
    flangeFacing: 1,
  });
  inputSupportLeft.position.set(-bearingX, shaftY, posZInput);
  scene.add(inputSupportLeft);
  bearingSupports.push(inputSupportLeft);

  inputSupportRight = createShaftSupport({
    shaftRadius: 0.32,
    innerRadius: 0.33,
    outerRadius: 0.72,
    width: 0.34,
    ballCount: 10,
    targetShaft: 'input',
    housingColor: 0x384452,
    flangeFacing: -1,
  });
  inputSupportRight.position.set(bearingX, shaftY, posZInput);
  scene.add(inputSupportRight);
  bearingSupports.push(inputSupportRight);

  // 13b. Output Shaft Bearings (Left & Right) - 10 Chrome Balls, Dark Outer Ring, Steel Inner Ring
  outputSupportLeft = createShaftSupport({
    shaftRadius: 0.40,
    innerRadius: 0.41,
    outerRadius: 0.86,
    width: 0.38,
    ballCount: 10,
    targetShaft: 'output',
    housingColor: 0x384452,
    flangeFacing: 1,
  });
  outputSupportLeft.position.set(-bearingX, shaftY, posZOutput);
  scene.add(outputSupportLeft);
  bearingSupports.push(outputSupportLeft);

  outputSupportRight = createShaftSupport({
    shaftRadius: 0.40,
    innerRadius: 0.41,
    outerRadius: 0.86,
    width: 0.38,
    ballCount: 10,
    targetShaft: 'output',
    housingColor: 0x384452,
    flangeFacing: -1,
  });
  outputSupportRight.position.set(bearingX, shaftY, posZOutput);
  scene.add(outputSupportRight);
  bearingSupports.push(outputSupportRight);

  // 14. Visual Labels Group (Requirement 5)
  labelsGroup = new THREE.Group();

  const labelMotor = createLabel('MOTOR', {
    borderColor: '#38bdf8',
    subtext: `${state.targetInputRPM.toFixed(0)} RPM • Drive Unit`,
    scale: 0.95,
  });
  labelMotor.position.set(motorX, shaftY + 2.5, posZInput);
  labelsGroup.add(labelMotor);

  const labelInShaft = createLabel('INPUT SHAFT', {
    borderColor: '#e5a93c',
    subtext: 'Coupled • CW Rotation',
    scale: 0.90,
  });
  labelInShaft.position.set(-inputShaftTotalLength * 0.4, shaftY + 1.4, posZInput);
  labelsGroup.add(labelInShaft);

  const labelInGear = createLabel('INPUT GEAR', {
    borderColor: '#e5a93c',
    subtext: selectedInputTeeth ? `${selectedInputTeeth}T Selected • Brass Gold` : 'Unmounted • Bare Shaft',
    scale: 0.90,
  });
  labelInGear.position.set(0, shaftY + inDim.gearOuterRadius + 1.2, posZInput);
  labelsGroup.add(labelInGear);

  const labelOutGear = createLabel('OUTPUT GEAR', {
    borderColor: '#60a5fa',
    subtext: selectedOutputTeeth ? `${selectedOutputTeeth}T Selected • Chrome Steel` : 'Unmounted • Bare Shaft',
    scale: 0.90,
  });
  labelOutGear.position.set(0, shaftY + outDim.gearOuterRadius + 1.2, posZOutput);
  labelsGroup.add(labelOutGear);

  const labelOutShaft = createLabel('OUTPUT SHAFT', {
    borderColor: '#60a5fa',
    subtext: 'Extended Output Drive • CCW',
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

  // Update Point lights above gears
  inputGearGlow.position.set(-1.0, shaftY + 3.0, posZInput);
  outputGearGlow.position.set(1.0, shaftY + 3.0, posZOutput);

  // Expose debug data on window with bearing telemetry
  debugTelemetry.bearingSupports = {
    bearingX: Number(bearingX.toFixed(3)),
    inputLeft: { x: Number((-bearingX).toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) },
    inputRight: { x: Number(bearingX.toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZInput.toFixed(3)) },
    outputLeft: { x: Number((-bearingX).toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) },
    outputRight: { x: Number(bearingX.toFixed(3)), y: Number(shaftY.toFixed(3)), z: Number(posZOutput.toFixed(3)) },
    distanceToGearHub: Number((bearingX - inDim.hubThickness * 0.5).toFixed(3)),
  };
  window.gearFactoryDebug = debugTelemetry;
}

// Initial build
buildGearTrain();

/* ==========================================================================
   8. Input Validation & Gearbox Parameter Calculations
   ========================================================================== */
/**
 * Validates user inputs:
 * - Teeth must be greater than zero
 * - RPM cannot be negative
 * - Prevents invalid or empty values from breaking the scene
 */
function validateInputs() {
  const rawRpm = inputRpmField ? inputRpmField.value.trim() : '100';
  const rawInTeeth = inputTeethField ? inputTeethField.value.trim() : '20';
  const rawOutTeeth = outputTeethField ? outputTeethField.value.trim() : '40';

  const rpm = parseFloat(rawRpm);
  const inTeeth = parseInt(rawInTeeth, 10);
  const outTeeth = parseInt(rawOutTeeth, 10);

  let isValid = true;
  let errorMsg = '';

  // Validate Input RPM
  if (rawRpm === '' || isNaN(rpm)) {
    isValid = false;
    errorMsg = 'RPM cannot be empty';
    if (inputRpmField) inputRpmField.classList.add('input-error');
  } else if (rpm < 0) {
    isValid = false;
    errorMsg = 'RPM cannot be negative';
    if (inputRpmField) inputRpmField.classList.add('input-error');
  } else {
    if (inputRpmField) inputRpmField.classList.remove('input-error');
  }

  // Validate Input Teeth (must be integer > 0)
  if (rawInTeeth === '' || isNaN(inTeeth) || inTeeth <= 0) {
    isValid = false;
    errorMsg = 'Input teeth must be > 0';
    if (inputTeethField) inputTeethField.classList.add('input-error');
  } else {
    if (inputTeethField) inputTeethField.classList.remove('input-error');
  }

  // Validate Output Teeth (must be integer > 0)
  if (rawOutTeeth === '' || isNaN(outTeeth) || outTeeth <= 0) {
    isValid = false;
    errorMsg = 'Output teeth must be > 0';
    if (outputTeethField) outputTeethField.classList.add('input-error');
  } else {
    if (outputTeethField) outputTeethField.classList.remove('input-error');
  }

  // Update status badge
  if (!isValid) {
    if (validationStatusEl) {
      validationStatusEl.textContent = errorMsg;
      validationStatusEl.className = 'validation-status error';
    }
    return null; // Don't apply invalid values
  }

  if (validationStatusEl) {
    validationStatusEl.textContent = 'STATUS: OK';
    validationStatusEl.className = 'validation-status ok';
  }

  return { rpm, inTeeth, outTeeth };
}

/**
 * Recalculates gearbox formulas and updates output gear rotation speed automatically
 */
function updateGearboxParameters() {
  const validated = validateInputs();
  if (!validated) return; // Prevent invalid inputs from breaking the simulation

  const { rpm, inTeeth, outTeeth } = validated;

  // 1. Update Target Input RPM
  state.targetInputRPM = rpm;

  // 2. Check if teeth counts changed: dynamically rebuild 3D gears
  if (inTeeth !== state.inputTeeth || outTeeth !== state.outputTeeth) {
    state.inputTeeth = inTeeth;
    state.outputTeeth = outTeeth;
    buildGearTrain();
  }

  // 3. Automatically calculate gear ratio:
  // gearRatio = outputTeeth / inputTeeth
  state.gearRatio = state.outputTeeth / state.inputTeeth;

  // 4. Calculate output RPM:
  // outputRPM = inputRPM * inputTeeth / outputTeeth
  state.targetOutputRPM = (state.targetInputRPM * state.inputTeeth) / state.outputTeeth;

  // 5. Update Telemetry HUD Displays
  updateStaticHUDDisplays();

  // 6. Update Puzzle Solution State
  checkPuzzleSolution(false);
}

/**
 * Updates static telemetry labels on screen
 */
function updateStaticHUDDisplays() {
  if (statInputTeethEl) statInputTeethEl.textContent = `${state.inputTeeth} T`;
  if (statOutputTeethEl) statOutputTeethEl.textContent = `${state.outputTeeth} T`;

  if (statInputRpmDisplayEl) statInputRpmDisplayEl.textContent = state.targetInputRPM.toFixed(1);
  if (statOutputRpmDisplayEl) statOutputRpmDisplayEl.textContent = state.targetOutputRPM.toFixed(1);

  const ratioVal = state.gearRatio;
  if (statGearRatioEl) {
    statGearRatioEl.textContent = `${ratioVal.toFixed(2)} : 1 (${ratioVal.toFixed(2)}x)`;
  }
  if (gearRatioTagEl) {
    gearRatioTagEl.textContent = `RATIO ${ratioVal.toFixed(2)} : 1`;
  }

  if (legacyStatTeethEl) {
    legacyStatTeethEl.textContent = `${state.inputTeeth} T`;
  }
}

// Initial HUD sync
updateStaticHUDDisplays();

// Event Listeners for real-time parameter changes
inputRpmField?.addEventListener('input', updateGearboxParameters);
inputTeethField?.addEventListener('input', updateGearboxParameters);
outputTeethField?.addEventListener('input', updateGearboxParameters);

/* ==========================================================================
   9. Primary Action Buttons (Start, Stop, Reset)
   ========================================================================== */
function setRunningState(running) {
  state.isRunning = running;

  if (running) {
    if (statusBadgeEl) {
      statusBadgeEl.className = 'status-badge active';
      if (statusLabelEl) statusLabelEl.textContent = 'RUNNING';
    }
  } else {
    if (statusBadgeEl) {
      statusBadgeEl.className = 'status-badge stopped';
      if (statusLabelEl) statusLabelEl.textContent = 'STOPPED';
    }
  }
}

// Button: Start
btnStart?.addEventListener('click', () => {
  setRunningState(true);
});

// Button: Stop
btnStop?.addEventListener('click', () => {
  setRunningState(false);
});

// Button: Reset — restores default parameters (100 RPM, 20T, 40T) and resets orientation
btnReset?.addEventListener('click', () => {
  state.isRunning = false;
  state.currentInputRPM = 0.0;
  state.currentOutputRPM = 0.0;
  state.inputAngle = 0.0;
  state.outputAngle = 0.0;

  // Restore default inputs
  if (inputRpmField) inputRpmField.value = '100';
  if (inputTeethField) inputTeethField.value = '20';
  if (outputTeethField) outputTeethField.value = '40';

  updateGearboxParameters();

  // Reset gear and shaft orientations
  if (inputGear) inputGear.rotation.x = 0.0;
  if (outputGear) outputGear.rotation.x = initialPhaseOutput;
  if (motorShaft) motorShaft.rotation.x = 0.0;
  if (inputShaft) inputShaft.rotation.x = 0.0;
  if (outputShaft) outputShaft.rotation.x = initialPhaseOutput;
  if (inputSupportLeft?.userData?.innerRing) inputSupportLeft.userData.innerRing.rotation.x = 0.0;
  if (inputSupportRight?.userData?.innerRing) inputSupportRight.userData.innerRing.rotation.x = 0.0;
  if (outputSupportLeft?.userData?.innerRing) outputSupportLeft.userData.innerRing.rotation.x = initialPhaseOutput;
  if (outputSupportRight?.userData?.innerRing) outputSupportRight.userData.innerRing.rotation.x = initialPhaseOutput;

  if (statusBadgeEl) {
    statusBadgeEl.className = 'status-badge';
    if (statusLabelEl) statusLabelEl.textContent = 'READY';
  }
  updateLiveHUDDisplay(0.0, 0.0);
});

// Button: Toggle 3D Component Labels
const btnToggleLabels = document.getElementById('btn-toggle-labels');
const labelToggleText = document.getElementById('label-toggle-text');
let isLabelsVisible = true;
btnToggleLabels?.addEventListener('click', () => {
  isLabelsVisible = !isLabelsVisible;
  if (labelsGroup) {
    labelsGroup.visible = isLabelsVisible;
  }
  btnToggleLabels.classList.toggle('active', isLabelsVisible);
  if (labelToggleText) {
    labelToggleText.textContent = isLabelsVisible ? 'Labels: ON' : 'Labels: OFF';
  }
});

// Button: Reset Camera View
btnCameraReset?.addEventListener('click', () => {
  camera.position.copy(defaultCameraPos);
  controls.target.copy(defaultTargetPos);
  controls.update();
});

/* ==========================================================================
   10. Playable Puzzle System — Hidden-Answers Gearbox Workshop
   ========================================================================== */

/**
 * Predefined transmission levels with ONLY Motor Input RPM and Target Output RPM.
 * Correct gear teeth counts and expected ratios are STRICTLY HIDDEN from the player.
 */
const levelData = [
  { level: 1, title: 'Level 1', inputRPM: 100, targetRPM: 50, requireSeparateGears: true },
  { level: 2, title: 'Level 2', inputRPM: 120, targetRPM: 80, requireSeparateGears: true },
  { level: 3, title: 'Level 3', inputRPM: 150, targetRPM: 225, requireSeparateGears: true },
  { level: 4, title: 'Level 4', inputRPM: 100, targetRPM: 25, requireSeparateGears: true },
  { level: 5, title: 'Level 5', inputRPM: 200, targetRPM: 400, requireSeparateGears: true },
];

/**
 * Requirement 3: Available gear inventory in the mechanic's toolbox:
 * 10, 20, 30, 40, 50 teeth (Module 1.0)
 */
const GEAR_INVENTORY = [10, 20, 30, 40, 50];

// Game State Variables
let currentLevel = 1;
selectedInputTeeth = 20;
selectedOutputTeeth = 30; // Baseline separate physical gears (20 != 30, non-solution for level 1)
let hasCheckedSolution = false;
let lastCalculatedRPM = null;
let isSolutionPass = false;
let requireSeparateGears = true;

const puzzleState = {
  get level() { return currentLevel; },
  set level(val) { loadLevel(val); },
  get inputTeeth() { return selectedInputTeeth; },
  get outputTeeth() { return selectedOutputTeeth; },
  get calculatedRPM() { return lastCalculatedRPM; },
  get isComplete() { return isSolutionPass; },
  get hasChecked() { return hasCheckedSolution; },
  get requireSeparateGears() { return requireSeparateGears; },
  set requireSeparateGears(v) { requireSeparateGears = !!v; updateSelectedGears(); },
  toleranceRPM: 0.5,
  status: 'AWAITING CHECK',
};

/**
 * Updates status badge and text
 */
function setPuzzleStatus(text, type = 'pending') {
  puzzleState.status = text;
  if (puzzleStatusTextEl) puzzleStatusTextEl.textContent = text;
  if (puzzleGameStatusEl) {
    puzzleGameStatusEl.className = `puzzle-status-badge status-${type}`;
  }
  if (verificationStatusPillEl) {
    verificationStatusPillEl.className = `verification-status-pill status-${type}`;
    verificationStatusPillEl.textContent = type.toUpperCase();
  }
  if (puzzleStatusValEl) {
    puzzleStatusValEl.textContent = text;
    if (type === 'complete') puzzleStatusValEl.style.color = '#34d399';
    else if (type === 'try-again') puzzleStatusValEl.style.color = '#f87171';
    else puzzleStatusValEl.style.color = '#cbd5e1';
  }
}

/**
 * Requirement 14: createGearInventory()
 * Builds and initializes interactive gear cards for Input and Output panels
 */
function createGearInventory() {
  const inputContainer = document.getElementById('input-gear-chips');
  const outputContainer = document.getElementById('output-gear-chips');

  const renderCards = (container, slot) => {
    if (!container) return;
    container.innerHTML = '';
    GEAR_INVENTORY.forEach((teeth) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `gear-card gear-chip ${slot}-chip`;
      card.setAttribute('data-slot', slot);
      card.setAttribute('data-teeth', String(teeth));
      card.setAttribute('aria-label', `${slot} gear ${teeth} teeth`);

      card.innerHTML = `
        <span class="card-teeth">${teeth}T</span>
        <span class="card-dia">Ø ${teeth}mm</span>
        <span class="card-status">READY</span>
      `;

      card.addEventListener('click', (e) => {
        e.preventDefault();
        if (slot === 'input') {
          selectInputGear(teeth);
        } else {
          selectOutputGear(teeth);
        }
      });

      container.appendChild(card);
    });
  };

  renderCards(inputContainer, 'input');
  renderCards(outputContainer, 'output');

  // Clear Selection Button
  const btnClear = document.getElementById('btn-clear-selection');
  if (btnClear && !btnClear.dataset.wired) {
    btnClear.dataset.wired = 'true';
    btnClear.addEventListener('click', () => {
      clearSelection();
    });
  }

  updateSelectedGears();
}

/**
 * Requirement 14: selectInputGear(teeth)
 * Selects drive pinion from inventory and enforces separate physical gear rule
 */
function selectInputGear(teeth) {
  const t = parseInt(teeth, 10);
  if (!GEAR_INVENTORY.includes(t)) return false;

  // Requirement 10: Prevent selecting same physical gear for both positions if rule requires separate gears
  if (requireSeparateGears && selectedOutputTeeth === t) {
    console.warn(`[GearFactory3D] Gear ${t}T is already mounted on Output shaft. Unmounting duplicate.`);
    selectedOutputTeeth = null;
  }

  selectedInputTeeth = t;
  state.inputTeeth = t;
  updateSelectedGears();
  return true;
}

/**
 * Requirement 14: selectOutputGear(teeth)
 * Selects driven gear from inventory and enforces separate physical gear rule
 */
function selectOutputGear(teeth) {
  const t = parseInt(teeth, 10);
  if (!GEAR_INVENTORY.includes(t)) return false;

  // Requirement 10: Prevent selecting same physical gear for both positions if rule requires separate gears
  if (requireSeparateGears && selectedInputTeeth === t) {
    console.warn(`[GearFactory3D] Gear ${t}T is already mounted on Input shaft. Unmounting duplicate.`);
    selectedInputTeeth = null;
  }

  selectedOutputTeeth = t;
  state.outputTeeth = t;
  updateSelectedGears();
  return true;
}

/**
 * Backward compatibility alias for selectGear(slot, teeth)
 */
function selectGear(slot, teeth) {
  if (slot === 'input') return selectInputGear(teeth);
  if (slot === 'output') return selectOutputGear(teeth);
  return false;
}

/**
 * Requirement 11 & 14: clearSelection()
 * Unmounts both gears from shafts
 */
function clearSelection() {
  selectedInputTeeth = null;
  selectedOutputTeeth = null;
  updateSelectedGears();
  setPuzzleStatus('SELECT GEARS', 'pending');
}

/**
 * Requirement 14: updateSelectedGears()
 * Synchronizes DOM highlights, in-use statuses, disabled states, verification card,
 * and updates 3D gear models while keeping calculated RPM strictly concealed.
 */
function updateSelectedGears() {
  // Update badges
  if (selectedInputGearDisplayEl) {
    selectedInputGearDisplayEl.textContent = selectedInputTeeth ? `${selectedInputTeeth} T` : 'NONE';
  }
  if (selectedOutputGearDisplayEl) {
    selectedOutputGearDisplayEl.textContent = selectedOutputTeeth ? `${selectedOutputTeeth} T` : 'NONE';
  }

  // Update Input Cards
  document.querySelectorAll('.gear-chip.input-chip').forEach(card => {
    const t = parseInt(card.getAttribute('data-teeth'), 10);
    const statusEl = card.querySelector('.card-status');
    const isSelected = (selectedInputTeeth === t);
    const isInUseElsewhere = requireSeparateGears && (selectedOutputTeeth === t);

    card.classList.toggle('active', isSelected);
    card.classList.toggle('in-use', isInUseElsewhere);
    card.disabled = isInUseElsewhere;

    if (statusEl) {
      if (isSelected) {
        statusEl.textContent = 'MOUNTED';
      } else if (isInUseElsewhere) {
        statusEl.textContent = 'IN USE';
      } else {
        statusEl.textContent = 'READY';
      }
    }
  });

  // Update Output Cards
  document.querySelectorAll('.gear-chip.output-chip').forEach(card => {
    const t = parseInt(card.getAttribute('data-teeth'), 10);
    const statusEl = card.querySelector('.card-status');
    const isSelected = (selectedOutputTeeth === t);
    const isInUseElsewhere = requireSeparateGears && (selectedInputTeeth === t);

    card.classList.toggle('active', isSelected);
    card.classList.toggle('in-use', isInUseElsewhere);
    card.disabled = isInUseElsewhere;

    if (statusEl) {
      if (isSelected) {
        statusEl.textContent = 'MOUNTED';
      } else if (isInUseElsewhere) {
        statusEl.textContent = 'IN USE';
      } else {
        statusEl.textContent = 'READY';
      }
    }
  });

  // Update legacy elements if present
  if (inputTeethField) inputTeethField.value = selectedInputTeeth ? String(selectedInputTeeth) : '';
  if (outputTeethField) outputTeethField.value = selectedOutputTeeth ? String(selectedOutputTeeth) : '';
  if (puzzleInputTeethEl) puzzleInputTeethEl.textContent = selectedInputTeeth ? `${selectedInputTeeth} T` : '---';
  if (puzzleOutputTeethEl) puzzleOutputTeethEl.textContent = selectedOutputTeeth ? `${selectedOutputTeeth} T` : '---';

  // Update physical parameters
  if (selectedInputTeeth && selectedOutputTeeth) {
    state.inputTeeth = selectedInputTeeth;
    state.outputTeeth = selectedOutputTeeth;
    state.gearRatio = selectedOutputTeeth / selectedInputTeeth;
    state.targetOutputRPM = (state.targetInputRPM * selectedInputTeeth) / selectedOutputTeeth;
  }

  // Regenerate 3D gear train dynamically (Requirement 6)
  buildGearTrain();

  // Reset verification state (answers & calculated RPM strictly concealed pre-check!)
  hasCheckedSolution = false;
  lastCalculatedRPM = null;
  isSolutionPass = false;

  updateVerificationUI();

  // Reset banners and lock Next Level
  if (puzzleSuccessBannerEl) puzzleSuccessBannerEl.style.display = 'none';
  if (puzzleFailBannerEl) puzzleFailBannerEl.style.display = 'none';

  if (!selectedInputTeeth || !selectedOutputTeeth) {
    setPuzzleStatus('SELECT GEARS', 'pending');
  } else {
    setPuzzleStatus('AWAITING CHECK', 'pending');
  }

  if (btnNextLevel) btnNextLevel.disabled = true;
}

/**
 * Updates post-check verification card displays
 * Calculated RPM remains masked as '---' before Check Solution is clicked!
 */
function updateVerificationUI() {
  if (resultInputGearEl) {
    resultInputGearEl.textContent = selectedInputTeeth ? `${selectedInputTeeth} T` : 'Unmounted';
  }
  if (resultOutputGearEl) {
    resultOutputGearEl.textContent = selectedOutputTeeth ? `${selectedOutputTeeth} T` : 'Unmounted';
  }

  const level = levelData[currentLevel - 1];
  if (level && puzzleResultTargetRpmEl) {
    puzzleResultTargetRpmEl.textContent = `${level.targetRPM.toFixed(1)} RPM`;
  }

  if (hasCheckedSolution && lastCalculatedRPM !== null) {
    if (puzzleCalculatedOutputRpmEl) {
      puzzleCalculatedOutputRpmEl.textContent = `${lastCalculatedRPM.toFixed(1)} RPM`;
      puzzleCalculatedOutputRpmEl.style.color = isSolutionPass ? '#34d399' : '#f87171';
    }
    if (puzzleCurrentOutputRpmEl) {
      puzzleCurrentOutputRpmEl.textContent = lastCalculatedRPM.toFixed(1);
    }
  } else {
    // Hidden before checking as per Requirements 8 & 9!
    if (puzzleCalculatedOutputRpmEl) {
      puzzleCalculatedOutputRpmEl.textContent = '---';
      puzzleCalculatedOutputRpmEl.style.color = '#ffffff';
    }
    if (puzzleCurrentOutputRpmEl) {
      puzzleCurrentOutputRpmEl.textContent = '---';
    }
  }
}

/**
 * Loads the specified level without revealing the answer.
 */
function loadLevel(levelNumber) {
  const parsed = parseInt(levelNumber, 10);
  if (isNaN(parsed) || parsed < 1 || parsed > levelData.length) {
    console.warn(`[GearFactory3D] Invalid level number: ${levelNumber}`);
    return;
  }

  currentLevel = parsed;
  const level = levelData[currentLevel - 1];
  requireSeparateGears = level.requireSeparateGears !== false;

  // Stop gear rotation during level setup
  setRunningState(false);
  state.currentInputRPM = 0.0;
  state.currentOutputRPM = 0.0;
  state.inputAngle = 0.0;
  state.outputAngle = 0.0;

  // Set motor input RPM
  state.targetInputRPM = level.inputRPM;
  if (inputRpmField) inputRpmField.value = String(level.inputRPM);

  // Set initial separate physical gears that do NOT give away the answer:
  if (level.targetRPM === 80) {
    selectedInputTeeth = 20;
    selectedOutputTeeth = 40;
  } else {
    selectedInputTeeth = 20;
    selectedOutputTeeth = 30;
  }

  state.inputTeeth = selectedInputTeeth;
  state.outputTeeth = selectedOutputTeeth;
  state.gearRatio = selectedOutputTeeth / selectedInputTeeth;
  state.targetOutputRPM = (state.targetInputRPM * selectedInputTeeth) / selectedOutputTeeth;

  // Reset check state: answer is HIDDEN
  hasCheckedSolution = false;
  lastCalculatedRPM = null;
  isSolutionPass = false;

  // Reset gear & shaft rotations
  if (inputGear) inputGear.rotation.x = 0.0;
  if (outputGear) outputGear.rotation.x = initialPhaseOutput;
  if (motorShaft) motorShaft.rotation.x = 0.0;
  if (inputShaft) inputShaft.rotation.x = 0.0;
  if (outputShaft) outputShaft.rotation.x = initialPhaseOutput;
  if (inputSupportLeft?.userData?.innerRing) inputSupportLeft.userData.innerRing.rotation.x = 0.0;
  if (inputSupportRight?.userData?.innerRing) inputSupportRight.userData.innerRing.rotation.x = 0.0;
  if (outputSupportLeft?.userData?.innerRing) outputSupportLeft.userData.innerRing.rotation.x = initialPhaseOutput;
  if (outputSupportRight?.userData?.innerRing) outputSupportRight.userData.innerRing.rotation.x = initialPhaseOutput;

  if (statusBadgeEl) {
    statusBadgeEl.className = 'status-badge';
    if (statusLabelEl) statusLabelEl.textContent = 'READY';
  }
  updateLiveHUDDisplay(0.0, 0.0);

  // Update UI indicators
  const indicatorText = `Level ${currentLevel} of ${levelData.length}`;
  if (puzzleLevelIndicatorEl) puzzleLevelIndicatorEl.textContent = indicatorText;
  if (puzzleLevelPillEl) puzzleLevelPillEl.textContent = indicatorText;
  if (puzzleLevelTitleEl) puzzleLevelTitleEl.textContent = level.title;
  if (puzzleLevelNumberEl) puzzleLevelNumberEl.textContent = `${currentLevel} / ${levelData.length}`;
  if (puzzleInputRpmEl) puzzleInputRpmEl.textContent = level.inputRPM.toFixed(1);
  if (puzzleTargetOutputRpmEl) puzzleTargetOutputRpmEl.textContent = level.targetRPM.toFixed(1);

  // Reset banners and status
  if (puzzleSuccessBannerEl) puzzleSuccessBannerEl.style.display = 'none';
  if (puzzleFailBannerEl) puzzleFailBannerEl.style.display = 'none';
  setPuzzleStatus('AWAITING CHECK', 'pending');

  // Update inventory cards and results
  updateSelectedGears();

  // Navigation button states
  if (btnPrevLevel) btnPrevLevel.disabled = (currentLevel <= 1);
  if (btnNextLevel) btnNextLevel.disabled = true; // Disabled until solved!
}

/**
 * Requirement 5: When the player presses Check Solution:
 * - Calculate: outputRPM = inputRPM * inputTeeth / outputTeeth
 * - Compare with target RPM using tolerance ±0.5 RPM
 * - If correct, show LEVEL COMPLETE
 * - If incorrect, show TRY AGAIN
 */
function checkPuzzleSolution(isUserClick = true) {
  const level = levelData[currentLevel - 1];
  if (!level) return false;

  if (!selectedInputTeeth || !selectedOutputTeeth) {
    setPuzzleStatus('SELECT GEARS', 'pending');
    if (puzzleFailBannerEl) {
      const desc = puzzleFailBannerEl.querySelector('#fail-banner-desc') || puzzleFailBannerEl.querySelector('.banner-desc');
      if (desc) {
        desc.textContent = 'Please mount both an Input gear and an Output gear before checking.';
      }
      puzzleFailBannerEl.style.display = 'flex';
    }
    if (puzzleSuccessBannerEl) puzzleSuccessBannerEl.style.display = 'none';
    return false;
  }

  // Calculate output RPM:
  const outputRPM = (state.targetInputRPM * selectedInputTeeth) / selectedOutputTeeth;
  lastCalculatedRPM = outputRPM;
  hasCheckedSolution = true;

  // Compare with target RPM within ±0.5 RPM
  const diff = Math.abs(outputRPM - level.targetRPM);
  isSolutionPass = diff <= 0.5;

  // Update results displays
  updateVerificationUI();

  if (isSolutionPass) {
    setPuzzleStatus('LEVEL COMPLETE', 'complete');
    if (btnNextLevel) btnNextLevel.disabled = false;

    if (puzzleSuccessBannerEl) {
      const desc = puzzleSuccessBannerEl.querySelector('#success-banner-desc') || puzzleSuccessBannerEl.querySelector('.banner-desc');
      if (desc) {
        desc.textContent = `Calculated ${outputRPM.toFixed(1)} RPM matches target ${level.targetRPM.toFixed(1)} RPM (diff: ${diff.toFixed(2)} RPM).`;
      }
      puzzleSuccessBannerEl.style.display = 'flex';
    }
    if (puzzleFailBannerEl) puzzleFailBannerEl.style.display = 'none';
  } else {
    setPuzzleStatus('TRY AGAIN', 'try-again');
    if (btnNextLevel) btnNextLevel.disabled = true;

    if (puzzleFailBannerEl) {
      const desc = puzzleFailBannerEl.querySelector('#fail-banner-desc') || puzzleFailBannerEl.querySelector('.banner-desc');
      if (desc) {
        desc.textContent = `Calculated ${outputRPM.toFixed(1)} RPM does not match target ${level.targetRPM.toFixed(1)} RPM. Adjust your gears!`;
      }
      puzzleFailBannerEl.style.display = 'flex';
    }
    if (puzzleSuccessBannerEl) puzzleSuccessBannerEl.style.display = 'none';
  }

  return isSolutionPass;
}

/**
 * Reset Level button
 * Restores baseline gears and hides calculated results
 */
function resetLevel() {
  loadLevel(currentLevel);
}

// Action buttons
btnCheckSolution?.addEventListener('click', () => {
  checkPuzzleSolution(true);
});

btnResetLevel?.addEventListener('click', () => {
  resetLevel();
});

btnNextLevel?.addEventListener('click', () => {
  if (!isSolutionPass) return;
  if (currentLevel < levelData.length) {
    loadLevel(currentLevel + 1);
  } else {
    alert('Congratulations! You have completed all 5 levels of Gear Factory 3D!');
  }
});

btnPrevLevel?.addEventListener('click', () => {
  if (currentLevel > 1) {
    loadLevel(currentLevel - 1);
  }
});

// Initialize Inventory and Level 1
createGearInventory();
loadLevel(1);


/**
 * Updates live RPM numbers and progress bar meters in real time
 */
function updateLiveHUDDisplay(inRPM, outRPM) {
  const absIn = Math.abs(inRPM);
  const absOut = Math.abs(outRPM);

  if (inputRpmValEl) inputRpmValEl.textContent = absIn.toFixed(1);
  if (outputRpmValEl) outputRpmValEl.textContent = absOut.toFixed(1);

  if (inputMeterFillEl) {
    const maxVal = Math.max(state.targetInputRPM, 100);
    const pctIn = Math.min(100, (absIn / maxVal) * 100);
    inputMeterFillEl.style.width = `${pctIn}%`;
  }
  if (outputMeterFillEl) {
    const maxVal = Math.max(state.targetOutputRPM, 50);
    const pctOut = Math.min(100, (absOut / maxVal) * 100);
    outputMeterFillEl.style.width = `${pctOut}%`;
  }

  // Legacy fallback element
  if (legacyRpmValueEl) {
    legacyRpmValueEl.textContent = absIn.toFixed(1);
  }
}

/* ==========================================================================
   10. Kinematics & Animation Loop
   ========================================================================== */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.1);

  // Determine target input velocity
  const desiredInputRPM = state.isRunning ? state.targetInputRPM : 0.0;

  // Smooth acceleration / deceleration towards desired Input RPM
  if (state.currentInputRPM !== desiredInputRPM) {
    const step = state.accelerationRate * delta;
    if (Math.abs(desiredInputRPM - state.currentInputRPM) <= step) {
      state.currentInputRPM = desiredInputRPM;
    } else if (state.currentInputRPM < desiredInputRPM) {
      state.currentInputRPM += step;
    } else {
      state.currentInputRPM -= step;
    }
  }

  // Exact Gearbox Kinematics:
  // outputRPM = inputRPM * inputTeeth / outputTeeth
  state.currentOutputRPM = (state.currentInputRPM * state.inputTeeth) / state.outputTeeth;

  // Convert RPM to radians per second
  const inputRadPerSec = (state.currentInputRPM * Math.PI * 2) / 60;
  const outputRadPerSec = (state.currentOutputRPM * Math.PI * 2) / 60;

  // Accumulate rotation angles
  state.inputAngle += inputRadPerSec * delta;
  state.outputAngle += outputRadPerSec * delta;

  // Group 1 (Input Drive): Input Gear, Motor Shaft, Input Shaft & Bearing Inner Rings rotate CLOCKWISE around X-axis
  if (inputGear) {
    inputGear.rotation.x = -state.inputAngle;
  }
  if (motorShaft) {
    motorShaft.rotation.x = -state.inputAngle;
  }
  if (inputShaft) {
    inputShaft.rotation.x = -state.inputAngle;
  }
  if (inputSupportLeft?.userData?.innerRing) {
    inputSupportLeft.userData.innerRing.rotation.x = -state.inputAngle;
  }
  if (inputSupportRight?.userData?.innerRing) {
    inputSupportRight.userData.innerRing.rotation.x = -state.inputAngle;
  }

  // Group 2 (Output Drive): Output Gear, Extended Output Shaft & Bearing Inner Rings rotate COUNTER-CLOCKWISE around X-axis
  const outPhaseRot = initialPhaseOutput + state.outputAngle;
  if (outputGear) {
    outputGear.rotation.x = outPhaseRot;
  }
  if (outputShaft) {
    outputShaft.rotation.x = outPhaseRot;
  }
  if (outputSupportLeft?.userData?.innerRing) {
    outputSupportLeft.userData.innerRing.rotation.x = outPhaseRot;
  }
  if (outputSupportRight?.userData?.innerRing) {
    outputSupportRight.userData.innerRing.rotation.x = outPhaseRot;
  }

  // Update OrbitControls with smooth damping
  controls.update();

  // Update live HUD telemetry
  updateLiveHUDDisplay(state.currentInputRPM, state.currentOutputRPM);

  // Render 3D scene
  renderer.render(scene, camera);
}

// Start animation loop
animate();

/* ==========================================================================
   11. Responsive Window Resize Handler (Desktop & Mobile)
   ========================================================================== */
function handleResize() {
  const container = document.getElementById("three-container");
  if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) return;

  renderer.setSize(
    container.clientWidth,
    container.clientHeight
  );

  camera.aspect =
    container.clientWidth / container.clientHeight;

  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

window.addEventListener('resize', handleResize);

if (typeof ResizeObserver !== 'undefined' && container) {
  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);
}

/* Expose simulation state for testing & external inspection */
window.gearFactory = {
  state,
  scene,
  camera,
  controls,
  renderer,
  get inputGear() { return inputGear; },
  get outputGear() { return outputGear; },
  get gear() { return inputGear; },
  get motor() { return motor; },
  get motorShaft() { return motorShaft; },
  get inputShaft() { return inputShaft; },
  get outputShaft() { return outputShaft; },
  get gearboxCasing() { return gearboxCasing; },
  get labelsGroup() { return labelsGroup; },
  get bearingSupports() { return bearingSupports; },
  get inputSupportLeft() { return inputSupportLeft; },
  get inputSupportRight() { return inputSupportRight; },
  get outputSupportLeft() { return outputSupportLeft; },
  get outputSupportRight() { return outputSupportRight; },
  createMotor,
  createShaft,
  createBallBearing,
  createBearing,
  createBearingHousing,
  createShaftSupport,
  createMountingFeet,
  createGearboxCasing,
  createLabel,
  createSpurGear,
  createGear,
  calculateGearOuterRadius,
  get debug() { return window.gearFactoryDebug; },
  levelData,
  GEAR_INVENTORY,
  get currentLevel() { return currentLevel; },
  set currentLevel(v) { loadLevel(v); },
  get selectedInputTeeth() { return selectedInputTeeth; },
  set selectedInputTeeth(v) { if (v === null) { selectedInputTeeth = null; updateSelectedGears(); } else selectInputGear(v); },
  get selectedOutputTeeth() { return selectedOutputTeeth; },
  set selectedOutputTeeth(v) { if (v === null) { selectedOutputTeeth = null; updateSelectedGears(); } else selectOutputGear(v); },
  get requireSeparateGears() { return requireSeparateGears; },
  set requireSeparateGears(v) { requireSeparateGears = !!v; updateSelectedGears(); },
  createGearInventory,
  selectInputGear,
  selectOutputGear,
  updateSelectedGears,
  clearSelection,
  selectGear,
  loadLevel,
  resetLevel,
  checkPuzzleSolution,
  puzzle: puzzleState,
  updateGearboxParameters,
  validateInputs,
  setRunningState,
};
