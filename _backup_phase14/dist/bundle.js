/**
 * Gear Factory 3D â€” Standalone Unified Production Bundle
 * Built for universal compatibility: works via http:// and local file:/// protocol.
 */
(function() {
  'use strict';

  const THREE = window.THREE;
  if (!THREE) {
    console.error('Three.js must be loaded before gear-factory bundle.');
    return;
  }
  const OrbitControls = THREE.OrbitControls;

// --- Begin: src/game-state.js ---
/**
 * Gear Factory 3D — Simulation State & Mechanical Calculations
 *
 * Requirements & Features:
 * - Reactive simulation state management
 * - Pure mechanical calculation functions with engineering formulas
 * - Constant gear module for standardized tooth meshing
 */

// Common Gear Module (Standard metric module m = 0.16 Three.js units)
// In spur gear design, identical module ensures identical circular tooth pitch: p = pi * m
const GEAR_MODULE = 0.16;

// Available physical gear inventory (teeth count)
const GEAR_INVENTORY = [10, 20, 30, 40, 50, 60];

// Main gearbox simulation operational state
const state = {
  isRunning: false,
  inputTeeth: 20,
  outputTeeth: 40,
  targetInputRPM: 990.0,
  targetOutputRPM: 495.0, // outputRPM = inputRPM * inputTeeth / outputTeeth
  currentInputRPM: 0.0,
  currentOutputRPM: 0.0,
  gearRatio: 40 / 20, // gearRatio = outputTeeth / inputTeeth = 2.00
  inputAngle: 0.0,
  outputAngle: 0.0,
  maxMeterRPM: 2500.0,
  accelerationRate: 1200.0, // RPM change per second
  isPaused: false,
  levelInProgress: false,
  levelTimeSeconds: 0.0,
  get currentRPM() { return this.currentInputRPM; },
  set currentRPM(v) { this.currentInputRPM = v; },
  get teethCount() { return this.inputTeeth; },
  set teethCount(v) { this.inputTeeth = v; },
};

// Puzzle progression and player selection state
const puzzleState = {
  currentLevel: 1,
  selectedInventoryGear: null,
  selectedInputTeeth: null,
  selectedOutputTeeth: null,
  requireSeparateGears: true,
  isSolutionPass: false,
  hasCheckedSolution: false,
  lastCalculatedRPM: null,
};

// Telemetry registry for inspection and debugging
const debugTelemetry = {
  casingInternalDimensions: null,
  gearOuterRadii: null,
  clearanceChecks: null,
  bearingSupports: null,
};

/**
 * Calculates theoretical gear ratio between output gear and input pinion.
 * Formula:
 *   i = z_output / z_input
 *
 * @param {number} outputTeeth - Number of teeth on driven gear (z_out)
 * @param {number} inputTeeth - Number of teeth on drive pinion (z_in)
 * @returns {number} Gear reduction/step-up ratio
 */
function calculateGearRatio(outputTeeth, inputTeeth) {
  if (!inputTeeth || inputTeeth <= 0) return 1.0;
  return outputTeeth / inputTeeth;
}

/**
 * Calculates output rotational velocity based on conservation of angular velocity at pitch line.
 * Formula:
 *   n_out = n_in * (z_in / z_out)
 *
 * @param {number} inputRPM - Rotational speed of input motor shaft in RPM (n_in)
 * @param {number} inputTeeth - Number of teeth on input pinion (z_in)
 * @param {number} outputTeeth - Number of teeth on output gear (z_out)
 * @returns {number} Rotational speed of output shaft in RPM
 */
function calculateOutputRPM(inputRPM, inputTeeth, outputTeeth) {
  if (!outputTeeth || outputTeeth <= 0) return 0.0;
  return (inputRPM * inputTeeth) / outputTeeth;
}

/**
 * Calculates complete gear geometry and outer radius based on AGMA/ISO standard spur gear formulas.
 *
 * Fundamental Mechanical Calculations:
 * 1. Pitch Diameter:     d = m * z
 * 2. Pitch Radius:       r_pitch = d / 2 = (m * z) / 2
 * 3. Addendum (tip):     h_a = 1.0 * m
 * 4. Dedendum (root):    h_d = 1.25 * m
 * 5. Tooth Whole Depth:  h = h_a + h_d = 2.25 * m
 * 6. Outer (Tip) Radius: r_outer = r_pitch + h_a = (m * z) / 2 + m
 * 7. Root (Base) Radius: r_root = r_pitch - h_d = (m * z) / 2 - 1.25 * m
 *
 * @param {number} teeth - Number of teeth (z)
 * @param {number} module - Standard metric module in Three.js units (m)
 * @returns {Object} Complete gear dimensional specifications
 */
function calculateGearOuterRadius(teeth, module = GEAR_MODULE) {
  const pitchRadius = (module * teeth) / 2.0;
  const toothDepth = 2.25 * module;
  const addendum = 1.0 * module;
  const dedendum = 1.25 * module;
  const gearBodyRadius = pitchRadius - dedendum;
  const gearOuterRadius = pitchRadius + addendum; // r_pitch + h_a = r_outer
  const gearDiameter = gearOuterRadius * 2.0;
  const gearThickness = 0.65;
  const hubThickness = 0.79;

  return {
    teeth,
    module,
    pitchRadius: Number(pitchRadius.toFixed(4)),
    gearBodyRadius: Number(gearBodyRadius.toFixed(4)),
    toothDepth: Number(toothDepth.toFixed(4)),
    addendum: Number(addendum.toFixed(4)),
    dedendum: Number(dedendum.toFixed(4)),
    gearOuterRadius: Number(gearOuterRadius.toFixed(4)),
    gearDiameter: Number(gearDiameter.toFixed(4)),
    diameter: Number(gearDiameter.toFixed(4)),
    gearThickness,
    hubThickness,
  };
}

/**
 * Generates friendly, non-spoiling contextual mechanical hints based on current state.
 * Helps players understand gear size and speed relationships without revealing exact answers.
 *
 * @param {Object} params
 * @param {number} [params.level]
 * @param {number|null} [params.inputTeeth]
 * @param {number|null} [params.outputTeeth]
 * @param {number} [params.targetRPM]
 * @param {number|null} [params.calculatedRPM]
 * @param {boolean} [params.hasChecked]
 * @returns {string} Contextual hint text
 */
function getContextualHint({ level = 1, inputTeeth = null, outputTeeth = null, targetRPM = 0, calculatedRPM = null, hasChecked = false } = {}) {
  if (!inputTeeth && !outputTeeth) {
    if (level === 1) {
      return "Select a gear from the inventory below, then place it onto the motor shaft.";
    }
    return "Select an available gear from your inventory and place it onto a shaft.";
  }

  if (!inputTeeth && outputTeeth) {
    return "Place a gear onto the motor shaft to connect with the machine gear.";
  }

  if (inputTeeth && !outputTeeth) {
    return "Now place a second gear onto the machine shaft to complete the drive.";
  }

  // Both gears placed
  if (!hasChecked) {
    if (inputTeeth === outputTeeth) {
      return "These gears are the same size. Press Check Solution or try different sizes to change speed.";
    }
    return "Both gears are meshed! Press Check Solution to test the machine speed.";
  }

  // After checking solution
  const diff = calculatedRPM !== null ? Math.abs(calculatedRPM - targetRPM) : 999;
  if (diff <= 1.0) {
    return "Gears connected! The machine is running at the target speed.";
  }

  if (calculatedRPM !== null && calculatedRPM > targetRPM) {
    return "The machine is turning too fast. Try a larger machine gear or a smaller motor gear.";
  } else {
    return "The machine is turning too slow. Try a smaller machine gear or a larger motor gear.";
  }
}
// --- End: src/game-state.js ---

// --- Begin: src/levels.js ---
/**
 * Gear Factory 3D — Level Definitions & Progression System (Levels 1–50)
 *
 * Requirements & Features:
 * - 50 progressive mechanical gear puzzles across 7 difficulty tiers
 * - Programmatic validation ensuring every level has at least one valid solution
 * - Browser localStorage persistence (highestUnlockedLevel, completedLevels)
 * - Strict solution concealment from player-facing UI
 */


const STORAGE_KEYS = {
  HIGHEST_UNLOCKED: 'gearfactory_highest_unlocked',
  COMPLETED_LEVELS: 'gearfactory_completed_levels',
  TUTORIAL_COMPLETED: 'tutorialCompleted',
};

const levelData = [
  // ==========================================
  // TIER 1: LEVELS 1–5 — BEGINNER (VISUAL LEARNING)
  // Focus: visual concepts, intuitive mechanical relationships, no jargon
  // ==========================================
  {
    level: 1,
    difficulty: 'BEGINNER',
    title: 'Level 1 — Starting the Machine',
    motorRPM: 1000,
    inputRPM: 1000,
    targetRPM: 500,
    availableGears: [10, 20, 30, 40],
    visualHint: 'MOTOR ↓ ⚙️',
    teachMessage: "Let's start the machine.",
    objective: 'Place a gear on the motor shaft, then connect a machine gear to start the machine (Target: 500 RPM).',
    requireSeparateGears: true,
  },
  {
    level: 2,
    difficulty: 'BEGINNER',
    title: 'Level 2 — Gear Size & Speed',
    motorRPM: 600,
    inputRPM: 600,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40],
    visualHint: 'SMALL GEAR → BIG GEAR',
    teachMessage: 'Big gears turn slower.',
    objective: 'Big gears turn slower. Connect gears to double the machine speed to 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 3,
    difficulty: 'BEGINNER',
    title: 'Level 3 — Speed Transfer',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 900,
    availableGears: [10, 20, 30, 40],
    visualHint: 'BIG GEAR → SMALL GEAR',
    teachMessage: 'Small gears turn faster.',
    objective: 'Small gears turn faster. Matching equal gears transfer speed 1:1 at 900 RPM.',
    requireSeparateGears: false,
  },
  {
    level: 4,
    difficulty: 'BEGINNER',
    title: 'Level 4 — Turning Direction',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 400,
    availableGears: [10, 20, 30, 40],
    visualHint: '↻ OPPOSITE ROTATION ↺',
    teachMessage: 'Meshed gears turn in opposite directions.',
    showDirectionArrows: true,
    objective: 'Meshed gears turn in opposite directions. Reduce the speed to 400 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 5,
    difficulty: 'BEGINNER',
    title: 'Level 5 — Matching the Target',
    motorRPM: 1600,
    inputRPM: 1600,
    targetRPM: 400,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'MOTOR SPEED ➔ TARGET SPEED',
    teachMessage: 'Make the output move at the target speed.',
    rpmExplanation: 'RPM means how many times the gear turns in one minute.',
    objective: 'Make the output machine gear move at the target speed: 400 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 2: LEVELS 6–10 — INTERMEDIATE (DIFFICULTY PROGRESSION)
  // Focus: discovering ratios, plausible distractors, fine tuning
  // ==========================================
  {
    level: 6,
    difficulty: 'INTERMEDIATE',
    title: 'Level 6 — Increasing Speed',
    motorRPM: 800,
    inputRPM: 800,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'MORE GEAR CHOICES',
    teachMessage: 'Choose the right pair from more options.',
    objective: 'More gear choices available. Find the pair that boosts 800 RPM up to 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 7,
    difficulty: 'INTERMEDIATE',
    title: 'Level 7 — Slower Drive',
    motorRPM: 990,
    inputRPM: 990,
    targetRPM: 660,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'FIND THE PAIR',
    teachMessage: 'Carefully compare the gear sizes.',
    objective: 'Filter through distractors to reduce 990 RPM down to 660 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 8,
    difficulty: 'INTERMEDIATE',
    title: 'Level 8 — Speed Stepping',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'SPEED STEPPING',
    teachMessage: 'Test gear combinations to find the step-up.',
    objective: 'Carefully test gear sizes to increase speed from 900 RPM to 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 9,
    difficulty: 'INTERMEDIATE',
    title: 'Level 9 — High Speed Drive',
    motorRPM: 600,
    inputRPM: 600,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'HIGH SPEED DRIVE',
    teachMessage: 'A large motor gear driving a small gear gives high speed.',
    objective: 'Use a small machine gear to multiply speed from 600 RPM to 1500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 10,
    difficulty: 'INTERMEDIATE',
    title: 'Level 10 — Precision Gearing',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'PRECISION GEARING',
    teachMessage: 'Your first real workshop puzzle.',
    objective: 'Your first real workshop challenge: fine-tune the machine from 1200 RPM to 1500 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 3: LEVELS 11–15 — HARD
  // Focus: plausible distractors, higher RPM values, calculating exact speeds
  // ==========================================
  {
    level: 11,
    difficulty: 'HARD',
    title: 'Level 11',
    motorRPM: 1500,
    inputRPM: 1500,
    targetRPM: 300,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Deep reduction from 1500 RPM to 300 RPM (5:1 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 12,
    difficulty: 'HARD',
    title: 'Level 12',
    motorRPM: 1750,
    inputRPM: 1750,
    targetRPM: 1050,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Calculate 3:5 reduction from 1750 RPM to 1050 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 13,
    difficulty: 'HARD',
    title: 'Level 13',
    motorRPM: 1350,
    inputRPM: 1350,
    targetRPM: 2250,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Elevate 1350 RPM to 2250 RPM using expanded inventory.',
    requireSeparateGears: true,
  },
  {
    level: 14,
    difficulty: 'HARD',
    title: 'Level 14',
    motorRPM: 2200,
    inputRPM: 2200,
    targetRPM: 1760,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-speed motor reduction from 2200 RPM to 1760 RPM (4:5 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 15,
    difficulty: 'HARD',
    title: 'Level 15',
    motorRPM: 400,
    inputRPM: 400,
    targetRPM: 2400,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Extreme single-stage multiplication (6:1 ratio = 6.0x).',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 4: LEVELS 16–20 — EXPERT
  // Focus: 5+ available gears, larger RPM gaps, precision engineering calculations
  // ==========================================
  {
    level: 16,
    difficulty: 'EXPERT',
    title: 'Level 16',
    motorRPM: 1750,
    inputRPM: 1750,
    targetRPM: 2100,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Match 2100 RPM from a 1750 RPM motor (6:5 step-up).',
    requireSeparateGears: true,
  },
  {
    level: 17,
    difficulty: 'EXPERT',
    title: 'Level 17',
    motorRPM: 1980,
    inputRPM: 1980,
    targetRPM: 1650,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Subtle reduction from 1980 RPM to 1650 RPM (5:6 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 18,
    difficulty: 'EXPERT',
    title: 'Level 18',
    motorRPM: 2100,
    inputRPM: 2100,
    targetRPM: 1400,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Heavy industrial transmission from 2100 RPM to 1400 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 19,
    difficulty: 'EXPERT',
    title: 'Level 19',
    motorRPM: 850,
    inputRPM: 850,
    targetRPM: 2550,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Triple the shaft speed to 2550 RPM (3:1 overdrive).',
    requireSeparateGears: true,
  },
  {
    level: 20,
    difficulty: 'EXPERT',
    title: 'Level 20',
    motorRPM: 1860,
    inputRPM: 1860,
    targetRPM: 2790,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Master Gearbox Challenge: Reach maximum output of 2790 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 5: LEVELS 21–30 — HARD
  // Focus: More gear choices, less obvious ratios, fractional gearing
  // ==========================================
  {
    level: 21,
    difficulty: 'HARD',
    title: 'Level 21',
    motorRPM: 1600,
    inputRPM: 1600,
    targetRPM: 1200,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Reduce 1600 RPM to 1200 RPM (3:4 reduction = 0.75x).',
    requireSeparateGears: true,
  },
  {
    level: 22,
    difficulty: 'HARD',
    title: 'Level 22',
    motorRPM: 750,
    inputRPM: 750,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Double drive velocity to 1500 RPM (2:1 step-up).',
    requireSeparateGears: true,
  },
  {
    level: 23,
    difficulty: 'HARD',
    title: 'Level 23',
    motorRPM: 2400,
    inputRPM: 2400,
    targetRPM: 1600,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Calibrate high-speed spindle to 1600 RPM (2:3 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 24,
    difficulty: 'HARD',
    title: 'Level 24',
    motorRPM: 1050,
    inputRPM: 1050,
    targetRPM: 1400,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Moderate step-up to 1400 RPM (4:3 overdrive).',
    requireSeparateGears: true,
  },
  {
    level: 25,
    difficulty: 'HARD',
    title: 'Level 25',
    motorRPM: 1800,
    inputRPM: 1800,
    targetRPM: 720,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Heavy torque transmission to 720 RPM (2:5 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 26,
    difficulty: 'HARD',
    title: 'Level 26',
    motorRPM: 1250,
    inputRPM: 1250,
    targetRPM: 1500,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Fine step-up adjustment to 1500 RPM (6:5 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 27,
    difficulty: 'HARD',
    title: 'Level 27',
    motorRPM: 2100,
    inputRPM: 2100,
    targetRPM: 700,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Divide line shaft speed by 3 to 700 RPM (3:1 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 28,
    difficulty: 'HARD',
    title: 'Level 28',
    motorRPM: 1400,
    inputRPM: 1400,
    targetRPM: 1750,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Precision overdrive to 1750 RPM (5:4 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 29,
    difficulty: 'HARD',
    title: 'Level 29',
    motorRPM: 1950,
    inputRPM: 1950,
    targetRPM: 1300,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Industrial reduction stage to 1300 RPM (2:3 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 30,
    difficulty: 'HARD',
    title: 'Level 30',
    motorRPM: 680,
    inputRPM: 680,
    targetRPM: 2040,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-ratio overdrive stage to 2040 RPM (3:1 ratio).',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 6: LEVELS 31–40 — ADVANCED
  // Focus: Higher and lower RPMs, larger/smaller combinations, distractor gears
  // ==========================================
  {
    level: 31,
    difficulty: 'ADVANCED',
    title: 'Level 31',
    motorRPM: 2500,
    inputRPM: 2500,
    targetRPM: 500,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Deep primary reduction from 2500 RPM to 500 RPM (1:5 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 32,
    difficulty: 'ADVANCED',
    title: 'Level 32',
    motorRPM: 520,
    inputRPM: 520,
    targetRPM: 2600,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-speed turbine excitation to 2600 RPM (5:1 step-up).',
    requireSeparateGears: true,
  },
  {
    level: 33,
    difficulty: 'ADVANCED',
    title: 'Level 33',
    motorRPM: 1680,
    inputRPM: 1680,
    targetRPM: 1400,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Precision close-ratio reduction to 1400 RPM (5:6 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 34,
    difficulty: 'ADVANCED',
    title: 'Level 34',
    motorRPM: 920,
    inputRPM: 920,
    targetRPM: 2300,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Rapid acceleration drive to 2300 RPM (5:2 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 35,
    difficulty: 'ADVANCED',
    title: 'Level 35',
    motorRPM: 2280,
    inputRPM: 2280,
    targetRPM: 1900,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Turbomachine regulation from 2280 RPM to 1900 RPM (5:6 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 36,
    difficulty: 'ADVANCED',
    title: 'Level 36',
    motorRPM: 840,
    inputRPM: 840,
    targetRPM: 2520,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Multi-pinion overdrive drive to 2520 RPM (3:1 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 37,
    difficulty: 'ADVANCED',
    title: 'Level 37',
    motorRPM: 2700,
    inputRPM: 2700,
    targetRPM: 1080,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Heavy hydraulic pump drive to 1080 RPM (2:5 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 38,
    difficulty: 'ADVANCED',
    title: 'Level 38',
    motorRPM: 1120,
    inputRPM: 1120,
    targetRPM: 1400,
    availableGears: [20, 30, 40, 50, 60],
    objective: 'Compressor shaft speed-up to 1400 RPM (5:4 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 39,
    difficulty: 'ADVANCED',
    title: 'Level 39',
    motorRPM: 2880,
    inputRPM: 2880,
    targetRPM: 480,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Maximum single-stage deceleration to 480 RPM (1:6 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 40,
    difficulty: 'ADVANCED',
    title: 'Level 40',
    motorRPM: 1350,
    inputRPM: 1350,
    targetRPM: 1800,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-torque mill transmission to 1800 RPM (4:3 ratio).',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 7: LEVELS 41–50 — EXPERT
  // Focus: Wide RPM ranges, subtle tooth differences, apex precision engineering
  // ==========================================
  {
    level: 41,
    difficulty: 'EXPERT',
    title: 'Level 41',
    motorRPM: 3150,
    inputRPM: 3150,
    targetRPM: 2100,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-RPM aerospace turbine down-gearing to 2100 RPM (2:3 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 42,
    difficulty: 'EXPERT',
    title: 'Level 42',
    motorRPM: 450,
    inputRPM: 450,
    targetRPM: 2700,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Extreme ratio multiplier to 2700 RPM (6:1 overdrive).',
    requireSeparateGears: true,
  },
  {
    level: 43,
    difficulty: 'EXPERT',
    title: 'Level 43',
    motorRPM: 2450,
    inputRPM: 2450,
    targetRPM: 1960,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Precision 4:5 reduction stage to 1960 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 44,
    difficulty: 'EXPERT',
    title: 'Level 44',
    motorRPM: 1650,
    inputRPM: 1650,
    targetRPM: 2750,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-speed centrifugal blower drive to 2750 RPM (5:3 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 45,
    difficulty: 'EXPERT',
    title: 'Level 45',
    motorRPM: 2800,
    inputRPM: 2800,
    targetRPM: 2100,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Heavy-duty maritime transmission to 2100 RPM (3:4 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 46,
    difficulty: 'EXPERT',
    title: 'Level 46',
    motorRPM: 1850,
    inputRPM: 1850,
    targetRPM: 2220,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Close-ratio speed step-up to 2220 RPM (6:5 overdrive).',
    requireSeparateGears: true,
  },
  {
    level: 47,
    difficulty: 'EXPERT',
    title: 'Level 47',
    motorRPM: 3300,
    inputRPM: 3300,
    targetRPM: 550,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Super-high reduction gearbox to 550 RPM (1:6 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 48,
    difficulty: 'EXPERT',
    title: 'Level 48',
    motorRPM: 2250,
    inputRPM: 2250,
    targetRPM: 3000,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'High-speed dyno spindle calibration to 3000 RPM (4:3 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 49,
    difficulty: 'EXPERT',
    title: 'Level 49',
    motorRPM: 3600,
    inputRPM: 3600,
    targetRPM: 1440,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Ultra-speed generator power conversion to 1440 RPM (2:5 ratio).',
    requireSeparateGears: true,
  },
  {
    level: 50,
    difficulty: 'EXPERT',
    title: 'Level 50',
    motorRPM: 2520,
    inputRPM: 2520,
    targetRPM: 3150,
    availableGears: [10, 20, 30, 40, 50, 60],
    objective: 'Apex Grandmaster Gearbox: Master 3150 RPM final drive (5:4 overdrive).',
    requireSeparateGears: true,
  },
];

/**
 * Retrieves level specifications for given level number.
 * @param {number} levelNumber - 1-indexed level number
 * @returns {Object|null} Level data object
 */
function getLevel(levelNumber) {
  if (levelNumber < 1 || levelNumber > levelData.length) return null;
  return levelData[levelNumber - 1];
}

/**
 * Returns total number of available levels.
 * @returns {number}
 */
function getTotalLevels() {
  return levelData.length;
}

/**
 * Verifies solution for a level given selected gear teeth.
 *
 * Mechanical formula:
 *   calculatedOutputRPM = motorRPM * (selectedInputTeeth / selectedOutputTeeth)
 *   tolerance = ±0.5 RPM
 *
 * @param {number} levelNumber - 1-indexed level number
 * @param {number} inputTeeth - Teeth count on drive pinion
 * @param {number} outputTeeth - Teeth count on driven gear
 * @param {number} tolerance - Allowable RPM deviation (default 0.5 RPM)
 * @returns {Object} Solution evaluation result
 */
function checkLevelSolution(levelNumber, inputTeeth, outputTeeth, tolerance = 0.5) {
  const level = getLevel(levelNumber);
  if (!level) {
    return { isCorrect: false, error: 'Invalid level number', calculatedRPM: 0, diff: Infinity };
  }

  if (!inputTeeth || !outputTeeth || inputTeeth <= 0 || outputTeeth <= 0) {
    return { isCorrect: false, error: 'Incomplete gear selection', calculatedRPM: 0, diff: Infinity };
  }

  const requireSeparate = level.requireSeparateGears !== false;
  if (requireSeparate && inputTeeth === outputTeeth) {
    return {
      isCorrect: false,
      error: 'Separate physical gears required',
      calculatedRPM: level.motorRPM,
      diff: Math.abs(level.motorRPM - level.targetRPM),
    };
  }

  const calculatedRPM = calculateOutputRPM(level.motorRPM, inputTeeth, outputTeeth);
  const diff = Math.abs(calculatedRPM - level.targetRPM);
  const isCorrect = diff <= tolerance;

  return {
    isCorrect,
    levelNumber,
    motorRPM: level.motorRPM,
    inputRPM: level.motorRPM,
    targetRPM: level.targetRPM,
    calculatedRPM: Number(calculatedRPM.toFixed(2)),
    diff: Number(diff.toFixed(4)),
    tolerance,
  };
}

/**
 * Requirement 16: Level Validation Engine
 * Iterates through all levels and confirms that at least one available gear combination
 * mathematically produces the target RPM.
 * @returns {Object} Validation summary with allPass boolean and results array
 */
function validateLevels() {
  console.log('=== [GearFactory3D Level Validation Suite] ===');
  let allPass = true;
  const results = [];

  for (const lvl of levelData) {
    const motor = lvl.motorRPM;
    const target = lvl.targetRPM;
    const gears = lvl.availableGears || [10, 20, 30, 40, 50];
    const requireSeparate = lvl.requireSeparateGears !== false;
    let foundSolution = false;

    for (const inTeeth of gears) {
      for (const outTeeth of gears) {
        if (requireSeparate && inTeeth === outTeeth) continue;
        const outSpeed = (motor * inTeeth) / outTeeth;
        if (Math.abs(outSpeed - target) <= 0.5) {
          foundSolution = true;
          break;
        }
      }
      if (foundSolution) break;
    }

    if (foundSolution) {
      console.log(`Level ${lvl.level} (${lvl.difficulty}) ✓`);
      results.push({ level: lvl.level, valid: true });
    } else {
      console.error(`Level ${lvl.level} ERROR — NO VALID GEAR COMBINATION (Motor: ${motor}, Target: ${target})`);
      results.push({ level: lvl.level, valid: false });
      allPass = false;
    }
  }

  console.log(`Validation finished: ${allPass ? `ALL ${levelData.length} LEVELS VALIDATED ✓` : 'VALIDATION FAILED ✗'}`);
  return { allPass, results };
}

/**
 * Requirement 14: Progress Persistence (localStorage)
 */
function getHighestUnlockedLevel() {
  try {
    const val = parseInt(localStorage.getItem(STORAGE_KEYS.HIGHEST_UNLOCKED), 10);
    return isNaN(val) || val < 1 ? 1 : Math.min(val, levelData.length);
  } catch (e) {
    return 1;
  }
}

function setHighestUnlockedLevel(levelNumber) {
  try {
    const current = getHighestUnlockedLevel();
    if (levelNumber > current && levelNumber <= levelData.length) {
      localStorage.setItem(STORAGE_KEYS.HIGHEST_UNLOCKED, levelNumber.toString());
    }
  } catch (e) { }
}

function getCompletedLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPLETED_LEVELS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

function setLevelCompleted(levelNumber) {
  try {
    const list = getCompletedLevels();
    if (!list.includes(levelNumber)) {
      list.push(levelNumber);
      localStorage.setItem(STORAGE_KEYS.COMPLETED_LEVELS, JSON.stringify(list));
    }
    setHighestUnlockedLevel(levelNumber + 1);
  } catch (e) { }
}

function isLevelUnlocked(levelNumber) {
  if (levelNumber === 1) return true;
  return levelNumber <= getHighestUnlockedLevel();
}

function isLevelCompleted(levelNumber) {
  return getCompletedLevels().includes(levelNumber);
}

function getNextIncompleteLevel() {
  const completed = getCompletedLevels();
  const highest = getHighestUnlockedLevel();
  for (let i = 1; i <= highest; i++) {
    if (!completed.includes(i)) return i;
  }
  return Math.min(highest, levelData.length);
}
// --- End: src/levels.js ---

// --- Begin: src/audio.js ---
/**
 * Gear Factory 3D — Audio Synthesizer & Sound FX Engine
 *
 * Requirements & Features:
 * - Native Web Audio API procedural synthesis (zero asset dependencies)
 * - Prepared for future Android / Capacitor packaging and audio file loading
 * - Graceful fallback when AudioContext is blocked or unsupported
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    let savedSound = true;
    let savedMusic = true;
    if (typeof localStorage !== 'undefined') {
      const s = localStorage.getItem('gearfactory_sound_enabled');
      if (s !== null) savedSound = s === 'true';
      const m = localStorage.getItem('gearfactory_music_enabled');
      if (m !== null) savedMusic = m === 'true';
    }
    this.soundEnabled = savedSound;
    this.musicEnabled = savedMusic;
    this.isEnabled = this.soundEnabled;
    this.motorOsc = null;
    this.motorGain = null;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  isMusicEnabled() {
    return this.musicEnabled;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled;
    this.isEnabled = this.soundEnabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gearfactory_sound_enabled', String(this.soundEnabled));
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = !!enabled;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gearfactory_music_enabled', String(this.musicEnabled));
    }
  }

  toggleSound() {
    this.setSoundEnabled(!this.soundEnabled);
    return this.soundEnabled;
  }

  toggleSfx() {
    return this.toggleSound();
  }

  toggleMusic() {
    this.setMusicEnabled(!this.musicEnabled);
    return this.musicEnabled;
  }

  initContext() {
    if (!this.ctx && (typeof window !== 'undefined')) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Short metallic click when mounting a gear card to a shaft.
   */
  playGearMount() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(820, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.20, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch {
      // Audio fallback safe
    }
  }

  /**
   * Mechanical clack when unmounting/clearing gears.
   */
  playGearClear() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.13);
    } catch {}
  }

  /**
   * Ascending frequency hum simulating motor coil startup.
   */
  playMotorStart() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12, this.ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.56);
    } catch {}
  }

  /**
   * Decelerating spin-down hum on motor shutdown.
   */
  playMotorStop() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.45);

      gain.gain.setValueAtTime(0.10, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.48);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.50);
    } catch {}
  }

  /**
   * Harmonious chime for level completion.
   */
  playSuccess() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const start = this.ctx.currentTime + idx * 0.08;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(start);
        osc.stop(start + 0.36);
      });
    } catch {}
  }

  /**
   * Low warning buzz on incorrect gear ratio solution.
   */
  playError() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.30);
    } catch {}
  }

  /**
   * Subtle button click tactile feedback.
   */
  playButtonClick() {
    if (!this.isEnabled) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {}
  }

  setEnabled(enabled) {
    this.isEnabled = !!enabled;
  }
}

const audio = new SoundEngine();
// --- End: src/audio.js ---

// --- Begin: src/gears.js ---
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
function createSpurGear(options = {}) {
  const {
    teeth = 20,
    module = GEAR_MODULE,
    thickness = 0.65,
    boreRadius = 0.42,
    pressureAngleDeg = 20,
    color = 0x9eb0c2, // Hardened machined alloy gear steel
    metalness = 0.88,
    roughness = 0.28,
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

const createGear = createSpurGear;
// --- End: src/gears.js ---

// --- Begin: src/motor.js ---
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


/**
 * Creates an industrial electric motor drive unit oriented along the X-axis.
 * @param {Object} options - Motor dimensions, colors, and pedestal height
 * @returns {THREE.Group} Complete electric motor assembly
 */
function createMotor(options = {}) {
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
// --- End: src/motor.js ---

// --- Begin: src/bearings.js ---
/**
 * Gear Factory 3D — Bearings & Structural Supports
 *
 * Requirements & Features:
 * - Deep-groove ball bearing with stationary outer ring, rotating inner ring, chrome balls & retainer cage
 * - Open cast iron bearing housing with perimeter hex bolts and grease port
 * - Shaft support assembly pairing bearing with mounting bulkhead
 * - Heavy-duty base mounting feet with anchor bolts
 */


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
function createBallBearing(options = {}) {
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

const createBearing = createBallBearing;

/**
 * Creates an open industrial bearing mounting housing / flange bracket.
 * Grips outer ring securely while leaving face and balls 100% visible through window.
 * @param {Object} options - Housing parameters
 * @returns {THREE.Group} Bearing housing assembly
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
function createShaftSupport(options = {}) {
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
// --- End: src/bearings.js ---

// --- Begin: src/shafts.js ---
/**
 * Gear Factory 3D — Transmission Shafts Generator
 *
 * Requirements & Features:
 * - Precision ground chrome steel cylinder
 * - Optional flexible shaft coupling with clamping bolts
 * - Drive keyway bar for clear rotation visibility
 */


/**
 * Creates a precision metallic cylindrical shaft oriented along the X-axis.
 * Supports optional industrial flexible coupling collar and drive keyway.
 * @param {Object} options - Shaft specifications
 * @returns {THREE.Group} Shaft component assembly
 */
function createShaft(options = {}) {
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
// --- End: src/shafts.js ---

// --- Begin: src/lighting.js ---
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


let inputGearGlow = null;
let outputGearGlow = null;

/**
 * Creates lightweight 3D industrial workshop architecture and machinery.
 * @param {THREE.Scene} scene - The target Three.js scene
 * @returns {THREE.Group} Complete environment group
 */
function createWorkshopEnvironment(scene) {
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
function setupLighting(scene) {
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

function updateGlowPositions(inX, inY, inZ, outX, outY, outZ) {
  if (inputGearGlow) inputGearGlow.position.set(inX, inY, inZ);
  if (outputGearGlow) outputGearGlow.position.set(outX, outY, outZ);
}

// --- End: src/lighting.js ---

// --- Begin: src/camera.js ---
/**
 * Gear Factory 3D — Perspective Camera System
 */


const defaultCameraPos = new THREE.Vector3(-9.0, 8.2, 18.5);
const defaultTargetPos = new THREE.Vector3(-0.5, 4.0, 0.0);

const camera = new THREE.PerspectiveCamera(45, 16 / 10, 0.1, 100);
camera.position.copy(defaultCameraPos);

/**
 * Updates camera projection aspect ratio and matrix.
 * @param {number} width - Viewport width
 * @param {number} height - Viewport height
 */
function updateCameraAspect(width, height) {
  if (width <= 0 || height <= 0) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

/**
 * Resets camera viewpoint and targets both meshing gears.
 * @param {Object} controls - Optional OrbitControls reference
 */
function resetCamera(controls = null) {
  camera.position.copy(defaultCameraPos);
  if (controls) {
    controls.target.copy(defaultTargetPos);
    controls.update();
  }
}
// --- End: src/camera.js ---

// --- Begin: src/controls.js ---
/**
 * Gear Factory 3D — Camera OrbitControls Setup
 */


let controlsInstance = null;

/**
 * Initializes OrbitControls on camera and canvas DOM element.
 * @param {THREE.Camera} camera - The perspective camera
 * @param {HTMLElement} domElement - The WebGL canvas element
 * @returns {OrbitControls}
 */
function initControls(camera, domElement) {
  controlsInstance = new OrbitControls(camera, domElement);
  controlsInstance.enableDamping = true;
  controlsInstance.dampingFactor = 0.05;
  controlsInstance.target.copy(defaultTargetPos);
  controlsInstance.maxPolarAngle = Math.PI / 2 - 0.02; // Prevent dipping below floor
  controlsInstance.minDistance = 3.0;
  controlsInstance.maxDistance = 60.0;

  return controlsInstance;
}

function updateControls() {
  if (controlsInstance) {
    controlsInstance.update();
  }
}

function getControls() {
  return controlsInstance;
}

function resetControls() {
  if (controlsInstance) {
    controlsInstance.target.copy(defaultTargetPos);
    controlsInstance.update();
  }
}
// --- End: src/controls.js ---

// --- Begin: src/scene.js ---
/**
 * Gear Factory 3D — Three.js Scene & Renderer Setup
 */


const scene = new THREE.Scene();
scene.background = new THREE.Color(0x384250);
scene.fog = new THREE.Fog(0x384250, 42, 98);

let rendererInstance = null;

/**
 * Initializes WebGL renderer bound to target canvas element.
 * @param {HTMLCanvasElement} canvas - The WebGL canvas
 * @param {number} width - Initial container client width
 * @param {number} height - Initial container client height
 * @returns {THREE.WebGLRenderer}
 */
function initRenderer(canvas, width = 800, height = 500) {
  if (rendererInstance) return rendererInstance;

  const configs = [
    { canvas, antialias: true, powerPreference: 'high-performance', alpha: false, failIfMajorPerformanceCaveat: false },
    { canvas, antialias: false, powerPreference: 'default', alpha: false, failIfMajorPerformanceCaveat: false },
    { canvas, antialias: false, alpha: false }
  ];

  for (const cfg of configs) {
    try {
      rendererInstance = new THREE.WebGLRenderer(cfg);
      if (rendererInstance) break;
    } catch (e) {
      console.warn('Three.js WebGLRenderer creation attempt failed with config:', cfg, e);
    }
  }

  if (!rendererInstance) {
    console.error('WebGL is not supported or hardware acceleration is disabled.');
    const container = canvas ? canvas.parentElement : document.getElementById('three-container');
    if (container) {
      const errBanner = document.createElement('div');
      errBanner.id = 'webgl-error-banner';
      errBanner.style.cssText = 'position:absolute;inset:16px;z-index:999;background:rgba(15,23,42,0.96);border:2px solid #ef4444;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;color:#f8fafc;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.8);';
      errBanner.innerHTML = `
        <div style="font-size:36px;margin-bottom:12px;">⚠️</div>
        <h2 style="font-size:20px;color:#f87171;margin-bottom:10px;font-family:'Outfit',sans-serif;">Hardware Acceleration Disabled</h2>
        <p style="font-size:14px;color:#cbd5e1;max-width:540px;line-height:1.6;margin-bottom:16px;">
          Your browser cannot create a 3D WebGL graphics context. This usually happens when Hardware Acceleration is turned off in browser settings.
        </p>
        <div style="background:rgba(0,0,0,0.4);border-radius:8px;padding:12px 18px;text-align:left;font-size:13px;color:#94a3b8;line-height:1.7;margin-bottom:18px;">
          <div>• <strong>Edge:</strong> Go to <code>edge://settings/system</code> &gt; Turn ON <em>"Use graphics acceleration when available"</em></div>
          <div>• <strong>Chrome:</strong> Go to <code>chrome://settings/system</code> &gt; Turn ON <em>"Use graphics acceleration when available"</em></div>
          <div>• Then restart or reload this page.</div>
        </div>
        <button onclick="window.location.reload()" style="background:#ef4444;color:#ffffff;border:none;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;">
          Reload Page
        </button>
      `;
      container.style.position = 'relative';
      container.appendChild(errBanner);
    }
    throw new Error('WebGL context creation failed.');
  }

  rendererInstance.setSize(width, height);
  rendererInstance.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  rendererInstance.shadowMap.enabled = true;
  rendererInstance.shadowMap.type = THREE.PCFSoftShadowMap;
  rendererInstance.toneMapping = THREE.ACESFilmicToneMapping;
  rendererInstance.toneMappingExposure = 1.30;

  return rendererInstance;
}

function getRenderer() {
  return rendererInstance;
}

function render(camera) {
  if (rendererInstance && camera) {
    rendererInstance.render(scene, camera);
  }
}
// --- End: src/scene.js ---

// --- Begin: src/gearbox.js ---
/**
 * Gear Factory 3D — Gearbox Housing, 3D Labels & Complete Mechanical Assembly
 *
 * Requirements & Features:
 * - Rectangular industrial casing with transparent acrylic inspection panels
 * - 3D billboard callout labels with leader lines
 * - Complete assembly builder coordinating motor, shafts, bearings, and spur gears
 * - Guaranteed clearance checks (2.0 to 5.0 units safe clearance)
 */


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
function createGearboxCasing(options = {}) {
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
function createDirectionIndicator(radius = 1.6, isClockwise = true, color = 0xf59e0b) {
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
function buildGearTrain(scene, state, selectedInputTeeth = 20, selectedOutputTeeth = 30, oldAssembly = {}) {
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
// --- End: src/gearbox.js ---

// --- Begin: src/ui.js ---
/**
 * Gear Factory 3D — User Interface Controller
 *
 * Requirements & Features:
 * - Decouples HTML DOM controls from 3D scene rendering
 * - Tactile gear inventory selection cards
 * - Strict answer concealment before solution verification
 * - Dynamic verification results card & feedback banners
 * - Live HUD meters & machine operational controls
 */


// DOM Element References Cache
const elements = {
  // Status
  statusBadge: document.getElementById('system-status'),
  statusLabel: document.getElementById('system-status')?.querySelector('.status-label'),
  validationStatus: document.getElementById('validation-status'),

  // Machine Buttons
  btnStart: document.getElementById('btn-start'),
  btnStop: document.getElementById('btn-stop'),
  btnReset: document.getElementById('btn-reset'),
  btnCameraReset: document.getElementById('btn-camera-reset'),
  btnToggleLabels: document.getElementById('btn-toggle-labels'),
  labelToggleText: document.getElementById('label-toggle-text'),

  // Level and Objectives
  puzzleLevelIndicator: document.getElementById('puzzle-level-indicator'),
  puzzleGameStatus: document.getElementById('puzzle-game-status'),
  puzzleStatusText: document.getElementById('puzzle-status-text'),
  puzzleStatusVal: document.getElementById('puzzle-status-val'),
  puzzleInputRpm: document.getElementById('puzzle-input-rpm'),
  puzzleTargetOutputRpm: document.getElementById('puzzle-target-output-rpm'),
  puzzleCalculatedOutputRpm: document.getElementById('puzzle-calculated-output-rpm'),
  puzzleResultTargetRpm: document.getElementById('puzzle-result-target-rpm'),
  resultInputGear: document.getElementById('result-input-gear'),
  resultOutputGear: document.getElementById('result-output-gear'),
  verificationStatusPill: document.getElementById('verification-status-pill'),

  // Action Buttons
  btnCheckSolution: document.getElementById('btn-check-solution'),
  btnResetLevel: document.getElementById('btn-reset-level'),
  btnPrevLevel: document.getElementById('btn-prev-level'),
  btnNextLevel: document.getElementById('btn-next-level'),
  btnClearSelection: document.getElementById('btn-clear-selection'),
  btnHeaderPrevLevel: document.getElementById('btn-header-prev-level'),
  btnHeaderNextLevel: document.getElementById('btn-header-next-level'),
  headerLevelText: document.getElementById('header-level-text'),
  btnHowItWorksAction: document.getElementById('btn-how-it-works-action'),

  // Banners
  puzzleSuccessBanner: document.getElementById('puzzle-success-banner'),
  puzzleFailBanner: document.getElementById('puzzle-fail-banner'),
  successBannerDesc: document.getElementById('success-banner-desc'),
  failBannerDesc: document.getElementById('fail-banner-desc'),

  // Phase 2 Displays & Controls
  inventorySelectionBadge: document.getElementById('inventory-selection-badge'),
  selectedInventoryGearName: document.getElementById('selected-inventory-gear-name'),
  btnPlaceInput: document.getElementById('btn-place-input'),
  btnPlaceInputText: document.getElementById('btn-place-input-text'),
  btnClearInput: document.getElementById('btn-clear-input'),
  inputShaftSlot: document.getElementById('input-shaft-slot'),
  btnPlaceOutput: document.getElementById('btn-place-output'),
  btnPlaceOutputText: document.getElementById('btn-place-output-text'),
  btnClearOutput: document.getElementById('btn-clear-output'),
  outputShaftSlot: document.getElementById('output-shaft-slot'),
  availableGearsList: document.getElementById('available-gears-list'),

  // Displays
  selectedInputGearDisplay: document.getElementById('selected-input-gear-display'),
  selectedOutputGearDisplay: document.getElementById('selected-output-gear-display'),
  inputGearChipsContainer: document.getElementById('input-gear-chips'),
  outputGearChipsContainer: document.getElementById('output-gear-chips'),

  // Telemetry & Legacy
  inputRpmVal: document.getElementById('input-rpm-val'),
  outputRpmVal: document.getElementById('output-rpm-val'),
  inputMeterFill: document.getElementById('input-meter-fill'),
  outputMeterFill: document.getElementById('output-meter-fill'),
  statInputTeeth: document.getElementById('stat-input-teeth'),
  statOutputTeeth: document.getElementById('stat-output-teeth'),
  statInputRpmDisplay: document.getElementById('stat-input-rpm-display'),
  statOutputRpmDisplay: document.getElementById('stat-output-rpm-display'),
  statGearRatio: document.getElementById('stat-gear-ratio'),

  // Phase 3: Real-Time RPM Transmission Telemetry
  telemetryMotorRpm: document.getElementById('telemetry-motor-rpm'),
  telemetryInputRpm: document.getElementById('telemetry-input-rpm'),
  telemetryOutputRpm: document.getElementById('telemetry-output-rpm'),
  tileOutputRpm: document.getElementById('tile-output-rpm'),

  // Phase 4: Level Select & Header Navigation
  btnHeaderPlay: document.getElementById('btn-header-play'),
  btnHeaderLevelSelect: document.getElementById('btn-header-level-select'),
  levelSelectModal: document.getElementById('level-select-modal'),
  btnCloseLevelSelect: document.getElementById('btn-close-level-select'),
  levelSelectGrid: document.getElementById('level-select-grid'),

  // Phase 7: Navigation & Modals
  btnHeaderTutorial: document.getElementById('btn-header-tutorial'),
  btnHeaderPause: document.getElementById('btn-header-pause'),
  btnHeaderMenu: document.getElementById('btn-header-menu'),
  levelTimerDisplay: document.getElementById('level-timer-display'),

  // Main Menu Modal
  mainMenuModal: document.getElementById('main-menu-modal'),
  btnCloseMainMenu: document.getElementById('btn-close-main-menu'),
  btnMenuPlay: document.getElementById('btn-menu-play'),
  btnMenuLevelSelect: document.getElementById('btn-menu-level-select'),
  btnMenuTutorial: document.getElementById('btn-menu-tutorial'),
  btnMenuSettings: document.getElementById('btn-menu-settings'),

  // Level Intro Modal
  levelIntroModal: document.getElementById('level-intro-modal'),
  introTierBadge: document.getElementById('intro-tier-badge'),
  introLevelTitle: document.getElementById('intro-level-title'),
  introTargetRpm: document.getElementById('intro-target-rpm'),
  btnStartLevel: document.getElementById('btn-start-level'),

  // Level Complete Modal
  levelCompleteModal: document.getElementById('level-complete-modal'),
  modalOutputRpm: document.getElementById('modal-output-rpm'),
  modalElapsedTime: document.getElementById('modal-elapsed-time'),
  btnModalNextLevel: document.getElementById('btn-modal-next-level'),
  btnModalLevelSelect: document.getElementById('btn-modal-level-select'),
  btnModalReplay: document.getElementById('btn-modal-replay'),

  // Pause Modal
  pauseModal: document.getElementById('pause-modal'),
  btnPauseResume: document.getElementById('btn-pause-resume'),
  btnPauseReset: document.getElementById('btn-pause-reset'),
  btnPauseLevelSelect: document.getElementById('btn-pause-level-select'),
  btnPauseMainMenu: document.getElementById('btn-pause-main-menu'),

  // Settings Modal
  settingsModal: document.getElementById('settings-modal'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  btnToggleSound: document.getElementById('btn-toggle-sound'),
  btnToggleMusic: document.getElementById('btn-toggle-music'),
  btnBackSettings: document.getElementById('btn-back-settings'),

  // Tutorial Dock & Modal
  tutorialDock: document.getElementById('tutorial-dock'),
  tutorialModal: document.getElementById('tutorial-modal'),

  // Phase 11: Beginner-Friendly Guidance & Onboarding Elements
  btnRpmInfo: document.getElementById('btn-rpm-info'),
  rpmInfoModal: document.getElementById('rpm-info-modal'),
  btnCloseRpmInfo: document.getElementById('btn-close-rpm-info'),
  btnGotRpmInfo: document.getElementById('btn-got-rpm-info'),

  welcomeModal: document.getElementById('welcome-modal'),
  btnWelcomeStart: document.getElementById('btn-welcome-start'),

  howGearsWorkModal: document.getElementById('how-gears-work-modal'),
  btnCloseHowGears: document.getElementById('btn-close-how-gears'),
  btnHowGearsPrev: document.getElementById('btn-how-gears-prev'),
  btnHowGearsNext: document.getElementById('btn-how-gears-next'),
  howGearsGuideTitle: document.getElementById('how-gears-guide-title'),
  howGearsBody: document.getElementById('how-gears-body'),
  howGearsDots: document.getElementById('how-gears-dots'),

  missionVisualHint: document.getElementById('mission-visual-hint'),
  missionObjectiveText: document.getElementById('mission-objective-text'),
  contextualHintBar: document.getElementById('contextual-hint-bar'),
  contextualHintText: document.getElementById('contextual-hint-text'),
  introVisualHint: document.getElementById('intro-visual-hint'),
  introTeachMsg: document.getElementById('intro-teach-msg'),
};

/**
 * Initializes button listeners and binds them to callback handlers.
 * @param {Object} handlers - Callback actions
 */
function initUI(handlers = {}) {
  const {
    onStart,
    onStop,
    onReset,
    onCheckSolution,
    onResetLevel,
    onPrevLevel,
    onNextLevel,
    onClearSelection,
    onCameraReset,
    onToggleLabels,
    onSelectGear,
    onPlaceInputGear,
    onPlaceOutputGear,
    onClearInputGear,
    onClearOutputGear,
    onSelectInputGear,
    onSelectOutputGear,
  } = handlers;

  // Machine controls
  elements.btnStart?.addEventListener('click', () => onStart && onStart());
  elements.btnStop?.addEventListener('click', () => onStop && onStop());
  elements.btnReset?.addEventListener('click', () => onReset && onReset());

  // Viewport tools
  elements.btnCameraReset?.addEventListener('click', () => onCameraReset && onCameraReset());
  elements.btnToggleLabels?.addEventListener('click', () => onToggleLabels && onToggleLabels());

  // Puzzle Actions
  elements.btnCheckSolution?.addEventListener('click', () => onCheckSolution && onCheckSolution());
  elements.btnResetLevel?.addEventListener('click', () => onResetLevel && onResetLevel());
  elements.btnPrevLevel?.addEventListener('click', () => onPrevLevel && onPrevLevel());
  elements.btnNextLevel?.addEventListener('click', () => onNextLevel && onNextLevel());
  elements.btnHeaderPrevLevel?.addEventListener('click', () => onPrevLevel && onPrevLevel());
  elements.btnHeaderNextLevel?.addEventListener('click', () => onNextLevel && onNextLevel());
  elements.btnClearSelection?.addEventListener('click', () => onClearSelection && onClearSelection());
  elements.btnHowItWorksAction?.addEventListener('click', () => openHowGearsModal(0));

  // Phase 2 Slot Buttons
  elements.btnPlaceInput?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onPlaceInputGear) onPlaceInputGear();
  });
  elements.btnPlaceOutput?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onPlaceOutputGear) onPlaceOutputGear();
  });

  elements.btnClearInput?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onClearInputGear) onClearInputGear();
  });
  elements.btnClearOutput?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onClearOutputGear) onClearOutputGear();
  });

  // Slot card click (click anywhere on the slot card to place)
  elements.inputShaftSlot?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-clear-input')) return;
    if (onPlaceInputGear) onPlaceInputGear();
  });
  elements.outputShaftSlot?.addEventListener('click', (e) => {
    if (e.target.closest('#btn-clear-output')) return;
    if (onPlaceOutputGear) onPlaceOutputGear();
  });

  // Phase 4 Header Navigation & Modal Events
  elements.btnHeaderPlay?.addEventListener('click', () => {
    if (handlers.onPlayNext) handlers.onPlayNext();
  });
  elements.btnHeaderLevelSelect?.addEventListener('click', () => {
    if (handlers.onOpenLevelSelect) handlers.onOpenLevelSelect();
  });
  elements.btnCloseLevelSelect?.addEventListener('click', () => {
    closeLevelSelectModal();
  });
  elements.levelSelectModal?.addEventListener('click', (e) => {
    if (e.target === elements.levelSelectModal) closeLevelSelectModal();
  });

  // Phase 7 Navigation & Modals Binding
  elements.btnHeaderTutorial?.addEventListener('click', () => {
    if (handlers.onOpenTutorial) handlers.onOpenTutorial();
  });
  elements.btnHeaderPause?.addEventListener('click', () => {
    if (handlers.onTogglePause) handlers.onTogglePause();
  });
  elements.btnHeaderMenu?.addEventListener('click', () => {
    if (handlers.onOpenMainMenu) handlers.onOpenMainMenu();
  });

  // Main Menu Modal
  elements.btnCloseMainMenu?.addEventListener('click', () => closeMainMenu());
  elements.mainMenuModal?.addEventListener('click', (e) => {
    if (e.target === elements.mainMenuModal) closeMainMenu();
  });
  elements.btnMenuPlay?.addEventListener('click', () => {
    closeMainMenu();
    if (handlers.onPlayNext) handlers.onPlayNext();
  });
  elements.btnMenuLevelSelect?.addEventListener('click', () => {
    closeMainMenu();
    if (handlers.onOpenLevelSelect) handlers.onOpenLevelSelect();
  });
  elements.btnMenuTutorial?.addEventListener('click', () => {
    closeMainMenu();
    if (handlers.onOpenTutorial) handlers.onOpenTutorial();
  });
  elements.btnMenuSettings?.addEventListener('click', () => {
    closeMainMenu();
    if (handlers.onOpenSettings) handlers.onOpenSettings();
  });

  // Pause Modal
  elements.pauseModal?.addEventListener('click', (e) => {
    if (e.target === elements.pauseModal) closePauseModal();
  });
  elements.btnPauseResume?.addEventListener('click', () => {
    closePauseModal();
    if (handlers.onResume) handlers.onResume();
  });
  elements.btnPauseReset?.addEventListener('click', () => {
    closePauseModal();
    if (handlers.onResetLevel) handlers.onResetLevel();
  });
  elements.btnPauseLevelSelect?.addEventListener('click', () => {
    closePauseModal();
    if (handlers.onOpenLevelSelect) handlers.onOpenLevelSelect();
  });
  elements.btnPauseMainMenu?.addEventListener('click', () => {
    closePauseModal();
    if (handlers.onOpenMainMenu) handlers.onOpenMainMenu();
  });

  // Settings Modal
  elements.btnCloseSettings?.addEventListener('click', () => closeSettingsModal());
  elements.btnBackSettings?.addEventListener('click', () => closeSettingsModal());
  elements.settingsModal?.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettingsModal();
  });
  elements.btnToggleSound?.addEventListener('click', () => {
    if (handlers.onToggleSound) handlers.onToggleSound();
  });
  elements.btnToggleMusic?.addEventListener('click', () => {
    if (handlers.onToggleMusic) handlers.onToggleMusic();
  });

  // Phase 11: Beginner-Friendly Guidance & Onboarding Listeners
  elements.btnRpmInfo?.addEventListener('click', () => openRpmInfoModal());
  elements.btnCloseRpmInfo?.addEventListener('click', () => closeRpmInfoModal());
  elements.btnGotRpmInfo?.addEventListener('click', () => closeRpmInfoModal());
  elements.rpmInfoModal?.addEventListener('click', (e) => {
    if (e.target === elements.rpmInfoModal) closeRpmInfoModal();
  });

  elements.btnWelcomeStart?.addEventListener('click', () => {
    closeWelcomeModal();
    try {
      localStorage.setItem('gearfactory_welcomed', 'true');
      localStorage.setItem('gear_factory_has_seen_welcome', 'true');
    } catch (e) {}
    if (handlers.onWelcomeStart) handlers.onWelcomeStart();
  });
  elements.welcomeModal?.addEventListener('click', (e) => {
    if (e.target === elements.welcomeModal) closeWelcomeModal();
  });

  elements.btnCloseHowGears?.addEventListener('click', () => closeHowGearsModal());
  elements.btnHowGearsPrev?.addEventListener('click', () => prevHowGearsPage());
  elements.btnHowGearsNext?.addEventListener('click', () => nextHowGearsPage());
  elements.howGearsWorkModal?.addEventListener('click', (e) => {
    if (e.target === elements.howGearsWorkModal) closeHowGearsModal();
  });

  // Available Gear Inventory Binding
  createGearInventory(onSelectGear, onSelectInputGear, onSelectOutputGear);
}

/**
 * Creates or attaches listeners to gear inventory cards.
 */
function createGearInventory(onSelectGear, onSelectInput, onSelectOutput) {
  // Available Gears list (Phase 2 primary inventory)
  document.querySelectorAll('.available-gear-card').forEach((card) => {
    card.addEventListener('click', () => {
      const teeth = parseInt(card.getAttribute('data-teeth'), 10);
      if (onSelectGear) {
        onSelectGear(teeth);
      } else if (onSelectInput) {
        onSelectInput(teeth);
      }
    });
  });

  // Legacy/Backwards-compatible input & output chips
  document.querySelectorAll('.gear-chip.input-chip').forEach((card) => {
    card.addEventListener('click', () => {
      const teeth = parseInt(card.getAttribute('data-teeth'), 10);
      if (onSelectInput) onSelectInput(teeth);
    });
  });

  document.querySelectorAll('.gear-chip.output-chip').forEach((card) => {
    card.addEventListener('click', () => {
      const teeth = parseInt(card.getAttribute('data-teeth'), 10);
      if (onSelectOutput) onSelectOutput(teeth);
    });
  });
}

/**
 * Synchronizes gear cards DOM highlights and statuses.
 */
function updateSelectedGearsUI(selectedInputTeeth, selectedOutputTeeth, selectedInventoryGear = null, requireSeparateGears = true) {
  // Update Header Badges
  if (elements.selectedInputGearDisplay) {
    elements.selectedInputGearDisplay.textContent = selectedInputTeeth ? `${selectedInputTeeth} T` : 'NONE';
  }
  if (elements.selectedOutputGearDisplay) {
    elements.selectedOutputGearDisplay.textContent = selectedOutputTeeth ? `${selectedOutputTeeth} T` : 'NONE';
  }

  // Update Inventory Selection Badge
  if (elements.selectedInventoryGearName) {
    elements.selectedInventoryGearName.textContent = selectedInventoryGear ? `${selectedInventoryGear}T` : 'None';
  }

  // Update Available Gears Cards
  document.querySelectorAll('.available-gear-card').forEach((card) => {
    const t = parseInt(card.getAttribute('data-teeth'), 10);
    const statusEl = card.querySelector('.card-status');
    const isSelectedInInv = selectedInventoryGear === t;
    const isMountedInput = selectedInputTeeth === t;
    const isMountedOutput = selectedOutputTeeth === t;

    card.classList.toggle('selected', isSelectedInInv);
    card.classList.toggle('active', isSelectedInInv);

    if (statusEl) {
      if (isSelectedInInv) {
        statusEl.textContent = 'SELECTED';
      } else if (isMountedInput && isMountedOutput) {
        statusEl.textContent = 'IN BOTH';
      } else if (isMountedInput) {
        statusEl.textContent = 'IN INPUT';
      } else if (isMountedOutput) {
        statusEl.textContent = 'IN OUTPUT';
      } else {
        statusEl.textContent = 'READY';
      }
    }
  });

  // Update Input Shaft Slot
  if (elements.inputShaftSlot) {
    const isMounted = !!selectedInputTeeth;
    elements.inputShaftSlot.classList.toggle('ready-to-place', !isMounted && !!selectedInventoryGear);

    if (elements.btnPlaceInputText) {
      elements.btnPlaceInputText.textContent = isMounted ? `⚙ ${selectedInputTeeth}T (MOUNTED)` : 'PLACE GEAR';
    }
    if (elements.btnPlaceInput) {
      elements.btnPlaceInput.classList.toggle('mounted-input', isMounted);
    }
    if (elements.btnClearInput) {
      elements.btnClearInput.style.display = isMounted ? 'inline-flex' : 'none';
    }
  }

  // Update Output Shaft Slot
  if (elements.outputShaftSlot) {
    const isMounted = !!selectedOutputTeeth;
    elements.outputShaftSlot.classList.toggle('ready-to-place', !isMounted && !!selectedInventoryGear);

    if (elements.btnPlaceOutputText) {
      elements.btnPlaceOutputText.textContent = isMounted ? `⚙ ${selectedOutputTeeth}T (MOUNTED)` : 'PLACE GEAR';
    }
    if (elements.btnPlaceOutput) {
      elements.btnPlaceOutput.classList.toggle('mounted-output', isMounted);
    }
    if (elements.btnClearOutput) {
      elements.btnClearOutput.style.display = isMounted ? 'inline-flex' : 'none';
    }
  }
}

/**
 * Updates solution verification card.
 * Calculated RPM remains masked ('---') before player presses Check Solution.
 */
function updateVerificationUI(selectedInputTeeth, selectedOutputTeeth, targetRPM, calculatedRPM, hasChecked, isPass) {
  if (elements.resultInputGear) {
    elements.resultInputGear.textContent = selectedInputTeeth ? `${selectedInputTeeth} T` : 'Unmounted';
  }
  if (elements.resultOutputGear) {
    elements.resultOutputGear.textContent = selectedOutputTeeth ? `${selectedOutputTeeth} T` : 'Unmounted';
  }
  if (elements.puzzleResultTargetRpm && targetRPM !== undefined) {
    elements.puzzleResultTargetRpm.textContent = `${targetRPM.toFixed(1)} RPM`;
  }

  if (hasChecked && calculatedRPM !== null) {
    if (elements.puzzleCalculatedOutputRpm) {
      elements.puzzleCalculatedOutputRpm.textContent = `${calculatedRPM.toFixed(1)} RPM`;
      elements.puzzleCalculatedOutputRpm.style.color = isPass ? '#34d399' : '#f59e0b';
    }
    if (elements.verificationStatusPill) {
      elements.verificationStatusPill.textContent = isPass ? 'PERFECT' : 'NOT QUITE';
      elements.verificationStatusPill.className = `verification-status-pill ${isPass ? 'status-complete' : 'status-try-again'}`;
    }
    if (elements.puzzleStatusVal) {
      elements.puzzleStatusVal.textContent = isPass ? 'SPEED MATCH (PERFECT)' : 'SPEED MISMATCH (NOT QUITE)';
      elements.puzzleStatusVal.style.color = isPass ? '#34d399' : '#f59e0b';
    }
  } else {
    if (elements.puzzleCalculatedOutputRpm) {
      elements.puzzleCalculatedOutputRpm.textContent = '---';
      elements.puzzleCalculatedOutputRpm.style.color = '#ffffff';
    }
    if (elements.verificationStatusPill) {
      elements.verificationStatusPill.textContent = 'PENDING';
      elements.verificationStatusPill.className = 'verification-status-pill status-pending';
    }
    if (elements.puzzleStatusVal) {
      elements.puzzleStatusVal.textContent = 'Press Check Solution';
      elements.puzzleStatusVal.style.color = '#94a3b8';
    }
  }
}

/**
 * Sets puzzle status text and status pill color style.
 */
function setPuzzleStatusUI(text, type = 'pending') {
  if (elements.puzzleStatusText) {
    elements.puzzleStatusText.textContent = text;
  }
  if (elements.puzzleGameStatus) {
    elements.puzzleGameStatus.className = `puzzle-status-badge status-${type}`;
  }
}

function showSuccessBanner(message) {
  if (elements.puzzleSuccessBanner) {
    if (elements.successBannerDesc && message) {
      elements.successBannerDesc.textContent = message;
    }
    elements.puzzleSuccessBanner.style.display = 'flex';
  }
  if (elements.puzzleFailBanner) {
    elements.puzzleFailBanner.style.display = 'none';
  }
  // Subtle tactile feedback on supported devices
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(50); } catch (e) {}
  }
}

function showFailBanner(message) {
  if (elements.puzzleFailBanner) {
    if (elements.failBannerDesc && message) {
      elements.failBannerDesc.textContent = message;
    }
    elements.puzzleFailBanner.style.display = 'flex';
  }
  if (elements.puzzleSuccessBanner) {
    elements.puzzleSuccessBanner.style.display = 'none';
  }
}

function hideBanners() {
  if (elements.puzzleSuccessBanner) elements.puzzleSuccessBanner.style.display = 'none';
  if (elements.puzzleFailBanner) elements.puzzleFailBanner.style.display = 'none';
}

/**
 * Updates level objective badges (Current Level, Motor Input RPM, Target RPM, Visual Hint, Objective).
 */
function updateLevelObjectiveUI(levelNumber, totalLevels, inputRPM, targetRPM, difficulty = 'EASY', objective = '', visualHint = '') {
  if (elements.puzzleLevelIndicator) {
    elements.puzzleLevelIndicator.textContent = `Level ${levelNumber} of ${totalLevels} • ${difficulty}`;
  }
  if (elements.puzzleInputRpm) {
    elements.puzzleInputRpm.textContent = inputRPM.toFixed(0);
  }
  if (elements.puzzleTargetOutputRpm) {
    elements.puzzleTargetOutputRpm.textContent = targetRPM.toFixed(0);
  }
  if (elements.missionVisualHint && visualHint) {
    elements.missionVisualHint.textContent = visualHint;
  }
  if (elements.missionObjectiveText && objective) {
    elements.missionObjectiveText.textContent = objective;
  }
  if (elements.btnPrevLevel) {
    elements.btnPrevLevel.disabled = levelNumber <= 1;
  }
  if (elements.btnHeaderPrevLevel) {
    elements.btnHeaderPrevLevel.disabled = levelNumber <= 1;
  }
  if (elements.headerLevelText) {
    elements.headerLevelText.textContent = `LEVEL ${levelNumber}`;
  }

  // Soft guidance pulse on empty shafts for beginner levels 1–5
  if (elements.inputShaftSlot && elements.outputShaftSlot) {
    const isBeginner = levelNumber <= 5;
    elements.inputShaftSlot.classList.toggle('beginner-guidance-pulse', isBeginner && !elements.inputShaftSlot.classList.contains('mounted'));
    elements.outputShaftSlot.classList.toggle('beginner-guidance-pulse', isBeginner && !elements.outputShaftSlot.classList.contains('mounted'));
  }
}

/**
 * Updates live HUD speedometer and telemetry during animation loop.
 */
function updateLiveHUDDisplay(inRPM, outRPM, maxMeterRPM = 150) {
  if (elements.inputRpmVal) elements.inputRpmVal.textContent = inRPM.toFixed(1);
  if (elements.outputRpmVal) elements.outputRpmVal.textContent = outRPM.toFixed(1);

  if (elements.inputMeterFill) {
    const inPct = Math.min(100, Math.max(0, (inRPM / maxMeterRPM) * 100));
    elements.inputMeterFill.style.width = `${inPct}%`;
  }
  if (elements.outputMeterFill) {
    const outPct = Math.min(100, Math.max(0, (outRPM / maxMeterRPM) * 100));
    elements.outputMeterFill.style.width = `${outPct}%`;
  }
}

/**
 * Updates machine status indicator.
 */
function setRunningStateUI(isRunning) {
  if (elements.statusBadge) {
    elements.statusBadge.classList.toggle('active', isRunning);
    elements.statusBadge.classList.toggle('stopped', !isRunning);
  }
  if (elements.statusLabel) {
    elements.statusLabel.textContent = isRunning ? 'RUNNING' : 'STOPPED';
  }
}

function setLabelToggleUI(isVisible) {
  if (elements.btnToggleLabels) {
    elements.btnToggleLabels.classList.toggle('active', isVisible);
  }
  if (elements.labelToggleText) {
    elements.labelToggleText.textContent = isVisible ? 'Labels: ON' : 'Labels: OFF';
  }
}

/**
 * Updates Real-Time RPM Transmission Telemetry panel (outside 3D canvas).
 * @param {number} motorRPM - Live motor speed
 * @param {number} inputRPM - Live input shaft speed
 * @param {number} outputRPM - Live output shaft speed
 * @param {boolean} isEngaged - True if both gears are placed and transmitting
 */
function updateRealtimeRPMUI(motorRPM, inputRPM, outputRPM, isEngaged = false) {
  if (elements.telemetryMotorRpm) {
    elements.telemetryMotorRpm.textContent = `${motorRPM.toFixed(0)} RPM`;
  }
  if (elements.telemetryInputRpm) {
    elements.telemetryInputRpm.textContent = `${inputRPM.toFixed(0)} RPM`;
  }
  if (elements.telemetryOutputRpm) {
    if (isEngaged && outputRPM > 0) {
      elements.telemetryOutputRpm.textContent = `${outputRPM.toFixed(0)} RPM`;
      if (elements.tileOutputRpm) elements.tileOutputRpm.classList.remove('disengaged');
    } else {
      elements.telemetryOutputRpm.textContent = '-- RPM';
      if (elements.tileOutputRpm) elements.tileOutputRpm.classList.add('disengaged');
    }
  }
}

/**
 * Phase 4: Dynamic Available Gears Filtering
 */
function renderAvailableGears(availableGears = [10, 20, 30, 40, 50, 60]) {
  const cards = document.querySelectorAll('.available-gear-card');
  cards.forEach((card) => {
    const t = parseInt(card.getAttribute('data-teeth'), 10);
    if (availableGears.includes(t)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
}

/**
 * Phase 4: Level Select Modal Controls
 */
function openLevelSelectModal() {
  closeLevelIntro();
  if (elements.levelSelectModal) {
    elements.levelSelectModal.style.display = 'flex';
  }
}

function closeLevelSelectModal() {
  if (elements.levelSelectModal) {
    elements.levelSelectModal.style.display = 'none';
  }
}

function renderLevelSelectModal(levels, completedList = [], highestUnlocked = 1, currentLevel = 1, onSelectLevel) {
  if (!elements.levelSelectGrid) return;
  elements.levelSelectGrid.innerHTML = '';

  const tiers = [
    { name: 'BEGINNER', range: 'Levels 1–5', badgeClass: 'badge-easy', start: 1, end: 5 },
    { name: 'INTERMEDIATE', range: 'Levels 6–10', badgeClass: 'badge-medium', start: 6, end: 10 },
    { name: 'HARD', range: 'Levels 11–15', badgeClass: 'badge-hard', start: 11, end: 15 },
    { name: 'EXPERT', range: 'Levels 16–20', badgeClass: 'badge-expert', start: 16, end: 20 },
    { name: 'HARD', range: 'Levels 21–30', badgeClass: 'badge-hard', start: 21, end: 30 },
    { name: 'ADVANCED', range: 'Levels 31–40', badgeClass: 'badge-advanced', start: 31, end: 40 },
    { name: 'EXPERT', range: 'Levels 41–50', badgeClass: 'badge-expert', start: 41, end: 50 },
  ];

  tiers.forEach((tier) => {
    const tierSection = document.createElement('div');
    tierSection.className = 'tier-section';

    const header = document.createElement('div');
    header.className = 'tier-header';
    header.innerHTML = `
      <div class="tier-title-row">
        <span class="tier-badge ${tier.badgeClass}">${tier.name}</span>
        <span class="tier-range-desc">${tier.range}</span>
      </div>
    `;
    tierSection.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'level-buttons-grid';

    for (let lNum = tier.start; lNum <= tier.end; lNum++) {
      const isUnlocked = lNum <= highestUnlocked || lNum === 1;
      const isCompleted = completedList.includes(lNum);
      const isActive = lNum === currentLevel;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `level-tile ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isUnlocked ? 'locked' : ''}`;
      btn.disabled = !isUnlocked;
      btn.title = isUnlocked ? `Play Level ${lNum}` : `Level ${lNum} Locked`;

      let statusText = isCompleted ? '✓ Done' : (isUnlocked ? 'Play' : '🔒');

      btn.innerHTML = `
        <span class="level-tile-num">${lNum}</span>
        <span class="level-tile-status">${statusText}</span>
      `;

      if (isUnlocked) {
        btn.addEventListener('click', () => {
          closeLevelSelectModal();
          if (onSelectLevel) onSelectLevel(lNum);
        });
      }

      grid.appendChild(btn);
    }

    tierSection.appendChild(grid);
    elements.levelSelectGrid.appendChild(tierSection);
  });
}

function openMainMenu() {
  closeLevelIntro();
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'flex';
}

function closeMainMenu() {
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'none';
}

function openPauseModal() {
  closeLevelIntro();
  if (elements.pauseModal) elements.pauseModal.style.display = 'flex';
}

function closePauseModal() {
  if (elements.pauseModal) elements.pauseModal.style.display = 'none';
}

function openSettingsModal() {
  if (elements.settingsModal) elements.settingsModal.style.display = 'flex';
}

function closeSettingsModal() {
  if (elements.settingsModal) elements.settingsModal.style.display = 'none';
}

function updateSettingsUI(soundEnabled, musicEnabled) {
  if (elements.btnToggleSound) {
    elements.btnToggleSound.textContent = soundEnabled ? 'ON' : 'OFF';
    elements.btnToggleSound.classList.toggle('active', !!soundEnabled);
  }
  if (elements.btnToggleMusic) {
    elements.btnToggleMusic.textContent = musicEnabled ? 'ON' : 'OFF';
    elements.btnToggleMusic.classList.toggle('active', !!musicEnabled);
  }
}

function showLevelIntro(level, onStart) {
  if (!elements.levelIntroModal) return;
  if (elements.introTierBadge) {
    elements.introTierBadge.textContent = level.difficulty || 'BEGINNER';
  }
  if (elements.introLevelTitle) {
    elements.introLevelTitle.textContent = level.title || `LEVEL ${level.level}`;
  }
  if (elements.introVisualHint) {
    elements.introVisualHint.textContent = level.visualHint || '⚙️ MECHANICAL PUZZLE';
  }
  if (elements.introTeachMsg) {
    elements.introTeachMsg.textContent = level.teachMessage || level.objective || "Match the target machine speed.";
  }
  if (elements.introTargetRpm) {
    elements.introTargetRpm.textContent = `${level.targetRPM} RPM`;
  }
  elements.levelIntroModal.style.display = 'flex';

  const startBtn = elements.btnStartLevel;
  if (startBtn) {
    const newBtn = startBtn.cloneNode(true);
    startBtn.parentNode.replaceChild(newBtn, startBtn);
    elements.btnStartLevel = newBtn;
    newBtn.addEventListener('click', () => {
      closeLevelIntro();
      if (onStart) onStart();
    });
  }
}

function closeLevelIntro() {
  if (elements.levelIntroModal) elements.levelIntroModal.style.display = 'none';
}

function showLevelComplete(targetRPM, outputRPM, timeStr, callbacks = {}, isFinalLevel = false) {
  if (!elements.levelCompleteModal) return;
  if (elements.modalOutputRpm) {
    elements.modalOutputRpm.textContent = `${Math.round(outputRPM)} RPM`;
  }
  if (elements.modalElapsedTime) {
    elements.modalElapsedTime.textContent = timeStr || '00:00';
  }

  const modalTitle = elements.levelCompleteModal.querySelector('.modal-title');
  const modalEyebrow = elements.levelCompleteModal.querySelector('.modal-eyebrow');
  if (modalTitle) {
    modalTitle.textContent = isFinalLevel ? 'ALL LEVELS COMPLETE' : 'LEVEL COMPLETE';
  }
  if (modalEyebrow) {
    modalEyebrow.textContent = isFinalLevel ? 'CAMPAIGN COMPLETED' : 'MISSION ACCOMPLISHED';
  }

  elements.levelCompleteModal.style.display = 'flex';

  const { onNext, onLevelSelect, onReplay } = callbacks;

  const replaceBtn = (id, fn) => {
    const btn = document.getElementById(id);
    if (!btn) return null;
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
    fresh.addEventListener('click', () => {
      closeLevelComplete();
      if (fn) fn();
    });
    return fresh;
  };

  elements.btnModalNextLevel = replaceBtn('btn-modal-next-level', onNext);
  elements.btnModalLevelSelect = replaceBtn('btn-modal-level-select', onLevelSelect);
  elements.btnModalReplay = replaceBtn('btn-modal-replay', onReplay);

  if (elements.btnModalNextLevel) {
    elements.btnModalNextLevel.style.display = isFinalLevel ? 'none' : '';
  }
}

function closeLevelComplete() {
  if (elements.levelCompleteModal) elements.levelCompleteModal.style.display = 'none';
}

function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function updateTimerDisplay(totalSeconds) {
  const formatted = formatTimer(totalSeconds);
  if (elements.levelTimerDisplay) {
    elements.levelTimerDisplay.textContent = `TIME ${formatted}`;
  }
  return formatted;
}

// ==========================================
// Phase 11: Contextual Hint & Onboarding Modals
// ==========================================

function updateContextualHintUI(hintText) {
  if (elements.contextualHintText && hintText) {
    elements.contextualHintText.textContent = hintText;
    if (elements.contextualHintBar) {
      elements.contextualHintBar.classList.add('hint-highlight');
      setTimeout(() => {
        elements.contextualHintBar?.classList.remove('hint-highlight');
      }, 1500);
    }
  }
}

function openRpmInfoModal() {
  if (elements.rpmInfoModal) {
    elements.rpmInfoModal.classList.add('active');
    elements.rpmInfoModal.style.display = 'flex';
  }
}

function closeRpmInfoModal() {
  if (elements.rpmInfoModal) {
    elements.rpmInfoModal.classList.remove('active');
    elements.rpmInfoModal.style.display = 'none';
  }
}

function openWelcomeModal() {
  closeMainMenu();
  closeLevelIntro();
  if (elements.welcomeModal) {
    elements.welcomeModal.classList.add('active');
    elements.welcomeModal.style.display = 'flex';
  }
}

function closeWelcomeModal() {
  if (elements.welcomeModal) {
    elements.welcomeModal.classList.remove('active');
    elements.welcomeModal.style.display = 'none';
  }
}

function checkFirstTimeWelcome(onStart) {
  try {
    const welcomed = localStorage.getItem('gearfactory_welcomed') || localStorage.getItem('gear_factory_has_seen_welcome');
    if (!welcomed) {
      openWelcomeModal();
      return true;
    }
  } catch (e) {}
  return false;
}

let currentHowGearsPage = 0;

const howGearsPages = [
  {
    title: 'Small Gear',
    svg: `<svg viewBox="0 0 100 100" width="90" height="90">
      <circle cx="50" cy="50" r="30" fill="#1e293b" stroke="#f59e0b" stroke-width="4" stroke-dasharray="6,4"/>
      <circle cx="50" cy="50" r="10" fill="#0f172a" stroke="#f59e0b" stroke-width="2"/>
      <text x="50" y="55" font-size="13" font-family="sans-serif" font-weight="bold" fill="#f59e0b" text-anchor="middle">10T</text>
      <path d="M50 12 A38 38 0 0 1 82 32" fill="none" stroke="#38bdf8" stroke-width="3"/>
    </svg>`,
    desc: 'Small gears have fewer teeth. Small gears can spin faster.'
  },
  {
    title: 'Big Gear',
    svg: `<svg viewBox="0 0 100 100" width="90" height="90">
      <circle cx="50" cy="50" r="42" fill="#1e293b" stroke="#94a3b8" stroke-width="5" stroke-dasharray="8,5"/>
      <circle cx="50" cy="50" r="14" fill="#0f172a" stroke="#94a3b8" stroke-width="2"/>
      <text x="50" y="56" font-size="15" font-family="sans-serif" font-weight="bold" fill="#f1f5f9" text-anchor="middle">40T</text>
      <path d="M50 6 A44 44 0 0 1 76 16" fill="none" stroke="#94a3b8" stroke-width="3"/>
    </svg>`,
    desc: 'Big gears have more teeth. Big gears can spin slower.'
  },
  {
    title: 'Two Gears',
    svg: `<svg viewBox="0 0 120 70" width="120" height="70">
      <circle cx="35" cy="35" r="22" fill="#1e293b" stroke="#f59e0b" stroke-width="3"/>
      <text x="35" y="39" font-size="9" font-weight="bold" fill="#f59e0b" text-anchor="middle">CW ↻</text>
      <circle cx="85" cy="35" r="22" fill="#1e293b" stroke="#38bdf8" stroke-width="3"/>
      <text x="85" y="39" font-size="9" font-weight="bold" fill="#38bdf8" text-anchor="middle">CCW ↺</text>
    </svg>`,
    desc: 'When gears touch, they transfer movement in opposite directions.'
  },
  {
    title: 'Your Turn',
    svg: `<svg viewBox="0 0 100 70" width="100" height="70">
      <rect x="10" y="15" width="80" height="40" rx="8" fill="#1e293b" stroke="#4ade80" stroke-width="3"/>
      <text x="50" y="39" font-size="11" font-weight="bold" fill="#4ade80" text-anchor="middle">MATCH SPEED</text>
    </svg>`,
    desc: 'Try different gears and watch how speed changes to make the machine run!'
  }
];

function openHowGearsModal(page = 0) {
  closeMainMenu();
  closeLevelIntro();
  currentHowGearsPage = Math.max(0, Math.min(page, howGearsPages.length - 1));
  renderHowGearsPage(currentHowGearsPage);
  if (elements.howGearsWorkModal) {
    elements.howGearsWorkModal.classList.add('active');
    elements.howGearsWorkModal.style.display = 'flex';
  }
}

function closeHowGearsModal() {
  if (elements.howGearsWorkModal) {
    elements.howGearsWorkModal.classList.remove('active');
    elements.howGearsWorkModal.style.display = 'none';
  }
}

function renderHowGearsPage(index) {
  currentHowGearsPage = index;
  const p = howGearsPages[index];
  if (!p) return;

  if (elements.howGearsGuideTitle) {
    elements.howGearsGuideTitle.textContent = p.title;
  }
  if (elements.howGearsBody) {
    elements.howGearsBody.innerHTML = `
      <div class="how-gears-illustration">${p.svg}</div>
      <div class="how-gears-page-title">${p.title}</div>
      <p class="how-gears-page-desc">${p.desc}</p>
    `;
  }
  if (elements.howGearsDots) {
    const dots = elements.howGearsDots.querySelectorAll('.h-dot');
    dots.forEach((d, i) => {
      d.classList.toggle('active', i === index);
    });
  }
  if (elements.btnHowGearsPrev) {
    elements.btnHowGearsPrev.disabled = index <= 0;
  }
  if (elements.btnHowGearsNext) {
    elements.btnHowGearsNext.textContent = index >= howGearsPages.length - 1 ? "LET'S PLAY" : "NEXT ➔";
  }
}

function nextHowGearsPage() {
  if (currentHowGearsPage < howGearsPages.length - 1) {
    renderHowGearsPage(currentHowGearsPage + 1);
  } else {
    closeHowGearsModal();
  }
}

function prevHowGearsPage() {
  if (currentHowGearsPage > 0) {
    renderHowGearsPage(currentHowGearsPage - 1);
  }
}

// --- End: src/ui.js ---

// --- Begin: src/drag-drop.js ---
/**
 * Gear Factory 3D — 3D Drag & Drop Placement System (Phase 5)
 *
 * Requirements & Features:
 * - Direct drag-and-drop from inventory into 3D gearbox
 * - Dedicated invisible raycasting targets around input and output shafts
 * - Professional subtle green highlight on valid target hover
 * - Subtle red / neutral feedback over invalid drop areas
 * - Perspective-correct 3D gear preview following mouse/touch without rotating
 * - Automatic snap to shaft positions: INPUT_GEAR_POSITION, OUTPUT_GEAR_POSITION
 * - Return to inventory on invalid drop (no floating gears, no duplicates)
 * - Single gear per shaft rule: replaces old gear and returns it to inventory
 * - OrbitControls automatically paused only while dragging
 * - Desktop mouse and mobile/tablet touch support
 */


const dragDropState = {
  isDragging: false,
  draggedTeeth: null,
  activeHoverTarget: null, // 'input' | 'output' | null
  previewMesh: null,
  dropTargets: {
    input: null,
    output: null,
  },
  haloMeshes: {
    input: null,
    output: null,
  },
  shaftPositions: {
    shaftY: 5.3,
    posZInput: -2.3,
    posZOutput: 2.3,
  },
  dragPlane: new THREE.Plane(),
  raycaster: new THREE.Raycaster(),
  mouseNDC: new THREE.Vector2(),
  scene: null,
  camera: null,
  controls: null,
  canvas: null,
  callbacks: {},
};

/**
 * Creates dedicated invisible raycasting targets and glowing industrial halos
 * around the input and output shaft gear seats.
 */
function createShaftDropTargets(scene, shaftY = 5.3, posZInput = -2.3, posZOutput = 2.3) {
  dragDropState.shaftPositions = { shaftY, posZInput, posZOutput };

  // Remove existing targets if any
  if (dragDropState.dropTargets.input) scene.remove(dragDropState.dropTargets.input);
  if (dragDropState.dropTargets.output) scene.remove(dragDropState.dropTargets.output);
  if (dragDropState.haloMeshes.input) scene.remove(dragDropState.haloMeshes.input);
  if (dragDropState.haloMeshes.output) scene.remove(dragDropState.haloMeshes.output);

  const targetGeo = new THREE.CylinderGeometry(2.2, 2.2, 2.6, 24);
  const targetMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.001,
    depthWrite: false,
  });

  // 1. Input Shaft Drop Target Mesh
  const inputTarget = new THREE.Mesh(targetGeo, targetMat);
  inputTarget.rotation.z = Math.PI / 2;
  inputTarget.position.set(0, shaftY, posZInput);
  inputTarget.userData = { isDropTarget: true, targetType: 'input' };
  scene.add(inputTarget);
  dragDropState.dropTargets.input = inputTarget;

  // 2. Output Shaft Drop Target Mesh
  const outputTarget = new THREE.Mesh(targetGeo, targetMat);
  outputTarget.rotation.z = Math.PI / 2;
  outputTarget.position.set(0, shaftY, posZOutput);
  outputTarget.userData = { isDropTarget: true, targetType: 'output' };
  scene.add(outputTarget);
  dragDropState.dropTargets.output = outputTarget;

  // 3. Subtle Industrial Glowing Halos (Visual Feedback)
  const haloGeo = new THREE.TorusGeometry(1.65, 0.07, 16, 48);
  const sleeveGeo = new THREE.CylinderGeometry(0.85, 0.85, 0.70, 24, 1, true);

  // Input Halo
  const inputHaloGroup = new THREE.Group();
  const inputHaloMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e, // Subtle industrial emerald green
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const inputTorus = new THREE.Mesh(haloGeo, inputHaloMat);
  inputTorus.rotation.y = Math.PI / 2;
  inputHaloGroup.add(inputTorus);

  const inputSleeveMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.0,
    wireframe: true,
    depthWrite: false,
  });
  const inputSleeve = new THREE.Mesh(sleeveGeo, inputSleeveMat);
  inputSleeve.rotation.z = Math.PI / 2;
  inputHaloGroup.add(inputSleeve);

  inputHaloGroup.position.set(0, shaftY, posZInput);
  inputHaloGroup.userData = {
    setOpacity: (op) => {
      inputHaloMat.opacity = op;
      inputSleeveMat.opacity = op * 0.65;
    },
  };
  scene.add(inputHaloGroup);
  dragDropState.haloMeshes.input = inputHaloGroup;

  // Output Halo
  const outputHaloGroup = new THREE.Group();
  const outputHaloMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const outputTorus = new THREE.Mesh(haloGeo, outputHaloMat);
  outputTorus.rotation.y = Math.PI / 2;
  outputHaloGroup.add(outputTorus);

  const outputSleeveMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.0,
    wireframe: true,
    depthWrite: false,
  });
  const outputSleeve = new THREE.Mesh(sleeveGeo, outputSleeveMat);
  outputSleeve.rotation.z = Math.PI / 2;
  outputHaloGroup.add(outputSleeve);

  outputHaloGroup.position.set(0, shaftY, posZOutput);
  outputHaloGroup.userData = {
    setOpacity: (op) => {
      outputHaloMat.opacity = op;
      outputSleeveMat.opacity = op * 0.65;
    },
  };
  scene.add(outputHaloGroup);
  dragDropState.haloMeshes.output = outputHaloGroup;
}

/**
 * Updates positions of drop targets and halos when assembly parameters change.
 */
function updateDropTargetPositions(shaftY, posZInput, posZOutput) {
  dragDropState.shaftPositions = { shaftY, posZInput, posZOutput };

  if (dragDropState.dropTargets.input) {
    dragDropState.dropTargets.input.position.set(0, shaftY, posZInput);
  }
  if (dragDropState.dropTargets.output) {
    dragDropState.dropTargets.output.position.set(0, shaftY, posZOutput);
  }
  if (dragDropState.haloMeshes.input) {
    dragDropState.haloMeshes.input.position.set(0, shaftY, posZInput);
  }
  if (dragDropState.haloMeshes.output) {
    dragDropState.haloMeshes.output.position.set(0, shaftY, posZOutput);
  }
}

/**
 * Starts 3D dragging for a given gear teeth count.
 */
function startGearDrag(teeth, event) {
  if (!teeth || dragDropState.isDragging) return;
  if (typeof window !== 'undefined' && window.gearFactoryState?.isPaused) return;

  const { scene, camera, controls, canvas } = dragDropState;
  if (!scene || !camera) return;

  dragDropState.isDragging = true;
  dragDropState.draggedTeeth = teeth;
  dragDropState.activeHoverTarget = null;

  // Disable OrbitControls so camera doesn't rotate while dragging
  if (controls) {
    controls.enabled = false;
  }

  // Update Inventory Card UI to DRAGGING
  const card = document.querySelector(`.available-gear-card[data-teeth="${teeth}"]`);
  if (card) {
    card.classList.add('dragging');
    const statusEl = card.querySelector('.card-status');
    if (statusEl) statusEl.textContent = 'DRAGGING';
  }

  // Define 3D Drag Plane facing camera, passing through the midpoint between shafts
  const { shaftY, posZInput, posZOutput } = dragDropState.shaftPositions;
  const cameraDir = new THREE.Vector3();
  camera.getWorldDirection(cameraDir);
  const planeNormal = cameraDir.negate();
  const planePoint = new THREE.Vector3(0, shaftY, (posZInput + posZOutput) * 0.5);
  dragDropState.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, planePoint);

  // Create temporary 3D Gear Preview
  if (dragDropState.previewMesh) {
    scene.remove(dragDropState.previewMesh);
  }

  const preview = createSpurGear({
    teeth: teeth,
    module: GEAR_MODULE,
    thickness: 0.65,
    boreRadius: 0.45,
    color: 0x38bdf8, // Electric Cyan preview
    metalness: 0.50,
    roughness: 0.35,
  });

  // Make preview transparent & non-depth-writing
  preview.traverse((child) => {
    if (child.isMesh && child.material) {
      child.material = child.material.clone();
      child.material.transparent = true;
      child.material.opacity = 0.68;
      child.material.depthWrite = false;
    }
  });

  preview.position.copy(planePoint);
  scene.add(preview);
  dragDropState.previewMesh = preview;

  // Update immediately to current pointer position
  if (event) {
    updateGearDrag(event);
  }
}

/**
 * Updates 3D preview position and detects drop target collision.
 */
function updateGearDrag(event) {
  if (!dragDropState.isDragging || !dragDropState.previewMesh) return;

  const { camera, canvas, raycaster, mouseNDC, dragPlane, previewMesh } = dragDropState;
  if (!camera || !canvas) return;

  const clientX = event.clientX !== undefined ? event.clientX : event.touches?.[0]?.clientX;
  const clientY = event.clientY !== undefined ? event.clientY : event.touches?.[0]?.clientY;

  if (clientX === undefined || clientY === undefined) return;

  const rect = canvas.getBoundingClientRect();
  mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouseNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouseNDC, camera);

  // 1. Move preview gear along 3D drag plane
  const planeHit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
    previewMesh.position.copy(planeHit);
  }

  // 2. Raycast against dedicated drop targets
  const targets = [dragDropState.dropTargets.input, dragDropState.dropTargets.output].filter(Boolean);
  const hits = raycaster.intersectObjects(targets, false);

  let targetType = null;
  if (hits.length > 0) {
    targetType = hits[0].object.userData.targetType; // 'input' or 'output'
  }

  dragDropState.activeHoverTarget = targetType;

  // 3. Visual Feedback (Subtle green on valid shaft, subtle neutral/red on invalid)
  if (targetType === 'input') {
    if (dragDropState.haloMeshes.input?.userData?.setOpacity) {
      dragDropState.haloMeshes.input.userData.setOpacity(0.85);
    }
    if (dragDropState.haloMeshes.output?.userData?.setOpacity) {
      dragDropState.haloMeshes.output.userData.setOpacity(0.0);
    }
    setPreviewColor(previewMesh, 0x22c55e); // Green
  } else if (targetType === 'output') {
    if (dragDropState.haloMeshes.output?.userData?.setOpacity) {
      dragDropState.haloMeshes.output.userData.setOpacity(0.85);
    }
    if (dragDropState.haloMeshes.input?.userData?.setOpacity) {
      dragDropState.haloMeshes.input.userData.setOpacity(0.0);
    }
    setPreviewColor(previewMesh, 0x22c55e); // Green
  } else {
    // Neither shaft hovered: hide halos
    if (dragDropState.haloMeshes.input?.userData?.setOpacity) {
      dragDropState.haloMeshes.input.userData.setOpacity(0.0);
    }
    if (dragDropState.haloMeshes.output?.userData?.setOpacity) {
      dragDropState.haloMeshes.output.userData.setOpacity(0.0);
    }
    // Subtle neutral/invalid feedback
    setPreviewColor(previewMesh, 0x38bdf8);
  }
}

/**
 * Finishes gear drag and attempts placement.
 */
function finishGearDrag(event) {
  if (!dragDropState.isDragging) return;

  const { activeHoverTarget, draggedTeeth, callbacks } = dragDropState;

  if (activeHoverTarget === 'input') {
    // Valid drop onto Input Shaft!
    if (callbacks.onPlaceInput) {
      callbacks.onPlaceInput(draggedTeeth);
    }
  } else if (activeHoverTarget === 'output') {
    // Valid drop onto Output Shaft!
    if (callbacks.onPlaceOutput) {
      callbacks.onPlaceOutput(draggedTeeth);
    }
  } else {
    // Invalid drop (e.g. released over floor, outside casing)
    // Return gear to inventory!
    if (callbacks.onReturnToInventory) {
      callbacks.onReturnToInventory(draggedTeeth);
    } else {
      audio.playButtonClick();
    }
  }

  clearDragState();
}

/**
 * Returns gear to inventory and clears dragging state.
 */
function returnGearToInventory(teeth) {
  clearDragState();
}

/**
 * Resets drag state, disposes preview mesh, and hides visual highlights.
 */
function clearDragState() {
  const { scene, previewMesh, controls } = dragDropState;

  if (previewMesh && scene) {
    scene.remove(previewMesh);
    previewMesh.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
          else child.material.dispose();
        }
      }
    });
    dragDropState.previewMesh = null;
  }

  // Reset highlight halos
  if (dragDropState.haloMeshes.input?.userData?.setOpacity) {
    dragDropState.haloMeshes.input.userData.setOpacity(0.0);
  }
  if (dragDropState.haloMeshes.output?.userData?.setOpacity) {
    dragDropState.haloMeshes.output.userData.setOpacity(0.0);
  }

  // Re-enable OrbitControls
  if (controls) {
    controls.enabled = true;
  }

  // Remove dragging class from all cards
  document.querySelectorAll('.available-gear-card.dragging').forEach((card) => {
    card.classList.remove('dragging');
  });

  dragDropState.isDragging = false;
  dragDropState.draggedTeeth = null;
  dragDropState.activeHoverTarget = null;
}

/**
 * Helper to update preview gear tint color.
 */
function setPreviewColor(previewMesh, hexColor) {
  if (!previewMesh) return;
  previewMesh.traverse((child) => {
    if (child.isMesh && child.material && child.material.color) {
      child.material.color.setHex(hexColor);
    }
  });
}

/**
 * Initializes Drag & Drop event bindings for desktop mouse and mobile touch.
 */
function initDragDrop(options = {}) {
  const { scene, camera, controls, canvas, callbacks = {} } = options;
  dragDropState.scene = scene;
  dragDropState.camera = camera;
  dragDropState.controls = controls;
  dragDropState.canvas = canvas;
  dragDropState.callbacks = callbacks;

  // Create Drop Targets in scene
  createShaftDropTargets(
    scene,
    dragDropState.shaftPositions.shaftY,
    dragDropState.shaftPositions.posZInput,
    dragDropState.shaftPositions.posZOutput
  );

  // Desktop Mouse Drag Listeners on Gear Cards
  bindCardDragListeners();

  // Global Window Listeners for Move & Release
  window.addEventListener('mousemove', (e) => {
    if (dragDropState.isDragging) {
      updateGearDrag(e);
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (dragDropState.isDragging) {
      finishGearDrag(e);
    }
  });

  // Mobile / Tablet Touch Listeners
  window.addEventListener(
    'touchmove',
    (e) => {
      if (dragDropState.isDragging) {
        e.preventDefault(); // Prevent scrolling while dragging in 3D
        updateGearDrag(e);
      }
    },
    { passive: false }
  );

  window.addEventListener('touchend', (e) => {
    if (dragDropState.isDragging) {
      finishGearDrag(e);
    }
  });

  window.addEventListener('touchcancel', () => {
    if (dragDropState.isDragging) {
      clearDragState();
    }
  });
}

/**
 * Attaches pointerdown / touchstart listeners to available gear cards.
 */
function bindCardDragListeners() {
  document.querySelectorAll('.available-gear-card').forEach((card) => {
    // Avoid double binding
    if (card.dataset.dragBound) return;
    card.dataset.dragBound = 'true';

    let pointerDownPos = null;
    let isPendingDrag = false;

    // Mouse Down
    card.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Left click only
      const teeth = parseInt(card.getAttribute('data-teeth'), 10);
      if (!teeth) return;

      pointerDownPos = { x: e.clientX, y: e.clientY };
      isPendingDrag = true;

      const onMouseMoveWindow = (moveEvent) => {
        if (!isPendingDrag) return;
        const dx = moveEvent.clientX - pointerDownPos.x;
        const dy = moveEvent.clientY - pointerDownPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // If moved more than 5 pixels, trigger drag!
        if (dist > 5) {
          isPendingDrag = false;
          window.removeEventListener('mousemove', onMouseMoveWindow);
          window.removeEventListener('mouseup', onMouseUpWindow);
          startGearDrag(teeth, moveEvent);
        }
      };

      const onMouseUpWindow = () => {
        isPendingDrag = false;
        window.removeEventListener('mousemove', onMouseMoveWindow);
        window.removeEventListener('mouseup', onMouseUpWindow);
      };

      window.addEventListener('mousemove', onMouseMoveWindow);
      window.addEventListener('mouseup', onMouseUpWindow);
    });

    // Touch Start
    card.addEventListener(
      'touchstart',
      (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        const teeth = parseInt(card.getAttribute('data-teeth'), 10);
        if (!teeth) return;

        pointerDownPos = { x: touch.clientX, y: touch.clientY };
        isPendingDrag = true;

        const onTouchMoveWindow = (moveEvent) => {
          if (!isPendingDrag) return;
          const currentTouch = moveEvent.touches[0];
          if (!currentTouch) return;
          const dx = currentTouch.clientX - pointerDownPos.x;
          const dy = currentTouch.clientY - pointerDownPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 6) {
            isPendingDrag = false;
            moveEvent.preventDefault();
            window.removeEventListener('touchmove', onTouchMoveWindow);
            window.removeEventListener('touchend', onTouchEndWindow);
            startGearDrag(teeth, currentTouch);
          }
        };

        const onTouchEndWindow = () => {
          isPendingDrag = false;
          window.removeEventListener('touchmove', onTouchMoveWindow);
          window.removeEventListener('touchend', onTouchEndWindow);
        };

        window.addEventListener('touchmove', onTouchMoveWindow, { passive: false });
        window.addEventListener('touchend', onTouchEndWindow);
      },
      { passive: true }
    );
  });
}
// --- End: src/drag-drop.js ---

// --- Begin: src/tutorial.js ---
/**
 * Gear Factory 3D — Tutorial Subsystem (Phase 7)
 *
 * Requirements:
 * - 6-step interactive real drag-and-drop tutorial
 * - Does not count as a normal level, does not affect level unlocks
 * - Step 1: Motor highlight & explanation
 * - Step 2: Select gear from inventory
 * - Step 3: Drag gear to Input Shaft
 * - Step 4: Select and drag gear to Output Shaft
 * - Step 5: Watch kinetics & speed ratio formula
 * - Step 6: Press Check Solution
 * - Completion screen with [ PLAY LEVEL 1 ] and [ MAIN MENU ]
 * - [ SKIP ] button on every step leading directly to Level 1
 * - Persistent tutorialCompleted in localStorage
 */

const TUTORIAL_STORAGE_KEY = 'tutorialCompleted';

const tutorialState = {
  isActive: false,
  currentStep: 0,
  callbacks: {},
};

function isTutorialCompleted() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
}

function setTutorialCompleted() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }
}

function resetTutorialState() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  }
}

/**
 * Initializes tutorial controller with app callbacks.
 */
function initTutorial(callbacks = {}) {
  tutorialState.callbacks = callbacks;
}

/**
 * Starts Tutorial from Step 0 (Intro).
 */
function startTutorial() {
  tutorialState.isActive = true;
  tutorialState.currentStep = 0;
  showTutorialStep(0);
}

/**
 * Advances tutorial to specified or next step.
 */
function setTutorialStep(stepNumber) {
  if (!tutorialState.isActive) return;
  tutorialState.currentStep = stepNumber;
  showTutorialStep(stepNumber);
}

function nextTutorialStep() {
  if (!tutorialState.isActive) return;
  setTutorialStep(tutorialState.currentStep + 1);
}

/**
 * Skips the tutorial and transitions directly to Level 1.
 */
function skipTutorial() {
  tutorialState.isActive = false;
  hideAllTutorialUI();
  if (tutorialState.callbacks.onSkip) {
    tutorialState.callbacks.onSkip();
  }
}

/**
 * Completes the tutorial, records persistence, and displays completion UI.
 */
function completeTutorial() {
  tutorialState.isActive = false;
  setTutorialCompleted();
  hideAllTutorialUI();
  showTutorialCompletionUI();
}

/**
 * Displays UI for the active tutorial step.
 */
function showTutorialStep(step) {
  const banner = document.getElementById('tutorial-dock');
  const modal = document.getElementById('tutorial-modal');
  if (!banner && !modal) return;

  // Clear existing step highlights
  clearTutorialHighlights();

  switch (step) {
    case 0: {
      // Step 0: Tutorial Introduction
      if (modal) {
        modal.style.display = 'flex';
        modal.innerHTML = `
          <div class="tutorial-card">
            <div class="modal-eyebrow">WORKSHOP TUTORIAL</div>
            <h2 class="modal-title">HOW GEARS WORK</h2>
            <p class="tutorial-desc">Learn how mechanical gears work in simple visual steps.</p>
            <div class="tutorial-goal-box">
              <span class="goal-label">YOUR GOAL:</span>
              <span class="goal-text">Connect the gears to match the <strong>TARGET SPEED</strong> and run the machine.</span>
            </div>
            <div class="tutorial-btn-row">
              <button type="button" class="btn-primary" id="btn-tut-start">START TUTORIAL</button>
              <button type="button" class="btn-secondary" id="btn-tut-skip-intro">SKIP</button>
            </div>
          </div>
        `;
        document.getElementById('btn-tut-start')?.addEventListener('click', () => {
          modal.style.display = 'none';
          if (tutorialState.callbacks.onSetupTutorialScene) {
            tutorialState.callbacks.onSetupTutorialScene();
          }
          setTutorialStep(1);
        });
        document.getElementById('btn-tut-skip-intro')?.addEventListener('click', () => skipTutorial());
      }
      break;
    }

    case 1: {
      // Step 1: Motor Explanation (Concept 1)
      if (modal) modal.style.display = 'none';
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 1 OF 6</span>
            <span class="tut-step-title">1. The Electric Motor</span>
          </div>
          <p class="tut-step-text">The electric motor powers the machine at a steady speed (e.g. <strong>1000 RPM</strong>). It turns the motor shaft continuously.</p>
          <div class="tut-actions">
            <button type="button" class="btn-tut-action btn-tut-next" id="btn-tut-step1-next">NEXT ➔</button>
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-1">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-step1-next')?.addEventListener('click', () => nextTutorialStep());
        document.getElementById('btn-tut-skip-1')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#telemetry-motor-rpm', 'tut-highlight-pulse');
      break;
    }

    case 2: {
      // Step 2: Choose Motor Gear (Concept 2)
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 2 OF 6</span>
            <span class="tut-step-title">2. Choose a Gear</span>
          </div>
          <p class="tut-step-text">Select a gear from your inventory (e.g. <strong>20T</strong>). The number of teeth determines how big or small the gear is.</p>
          <div class="tut-actions">
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-2">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-skip-2')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#available-gears-list', 'tut-highlight-pulse');
      break;
    }

    case 3: {
      // Step 3: Drag Gear to Motor Shaft (Concept 3)
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 3 OF 6</span>
            <span class="tut-step-title">3. Place on Motor Shaft</span>
          </div>
          <p class="tut-step-text">Drag the gear into the machine and place it onto the <strong>MOTOR SHAFT</strong> (or click the Motor Gear slot card).</p>
          <div class="tut-guide-animation">
            <span class="tut-guide-chip">⚙ Selected Gear</span>
            <span class="tut-guide-arrow">➔</span>
            <span class="tut-guide-target">Motor Shaft</span>
          </div>
          <div class="tut-actions">
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-3">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-skip-3')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#input-shaft-slot', 'tut-highlight-pulse');
      break;
    }

    case 4: {
      // Step 4: Machine Gear (Concept 4)
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 4 OF 6</span>
            <span class="tut-step-title">4. Connect Machine Gear</span>
          </div>
          <p class="tut-step-text">Now select another gear (e.g. <strong>40T</strong>) and drag it to the <strong>MACHINE SHAFT</strong> to mesh them together.</p>
          <div class="tut-actions">
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-4">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-skip-4')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#output-shaft-slot', 'tut-highlight-pulse');
      break;
    }

    case 5: {
      // Step 5: Rotation & Speed (Concepts 5, 6, 7)
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 5 OF 6</span>
            <span class="tut-step-title">5. Gears in Motion</span>
          </div>
          <p class="tut-step-text">The gears are touching! They turn in opposite directions. Big gears turn slower, and small gears turn faster.</p>
          <div class="tut-formula-box">
            <code>Small Gear ➔ Faster Speed &nbsp;•&nbsp; Big Gear ➔ Slower Speed</code>
          </div>
          <div class="tut-actions">
            <button type="button" class="btn-tut-action btn-tut-next" id="btn-tut-step5-next">NEXT ➔</button>
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-5">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-step5-next')?.addEventListener('click', () => nextTutorialStep());
        document.getElementById('btn-tut-skip-5')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#realtime-rpm-panel', 'tut-highlight-pulse');
      break;
    }

    case 6: {
      // Step 6: Check Solution (Concept 8)
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 6 OF 6</span>
            <span class="tut-step-title">6. Check Solution</span>
          </div>
          <p class="tut-step-text">Click <strong>CHECK SOLUTION</strong> to see if your machine speed matches the target speed!</p>
          <div class="tut-actions">
            <button type="button" class="btn-tut-skip" id="btn-tut-skip-6">SKIP</button>
          </div>
        `;
        document.getElementById('btn-tut-skip-6')?.addEventListener('click', () => skipTutorial());
      }
      highlightElement('#btn-check-solution', 'tut-highlight-pulse');
      break;
    }

    default:
      break;
  }
}

/**
 * Displays the Tutorial Completion screen.
 */
function showTutorialCompletionUI() {
  const modal = document.getElementById('tutorial-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.innerHTML = `
    <div class="tutorial-card completion-card">
      <div class="tut-complete-icon">✓</div>
      <div class="modal-eyebrow">TRAINING FINISHED</div>
      <h2 class="modal-title">TUTORIAL COMPLETE</h2>
      <p class="tutorial-desc">You're ready to build your first industrial gearbox!</p>
      <div class="tutorial-btn-row">
        <button type="button" class="btn-primary" id="btn-tut-play-level-1">PLAY LEVEL 1</button>
        <button type="button" class="btn-secondary" id="btn-tut-main-menu">MAIN MENU</button>
      </div>
    </div>
  `;

  document.getElementById('btn-tut-play-level-1')?.addEventListener('click', () => {
    modal.style.display = 'none';
    if (tutorialState.callbacks.onPlayLevel1) {
      tutorialState.callbacks.onPlayLevel1();
    }
  });

  document.getElementById('btn-tut-main-menu')?.addEventListener('click', () => {
    modal.style.display = 'none';
    if (tutorialState.callbacks.onOpenMainMenu) {
      tutorialState.callbacks.onOpenMainMenu();
    }
  });
}

function clearTutorialHighlights() {
  document.querySelectorAll('.tut-highlight-pulse').forEach((el) => {
    el.classList.remove('tut-highlight-pulse');
  });
}

function highlightElement(selector, className) {
  const el = document.querySelector(selector);
  if (el) el.classList.add(className);
}

function hideAllTutorialUI() {
  clearTutorialHighlights();
  const banner = document.getElementById('tutorial-dock');
  const modal = document.getElementById('tutorial-modal');
  if (banner) banner.style.display = 'none';
  if (modal) modal.style.display = 'none';
}
// --- End: src/tutorial.js ---

// --- Begin: src/main.js ---
/**
 * Gear Factory 3D — Application Coordinator & Entry Point
 *
 * Modular Architecture:
 * - scene.js: Three.js scene & WebGLRenderer
 * - camera.js: Perspective camera & viewpoints
 * - lighting.js: Studio key, rim, ambient lights & shadows
 * - controls.js: OrbitControls damping & navigation
 * - gearbox.js: Industrial casing & 3D gear train assembly
 * - gears.js: Procedural involute spur gears
 * - motor.js: Industrial electric motor
 * - shafts.js: Transmission shafts
 * - bearings.js: Ball bearings & pillow block supports
 * - levels.js: Challenge levels & solution rules
 * - game-state.js: Simulation state & mechanical calculations
 * - ui.js: Tactile inventory cards & verification HUD
 * - audio.js: Web Audio procedural sound engine
 */


/* ==========================================================================
   1. Initialization & Assembly Setup
   ========================================================================== */
const canvas = document.getElementById('webgl-canvas');
const container = document.getElementById('three-container');

const initWidth = container && container.clientWidth > 0 ? container.clientWidth : 800;
const initHeight = container && container.clientHeight > 0 ? container.clientHeight : 500;

const renderer = initRenderer(canvas, initWidth, initHeight);
updateCameraAspect(initWidth, initHeight);

// Lighting & OrbitControls
setupLighting(scene);
const controls = initControls(camera, renderer.domElement);

// Ensure camera is cleanly framed on the complete industrial machine
camera.position.copy(defaultCameraPos);
controls.target.copy(defaultTargetPos);
controls.update();

// Assembly reference holder
let currentAssembly = {};
let isLabelsVisible = false;

/**
 * Rebuilds the 3D gear train based on player gear selection.
 */
function refreshAssembly() {
  currentAssembly = buildGearTrain(
    scene,
    state,
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    currentAssembly
  );

  if (currentAssembly.labelsGroup) {
    currentAssembly.labelsGroup.visible = isLabelsVisible;
  }

  // Phase 11: Direction Arrow Visibility
  const currentLvl = getLevel(puzzleState.currentLevel);
  const showArrows = isLabelsVisible || (currentLvl && (currentLvl.showDirectionArrows || currentLvl.level === 4));
  if (currentAssembly.inputDirectionArrow) {
    currentAssembly.inputDirectionArrow.visible = !!(showArrows && puzzleState.selectedInputTeeth);
  }
  if (currentAssembly.outputDirectionArrow) {
    currentAssembly.outputDirectionArrow.visible = !!(showArrows && puzzleState.selectedOutputTeeth);
  }

  // Phase 5: Update 3D drag drop target positions
  if (currentAssembly.shaftY !== undefined) {
    updateDropTargetPositions(
      currentAssembly.shaftY,
      currentAssembly.posZInput,
      currentAssembly.posZOutput
    );
  }
}

/* ==========================================================================
   2. Rotational Kinetics & Gear Transmission (Phase 3)
   ========================================================================== */
const kinetics = {
  motorRPM: 990.0,
  inputRPM: 0.0,
  outputRPM: 0.0,
  motorOmega: (990.0 * 2.0 * Math.PI) / 60.0,
  inputOmega: 0.0,
  outputOmega: 0.0,
  motorAngle: 0.0,
  inputAngle: 0.0,
  outputAngle: 0.0,
  isEngaged: false,
};

function recalculateKinetics() {
  const motorRPM = state.targetInputRPM || 990.0;
  kinetics.motorRPM = motorRPM;
  kinetics.motorOmega = (motorRPM * 2.0 * Math.PI) / 60.0;

  const hasInput = !!puzzleState.selectedInputTeeth;
  const hasOutput = !!puzzleState.selectedOutputTeeth;
  const hasBothGears = hasInput && hasOutput;
  kinetics.isEngaged = hasBothGears;

  if (hasBothGears) {
    kinetics.inputRPM = motorRPM;
    kinetics.inputOmega = (kinetics.inputRPM * 2.0 * Math.PI) / 60.0;

    kinetics.outputRPM = (kinetics.inputRPM * puzzleState.selectedInputTeeth) / puzzleState.selectedOutputTeeth;
    kinetics.outputOmega = (kinetics.outputRPM * 2.0 * Math.PI) / 60.0;
  } else if (hasInput) {
    // Input gear is mounted and rotating with motor; output gear missing/disengaged
    kinetics.inputRPM = motorRPM;
    kinetics.inputOmega = (kinetics.inputRPM * 2.0 * Math.PI) / 60.0;
    kinetics.outputRPM = 0.0;
    kinetics.outputOmega = 0.0;
  } else {
    // No input gear: input shaft remains stationary
    kinetics.inputRPM = 0.0;
    kinetics.inputOmega = 0.0;
    kinetics.outputRPM = 0.0;
    kinetics.outputOmega = 0.0;
  }

  // Synchronize state for HUD speedometer
  state.currentInputRPM = kinetics.inputRPM;
  state.currentOutputRPM = kinetics.outputRPM;

  // Section 15: Debugging console information
  console.log('--- [GearFactory3D Kinetics Debug] ---');
  console.log(`Input RPM: ${kinetics.inputRPM.toFixed(1)}`);
  console.log(`Output RPM: ${kinetics.outputRPM.toFixed(1)}`);
  console.log(`Input Teeth: ${puzzleState.selectedInputTeeth || 'None'}`);
  console.log(`Output Teeth: ${puzzleState.selectedOutputTeeth || 'None'}`);
  console.log(`Input Angular Velocity: ${kinetics.inputOmega.toFixed(4)} rad/s`);
  console.log(`Output Angular Velocity: ${kinetics.outputOmega.toFixed(4)} rad/s`);

  // Section 9: Real-time RPM display outside 3D canvas
  updateRealtimeRPMUI(kinetics.motorRPM, kinetics.inputRPM, kinetics.outputRPM, kinetics.isEngaged);
}

/* ==========================================================================
   2a. Mechanical Engagement & Contact Check (Phase 6)
   ========================================================================== */

const engagementState = {
  active: false,
  startTime: 0,
  duration: 0.28, // seconds (approx 280ms)
  targetMesh: null,
  startOffsetX: 0.40,
};

function triggerMechanicalEngagement(targetMesh) {
  if (!targetMesh) return;
  engagementState.active = true;
  engagementState.startTime = performance.now();
  engagementState.targetMesh = targetMesh;
  engagementState.startOffsetX = 0.40;
  targetMesh.position.x = 0.40;

  if (currentAssembly.engagementContactFlash) {
    currentAssembly.engagementContactFlash.material.opacity = 0.75;
  }
}

/**
 * Phase 6: Gear Contact and Meshing Verification
 * Checks whether gears are mounted, aligned, and contact at theoretical pitch distance.
 */
function checkGearMesh() {
  const hasInput = !!(puzzleState.selectedInputTeeth && currentAssembly.inputGear);
  const hasOutput = !!(puzzleState.selectedOutputTeeth && currentAssembly.outputGear);

  if (!hasInput || !hasOutput) {
    return {
      gearMeshValid: false,
      reason: !hasInput && !hasOutput ? 'NO_GEARS' : (!hasInput ? 'MISSING_INPUT' : 'MISSING_OUTPUT'),
      inputTeeth: puzzleState.selectedInputTeeth,
      outputTeeth: puzzleState.selectedOutputTeeth,
    };
  }

  const inPos = currentAssembly.inputGear.position;
  const outPos = currentAssembly.outputGear.position;

  // Verify alignment: faces aligned on X axis (accounting for active slide animation), shafts at same elevation Y
  const inX = (engagementState.active && engagementState.targetMesh === currentAssembly.inputGear) ? 0.0 : inPos.x;
  const outX = (engagementState.active && engagementState.targetMesh === currentAssembly.outputGear) ? 0.0 : outPos.x;
  const faceAligned = Math.abs(inX - outX) < 0.05;
  const elevationAligned = Math.abs(inPos.y - outPos.y) < 0.01;
  const actualCenterDist = Math.abs(outPos.z - inPos.z);

  const inDim = calculateGearOuterRadius(puzzleState.selectedInputTeeth, GEAR_MODULE);
  const outDim = calculateGearOuterRadius(puzzleState.selectedOutputTeeth, GEAR_MODULE);
  const expectedPitchDist = inDim.pitchRadius + outDim.pitchRadius;

  const distTolerance = 0.08;
  const centerDistanceValid = Math.abs(actualCenterDist - expectedPitchDist) < distTolerance;

  const gearMeshValid = faceAligned && elevationAligned && centerDistanceValid;

  return {
    gearMeshValid,
    inputTeeth: puzzleState.selectedInputTeeth,
    outputTeeth: puzzleState.selectedOutputTeeth,
    centerDistance: Number(actualCenterDist.toFixed(4)),
    expectedCenterDistance: Number(expectedPitchDist.toFixed(4)),
    faceAligned,
    elevationAligned,
    centerDistanceValid,
  };
}

/* ==========================================================================
   2b. Game & Level Actions
   ========================================================================== */

function setRunningState(running) {
  state.isRunning = !!running;
  setRunningStateUI(state.isRunning);
  if (state.isRunning) {
    audio.playMotorStart();
  } else {
    audio.playMotorStop();
  }
}

function pauseGame() {
  state.isPaused = true;
  openPauseModal();
}

function resumeGame() {
  state.isPaused = false;
  closePauseModal();
}

function replayCurrentLevel() {
  clearDragState();
  audio.playGearClear();
  puzzleState.selectedInventoryGear = null;
  puzzleState.selectedInputTeeth = null;
  puzzleState.selectedOutputTeeth = null;
  puzzleState.hasCheckedSolution = false;
  puzzleState.lastCalculatedRPM = null;
  puzzleState.isSolutionPass = false;

  kinetics.inputAngle = 0;
  kinetics.outputAngle = 0;
  state.inputAngle = 0;
  state.outputAngle = 0;
  state.currentInputRPM = 0;
  state.currentOutputRPM = 0;

  state.levelTimeSeconds = 0;
  updateTimerDisplay(0);
  state.levelInProgress = true;

  onSelectionChanged();
}

function openLevelSelect() {
  audio.playButtonClick();
  renderLevelSelectModal(
    levelData,
    getCompletedLevels(),
    getHighestUnlockedLevel(),
    puzzleState.currentLevel,
    (lvl) => loadLevel(lvl)
  );
  openLevelSelectModal();
}

function loadLevel(levelNumber, skipIntro = false) {
  clearDragState();
  if (!isLevelUnlocked(levelNumber)) {
    levelNumber = getNextIncompleteLevel();
  }
  const level = getLevel(levelNumber);
  if (!level) return;

  puzzleState.currentLevel = levelNumber;
  state.targetInputRPM = level.motorRPM || level.inputRPM;
  state.targetOutputRPM = level.targetRPM;
  puzzleState.requireSeparateGears = level.requireSeparateGears !== false;

  // Reset Level Timer
  state.levelTimeSeconds = 0;
  updateTimerDisplay(0);

  if (skipIntro) {
    state.levelInProgress = true;
    closeLevelIntro();
  } else {
    state.levelInProgress = false;
    showLevelIntro(level, () => {
      state.levelInProgress = true;
    });
  }

  // Render level-specific available gears
  renderAvailableGears(level.availableGears || [10, 20, 30, 40, 50, 60]);

  // Phase 2: Start with empty placement slots (no gears pre-mounted)
  puzzleState.selectedInventoryGear = null;
  puzzleState.selectedInputTeeth = null;
  puzzleState.selectedOutputTeeth = null;
  puzzleState.hasCheckedSolution = false;
  puzzleState.lastCalculatedRPM = null;
  puzzleState.isSolutionPass = false;

  updateLevelObjectiveUI(
    level.level,
    getTotalLevels(),
    level.motorRPM || level.inputRPM,
    level.targetRPM,
    level.difficulty,
    level.objective,
    level.visualHint
  );

  // Phase 11: Initialize contextual hint for this level
  updateContextualHintUI(getContextualHint({
    level: level.level,
    hasInput: !!puzzleState.selectedInputTeeth,
    hasOutput: !!puzzleState.selectedOutputTeeth,
    targetRPM: level.targetRPM,
  }));

  updateSelectedGearsUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    puzzleState.selectedInventoryGear,
    puzzleState.requireSeparateGears
  );
  updateVerificationUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    level.targetRPM,
    null,
    false,
    false
  );
  setPuzzleStatusUI('PLACE INPUT AND OUTPUT GEARS', 'pending');
  hideBanners();

  if (elements.btnNextLevel) {
    elements.btnNextLevel.disabled = levelNumber >= getTotalLevels() || !isLevelUnlocked(levelNumber + 1);
  }
  if (elements.btnHeaderNextLevel) {
    elements.btnHeaderNextLevel.disabled = levelNumber >= getTotalLevels() || !isLevelUnlocked(levelNumber + 1);
  }

  refreshAssembly();
  recalculateKinetics();
}

function resetLevel() {
  clearDragState();
  audio.playGearClear();
  puzzleState.selectedInventoryGear = null;
  puzzleState.selectedInputTeeth = null;
  puzzleState.selectedOutputTeeth = null;
  puzzleState.hasCheckedSolution = false;
  puzzleState.lastCalculatedRPM = null;
  puzzleState.isSolutionPass = false;

  kinetics.inputAngle = 0;
  kinetics.outputAngle = 0;
  state.inputAngle = 0;
  state.outputAngle = 0;
  state.currentInputRPM = 0;
  state.currentOutputRPM = 0;

  onSelectionChanged();
}

function selectGear(teeth) {
  if (puzzleState.selectedInventoryGear === teeth) {
    puzzleState.selectedInventoryGear = null;
  } else {
    puzzleState.selectedInventoryGear = teeth;
  }
  audio.playButtonClick();
  updateSelectedGearsUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    puzzleState.selectedInventoryGear,
    puzzleState.requireSeparateGears
  );

  // Tutorial Step 2 progression
  if (tutorialState.isActive && tutorialState.currentStep === 2 && puzzleState.selectedInventoryGear) {
    setTutorialStep(3);
  }
}

function placeGearOnInput(teeth) {
  placeInputGear(teeth);
}

function placeGearOnOutput(teeth) {
  placeOutputGear(teeth);
}

function placeInputGear(teeth) {
  const targetTeeth = teeth || puzzleState.selectedInventoryGear;
  if (!targetTeeth) {
    setPuzzleStatusUI('SELECT GEAR FIRST', 'pending');
    showFailBanner('Please select an available gear from inventory first!');
    audio.playError();
    return;
  }

  // Duplicate physical gear prevention
  if (puzzleState.requireSeparateGears && puzzleState.selectedOutputTeeth === targetTeeth) {
    puzzleState.selectedOutputTeeth = null;
  }

  const wasOutputPresent = !!puzzleState.selectedOutputTeeth;
  puzzleState.selectedInputTeeth = targetTeeth;
  puzzleState.selectedInventoryGear = null; // Clear inventory selection upon placement
  audio.playGearMount();
  onSelectionChanged();

  // Tutorial Step 3 progression
  if (tutorialState.isActive && tutorialState.currentStep === 3) {
    setTutorialStep(4);
  }

  // Phase 6: Mechanical engagement animation when completing the gear train
  if (wasOutputPresent && currentAssembly.inputGear) {
    triggerMechanicalEngagement(currentAssembly.inputGear);
  }
}

function placeOutputGear(teeth) {
  const targetTeeth = teeth || puzzleState.selectedInventoryGear;
  if (!targetTeeth) {
    setPuzzleStatusUI('SELECT GEAR FIRST', 'pending');
    showFailBanner('Please select an available gear from inventory first!');
    audio.playError();
    return;
  }

  // Duplicate physical gear prevention
  if (puzzleState.requireSeparateGears && puzzleState.selectedInputTeeth === targetTeeth) {
    puzzleState.selectedInputTeeth = null;
  }

  const wasInputPresent = !!puzzleState.selectedInputTeeth;
  puzzleState.selectedOutputTeeth = targetTeeth;
  puzzleState.selectedInventoryGear = null; // Clear inventory selection upon placement
  audio.playGearMount();
  onSelectionChanged();

  // Tutorial Step 4 progression
  if (tutorialState.isActive && tutorialState.currentStep === 4) {
    setTutorialStep(5);
  }

  // Phase 6: Mechanical engagement animation when completing the gear train
  if (wasInputPresent && currentAssembly.outputGear) {
    triggerMechanicalEngagement(currentAssembly.outputGear);
  }
}

function clearInputGear() {
  puzzleState.selectedInputTeeth = null;
  audio.playGearClear();
  onSelectionChanged();
}

function clearOutputGear() {
  puzzleState.selectedOutputTeeth = null;
  audio.playGearClear();
  onSelectionChanged();
}

function clearSelection() {
  puzzleState.selectedInputTeeth = null;
  puzzleState.selectedOutputTeeth = null;
  puzzleState.selectedInventoryGear = null;
  audio.playGearClear();
  onSelectionChanged();
}

function onSelectionChanged() {
  updateSelectedGearsUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    puzzleState.selectedInventoryGear,
    puzzleState.requireSeparateGears
  );

  if (puzzleState.selectedInputTeeth && puzzleState.selectedOutputTeeth) {
    state.inputTeeth = puzzleState.selectedInputTeeth;
    state.outputTeeth = puzzleState.selectedOutputTeeth;
    state.gearRatio = calculateGearRatio(puzzleState.selectedOutputTeeth, puzzleState.selectedInputTeeth);
    state.targetOutputRPM = calculateOutputRPM(state.targetInputRPM, puzzleState.selectedInputTeeth, puzzleState.selectedOutputTeeth);
  } else {
    state.targetOutputRPM = 0.0;
  }

  // Strictly conceal calculated RPM before Check Solution!
  puzzleState.hasCheckedSolution = false;
  puzzleState.lastCalculatedRPM = null;
  puzzleState.isSolutionPass = false;

  const level = getLevel(puzzleState.currentLevel);
  updateVerificationUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    level ? level.targetRPM : 495,
    null,
    false,
    false
  );

  // Phase 11: Dynamic contextual hint update upon gear mounting / dismounting
  if (level) {
    updateContextualHintUI(getContextualHint({
      level: level.level,
      hasInput: !!puzzleState.selectedInputTeeth,
      hasOutput: !!puzzleState.selectedOutputTeeth,
      inputTeeth: puzzleState.selectedInputTeeth,
      outputTeeth: puzzleState.selectedOutputTeeth,
      targetRPM: level.targetRPM,
      calculatedRPM: puzzleState.lastCalculatedRPM,
      isCorrect: puzzleState.isSolutionPass,
      hasChecked: puzzleState.hasCheckedSolution,
    }));
  }

  hideBanners();

  if (!puzzleState.selectedInputTeeth && !puzzleState.selectedOutputTeeth) {
    setPuzzleStatusUI('PLACE INPUT AND OUTPUT GEARS', 'pending');
  } else if (!puzzleState.selectedInputTeeth || !puzzleState.selectedOutputTeeth) {
    setPuzzleStatusUI('WAITING FOR SECOND GEAR', 'pending');
  } else {
    setPuzzleStatusUI('GEARS ENGAGED', 'engaged');
  }

  if (elements.btnNextLevel) elements.btnNextLevel.disabled = true;
  if (elements.btnHeaderNextLevel) elements.btnHeaderNextLevel.disabled = true;

  refreshAssembly();
  recalculateKinetics();
}

function checkPuzzleSolution(isUserClick = true) {
  const result = checkLevelSolution(
    puzzleState.currentLevel,
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth
  );

  if (!puzzleState.selectedInputTeeth || !puzzleState.selectedOutputTeeth) {
    setPuzzleStatusUI('SELECT GEARS', 'pending');
    showFailBanner('Please place both an Input gear and an Output gear before checking.');
    audio.playError();
    return false;
  }

  puzzleState.hasCheckedSolution = true;
  puzzleState.lastCalculatedRPM = result.calculatedRPM;
  puzzleState.isSolutionPass = result.isCorrect;

  updateVerificationUI(
    puzzleState.selectedInputTeeth,
    puzzleState.selectedOutputTeeth,
    result.targetRPM,
    result.calculatedRPM,
    true,
    result.isCorrect
  );

  if (result.isCorrect) {
    state.levelInProgress = false;
    const timeFormatted = formatTimer(state.levelTimeSeconds);
    setLevelCompleted(puzzleState.currentLevel);
    setPuzzleStatusUI('LEVEL COMPLETE', 'complete');
    const isFinalLevel = puzzleState.currentLevel >= getTotalLevels();
    if (elements.btnNextLevel) elements.btnNextLevel.disabled = isFinalLevel;
    if (elements.btnHeaderNextLevel) elements.btnHeaderNextLevel.disabled = isFinalLevel;
    showSuccessBanner(
      isFinalLevel
        ? `GRANDMASTER COMPLETE: Gears connected! Machine running perfectly at ${result.calculatedRPM.toFixed(1)} RPM!`
        : `GEARS CONNECTED! Machine running at target speed: ${result.calculatedRPM.toFixed(1)} RPM!`
    );
    audio.playSuccess();

    // Phase 11: Update hint to celebrate
    const level = getLevel(puzzleState.currentLevel);
    if (level) {
      updateContextualHintUI(getContextualHint({
        level: level.level,
        hasInput: !!puzzleState.selectedInputTeeth,
        hasOutput: !!puzzleState.selectedOutputTeeth,
        inputTeeth: puzzleState.selectedInputTeeth,
        outputTeeth: puzzleState.selectedOutputTeeth,
        targetRPM: level.targetRPM,
        calculatedRPM: result.calculatedRPM,
        isCorrect: true,
        hasChecked: true,
      }));
    }

    // Check if in tutorial step 6
    if (tutorialState.isActive && tutorialState.currentStep === 6) {
      completeTutorial();
    } else {
      showLevelComplete(
        result.targetRPM,
        result.calculatedRPM,
        timeFormatted,
        {
          onNext: () => nextLevel(),
          onLevelSelect: () => openLevelSelect(),
          onReplay: () => replayCurrentLevel(),
        },
        isFinalLevel
      );
    }
  } else {
    setPuzzleStatusUI('TRY AGAIN', 'try-again');
    if (elements.btnNextLevel) {
      elements.btnNextLevel.disabled = puzzleState.currentLevel >= getTotalLevels() || !isLevelUnlocked(puzzleState.currentLevel + 1);
    }
    if (elements.btnHeaderNextLevel) {
      elements.btnHeaderNextLevel.disabled = puzzleState.currentLevel >= getTotalLevels() || !isLevelUnlocked(puzzleState.currentLevel + 1);
    }
    const speedDiffText = result.calculatedRPM > result.targetRPM
      ? 'Machine turns too fast! Try a larger machine gear or smaller motor gear.'
      : 'Machine turns too slow! Try a smaller machine gear or larger motor gear.';
    showFailBanner(`Not quite! ${speedDiffText}`);
    audio.playError();

    // Phase 11: Non-harsh contextual coaching hint
    const level = getLevel(puzzleState.currentLevel);
    if (level) {
      updateContextualHintUI(getContextualHint({
        level: level.level,
        hasInput: !!puzzleState.selectedInputTeeth,
        hasOutput: !!puzzleState.selectedOutputTeeth,
        inputTeeth: puzzleState.selectedInputTeeth,
        outputTeeth: puzzleState.selectedOutputTeeth,
        targetRPM: level.targetRPM,
        calculatedRPM: result.calculatedRPM,
        isCorrect: false,
        hasChecked: true,
      }));
    }
  }

  return result.isCorrect;
}

function completeLevel() {
  if (puzzleState.currentLevel < getTotalLevels()) {
    nextLevel();
  }
}

function nextLevel() {
  if (puzzleState.currentLevel < getTotalLevels()) {
    audio.playButtonClick();
    loadLevel(puzzleState.currentLevel + 1);
  }
}

function prevLevel() {
  if (puzzleState.currentLevel > 1) {
    audio.playButtonClick();
    loadLevel(puzzleState.currentLevel - 1);
  }
}

function toggleLabels() {
  isLabelsVisible = !isLabelsVisible;
  if (currentAssembly.labelsGroup) {
    currentAssembly.labelsGroup.visible = isLabelsVisible;
  }
  setLabelToggleUI(isLabelsVisible);
}

/* ==========================================================================
   3. UI Event Binding & 3D Interactive Raycasting
   ========================================================================== */
initTutorial({
  onSetupTutorialScene: () => {
    loadLevel(1, true);
  },
  onSkip: () => {
    loadLevel(1, false);
  },
  onPlayLevel1: () => {
    loadLevel(1, false);
  },
  onOpenMainMenu: () => {
    openMainMenu();
  },
});

initUI({
  onStart: () => setRunningState(true),
  onStop: () => setRunningState(false),
  onReset: () => resetLevel(),
  onCheckSolution: () => checkPuzzleSolution(true),
  onResetLevel: () => resetLevel(),
  onPrevLevel: () => prevLevel(),
  onNextLevel: () => nextLevel(),
  onClearSelection: () => clearSelection(),
  onCameraReset: () => resetCamera(controls),
  onToggleLabels: () => toggleLabels(),
  onSelectGear: (teeth) => selectGear(teeth),
  onPlaceInputGear: () => placeInputGear(),
  onPlaceOutputGear: () => placeOutputGear(),
  onClearInputGear: () => clearInputGear(),
  onClearOutputGear: () => clearOutputGear(),
  onSelectInputGear: (teeth) => placeInputGear(teeth),
  onSelectOutputGear: (teeth) => placeOutputGear(teeth),
  onPlayNext: () => {
    audio.playButtonClick();
    closeMainMenu();
    loadLevel(getNextIncompleteLevel());
  },
  onOpenLevelSelect: () => openLevelSelect(),
  onOpenTutorial: () => {
    audio.playButtonClick();
    closeMainMenu();
    openHowGearsModal();
  },
  onOpenRpmInfo: () => {
    audio.playButtonClick();
    openRpmInfoModal();
  },
  onWelcomeStart: () => {
    audio.playButtonClick();
    loadLevel(1, false);
  },
  onTogglePause: () => {
    if (state.isPaused) resumeGame();
    else pauseGame();
  },
  onOpenMainMenu: () => {
    audio.playButtonClick();
    openMainMenu();
  },
  onResume: () => resumeGame(),
  onPauseReset: () => {
    resumeGame();
    resetLevel();
  },
  onPauseLevelSelect: () => {
    resumeGame();
    openLevelSelect();
  },
  onPauseMainMenu: () => {
    resumeGame();
    openMainMenu();
  },
  onOpenSettings: () => {
    audio.playButtonClick();
    updateSettingsUI(audio.isSoundEnabled(), audio.isMusicEnabled());
    openSettingsModal();
  },
  onToggleSound: () => {
    const s = audio.toggleSound();
    updateSettingsUI(s, audio.isMusicEnabled());
  },
  onToggleMusic: () => {
    const m = audio.toggleMusic();
    updateSettingsUI(audio.isSoundEnabled(), m);
  },
});

// Interactive 3D Canvas Click Placement
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

if (canvas) {
  canvas.addEventListener('click', (event) => {
    if (state.isPaused) return;
    if (!puzzleState.selectedInventoryGear) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const targets = [];
    if (currentAssembly.inputSlotMarker) targets.push(currentAssembly.inputSlotMarker);
    if (currentAssembly.inputShaft) targets.push(currentAssembly.inputShaft);
    if (currentAssembly.outputSlotMarker) targets.push(currentAssembly.outputSlotMarker);
    if (currentAssembly.outputShaft) targets.push(currentAssembly.outputShaft);

    const intersects = raycaster.intersectObjects(targets, true);
    if (intersects.length > 0) {
      let hit = intersects[0].object;
      while (hit && !hit.userData?.isShaftSlot && hit !== currentAssembly.inputShaft && hit !== currentAssembly.outputShaft && hit.parent) {
        hit = hit.parent;
      }
      if (hit === currentAssembly.inputSlotMarker || hit === currentAssembly.inputShaft || hit.userData?.slotType === 'input') {
        placeInputGear(puzzleState.selectedInventoryGear);
      } else if (hit === currentAssembly.outputSlotMarker || hit === currentAssembly.outputShaft || hit.userData?.slotType === 'output') {
        placeOutputGear(puzzleState.selectedInventoryGear);
      }
    }
  });
}

// Phase 5: 3D Drag and Drop Placement System
initDragDrop({
  scene,
  camera,
  controls,
  canvas,
  callbacks: {
    onPlaceInput: (teeth) => {
      placeGearOnInput(teeth);
    },
    onPlaceOutput: (teeth) => {
      placeGearOnOutput(teeth);
    },
    onReturnToInventory: (teeth) => {
      returnGearToInventory(teeth);
      audio.playButtonClick();
      updateSelectedGearsUI(
        puzzleState.selectedInputTeeth,
        puzzleState.selectedOutputTeeth,
        puzzleState.selectedInventoryGear,
        puzzleState.requireSeparateGears
      );
    },
  },
});

// Requirement 16: Validate all levels on startup
validateLevels();

// Expose state globally for drag-drop and external inspection
window.gearFactoryState = state;

// Sync settings UI with initial audio state
updateSettingsUI(audio.isSoundEnabled(), audio.isMusicEnabled());

// Load first incomplete/unlocked level on startup
const initialLevel = getNextIncompleteLevel();
loadLevel(initialLevel);
setRunningState(true);
setLabelToggleUI(isLabelsVisible);

// Phase 11: First-time player welcome modal check
checkFirstTimeWelcome(() => {
  loadLevel(1, false);
});

/* ==========================================================================
   4. Animation Loop & Kinetic Simulation
   ========================================================================== */
let lastTimestamp = performance.now();

function animate(now = performance.now()) {
  requestAnimationFrame(animate);

  const deltaSeconds = Math.min((now - lastTimestamp) / 1000.0, 0.1);
  lastTimestamp = now;

  if (state.isPaused) {
    updateControls();
    render(camera);
    return;
  }

  // Level Progression Timer
  if (state.levelInProgress) {
    state.levelTimeSeconds += deltaSeconds;
    updateTimerDisplay(state.levelTimeSeconds);
  }

  if (state.isRunning) {
    // 1. Motor shaft rotates continuously at motorOmega
    kinetics.motorAngle += kinetics.motorOmega * deltaSeconds;

    // 2. Input shaft & gear rotate when input gear is installed
    if (puzzleState.selectedInputTeeth) {
      kinetics.inputAngle += kinetics.inputOmega * deltaSeconds;
    }

    // 3. Output shaft & gear rotate only when transmission is engaged (both gears placed)
    if (kinetics.isEngaged) {
      kinetics.outputAngle += kinetics.outputOmega * deltaSeconds;
    }
  }

  // Phase 6: Mechanical Engagement Animation (Smooth axial keyway slide into seat)
  if (engagementState.active && engagementState.targetMesh) {
    const elapsed = (now - engagementState.startTime) / 1000.0;
    const progress = Math.min(elapsed / engagementState.duration, 1.0);
    // Smooth cubic ease out
    const ease = 1.0 - Math.pow(1.0 - progress, 3);
    engagementState.targetMesh.position.x = engagementState.startOffsetX * (1.0 - ease);

    if (currentAssembly.engagementContactFlash) {
      currentAssembly.engagementContactFlash.material.opacity = 0.75 * (1.0 - progress);
    }

    if (progress >= 1.0) {
      engagementState.active = false;
      engagementState.targetMesh.position.x = 0.0;
      if (currentAssembly.engagementContactFlash) {
        currentAssembly.engagementContactFlash.material.opacity = 0.0;
      }
    }
  }

  // Keep state angles synced
  state.inputAngle = kinetics.inputAngle;
  state.outputAngle = kinetics.outputAngle;

  // Group 1 (Drive): Motor Shaft, Input Shaft, Input Gear & Bearing Inner Rings rotate CLOCKWISE (-X)
  if (currentAssembly.motorShaft) {
    currentAssembly.motorShaft.rotation.x = -kinetics.motorAngle;
  }
  if (currentAssembly.inputShaft) {
    currentAssembly.inputShaft.rotation.x = -kinetics.inputAngle;
  }
  if (currentAssembly.inputGear) {
    currentAssembly.inputGear.rotation.x = -kinetics.inputAngle;
  }
  if (currentAssembly.inputSupportLeft?.userData?.innerRing) {
    currentAssembly.inputSupportLeft.userData.innerRing.rotation.x = -kinetics.inputAngle;
  }
  if (currentAssembly.inputSupportRight?.userData?.innerRing) {
    currentAssembly.inputSupportRight.userData.innerRing.rotation.x = -kinetics.inputAngle;
  }
  if (currentAssembly.inputSupportLeft?.userData?.balls) {
    currentAssembly.inputSupportLeft.userData.balls.rotation.x = -kinetics.inputAngle * 0.5;
  }
  if (currentAssembly.inputSupportRight?.userData?.balls) {
    currentAssembly.inputSupportRight.userData.balls.rotation.x = -kinetics.inputAngle * 0.5;
  }

  // Group 2 (Driven): Output Gear, Output Shaft & Bearing Inner Rings rotate COUNTER-CLOCKWISE (+X)
  const outPhaseRot = (currentAssembly.initialPhaseOutput || 0) + kinetics.outputAngle;
  if (currentAssembly.outputGear) {
    currentAssembly.outputGear.rotation.x = outPhaseRot;
  }
  if (currentAssembly.outputShaft) {
    currentAssembly.outputShaft.rotation.x = outPhaseRot;
  }
  if (currentAssembly.outputSupportLeft?.userData?.innerRing) {
    currentAssembly.outputSupportLeft.userData.innerRing.rotation.x = outPhaseRot;
  }
  if (currentAssembly.outputSupportRight?.userData?.innerRing) {
    currentAssembly.outputSupportRight.userData.innerRing.rotation.x = outPhaseRot;
  }
  if (currentAssembly.outputSupportLeft?.userData?.balls) {
    currentAssembly.outputSupportLeft.userData.balls.rotation.x = outPhaseRot * 0.5;
  }
  if (currentAssembly.outputSupportRight?.userData?.balls) {
    currentAssembly.outputSupportRight.userData.balls.rotation.x = outPhaseRot * 0.5;
  }

  // Phase 11: Direction Indicator Arrows Rotation
  if (currentAssembly.inputDirectionArrow) {
    currentAssembly.inputDirectionArrow.rotation.x = -kinetics.inputAngle;
  }
  if (currentAssembly.outputDirectionArrow) {
    currentAssembly.outputDirectionArrow.rotation.x = outPhaseRot;
  }

  // Phase 11: Soft pulsing shaft guidance for beginner levels (1-5)
  if (puzzleState.currentLevel <= 5) {
    const pulse = 0.45 + 0.35 * Math.sin(now * 0.006);
    if (currentAssembly.inputSlotMarker && !puzzleState.selectedInputTeeth && currentAssembly.inputSlotMarker.material) {
      currentAssembly.inputSlotMarker.material.opacity = pulse;
    }
    if (currentAssembly.outputSlotMarker && !puzzleState.selectedOutputTeeth && currentAssembly.outputSlotMarker.material) {
      currentAssembly.outputSlotMarker.material.opacity = pulse;
    }
  }

  // Smooth OrbitControls damping
  updateControls();

  // Telemetry updates
  updateLiveHUDDisplay(kinetics.inputRPM, kinetics.outputRPM, state.maxMeterRPM);

  // Render 3D Scene
  render(camera);
}

// Start loop
animate();

/* ==========================================================================
   5. Window & Container Resizing
   ========================================================================== */
function handleResize() {
  const c = document.getElementById('three-container');
  if (!c || c.clientWidth <= 0 || c.clientHeight <= 0) return;

  renderer.setSize(c.clientWidth, c.clientHeight);
  camera.aspect = c.clientWidth / c.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
}

window.addEventListener('resize', handleResize);

if (typeof ResizeObserver !== 'undefined' && container) {
  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);
}

/* ==========================================================================
   6. Global Test & Inspection API Surface (window.gearFactory)
   ========================================================================== */
window.gearFactory = {
  state,
  scene,
  camera,
  controls: getControls(),
  renderer: getRenderer(),
  get currentAssembly() { return currentAssembly; },
  get inputGear() { return currentAssembly.inputGear; },
  get outputGear() { return currentAssembly.outputGear; },
  get gear() { return currentAssembly.inputGear; },
  get motor() { return currentAssembly.motor; },
  get motorShaft() { return currentAssembly.motorShaft; },
  get inputShaft() { return currentAssembly.inputShaft; },
  get outputShaft() { return currentAssembly.outputShaft; },
  get gearboxCasing() { return currentAssembly.gearboxCasing; },
  get labelsGroup() { return currentAssembly.labelsGroup; },
  get bearingSupports() { return currentAssembly.bearingSupports; },
  get inputSupportLeft() { return currentAssembly.inputSupportLeft; },
  get inputSupportRight() { return currentAssembly.inputSupportRight; },
  get outputSupportLeft() { return currentAssembly.outputSupportLeft; },
  get outputSupportRight() { return currentAssembly.outputSupportRight; },
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
  get debug() { return debugTelemetry; },
  levelData,
  GEAR_INVENTORY,
  get currentLevel() { return puzzleState.currentLevel; },
  set currentLevel(v) { loadLevel(v); },
  get selectedInputTeeth() { return puzzleState.selectedInputTeeth; },
  set selectedInputTeeth(v) { if (v === null) clearInputGear(); else placeInputGear(v); },
  get selectedOutputTeeth() { return puzzleState.selectedOutputTeeth; },
  set selectedOutputTeeth(v) { if (v === null) clearOutputGear(); else placeOutputGear(v); },
  get selectedInventoryGear() { return puzzleState.selectedInventoryGear; },
  set selectedInventoryGear(v) { selectGear(v); },
  get requireSeparateGears() { return puzzleState.requireSeparateGears; },
  set requireSeparateGears(v) { puzzleState.requireSeparateGears = !!v; onSelectionChanged(); },
  createGearInventory: () => { },
  selectGear,
  placeInputGear,
  placeOutputGear,
  clearInputGear,
  clearOutputGear,
  calculateOutputRPM,
  checkSolution: checkPuzzleSolution,
  checkPuzzleSolution,
  resetLevel,
  completeLevel,
  selectInputGear: (t) => placeInputGear(t),
  selectOutputGear: (t) => placeOutputGear(t),
  updateSelectedGears: onSelectionChanged,
  clearSelection,
  loadLevel,
  puzzle: puzzleState,
  puzzleState,
  setRunningState,
  kinetics,
  recalculateKinetics,
  validateLevels,
  getCompletedLevels,
  getHighestUnlockedLevel,
  setHighestUnlockedLevel,
  isLevelUnlocked,
  setLevelCompleted,
  openLevelSelectModal: () => {
    renderLevelSelectModal(
      levelData,
      getCompletedLevels(),
      getHighestUnlockedLevel(),
      puzzleState.currentLevel,
      (lvl) => loadLevel(lvl)
    );
    openLevelSelectModal();
  },
  closeLevelSelectModal,
  // Phase 5 Drag and Drop API
  startGearDrag,
  updateGearDrag,
  finishGearDrag,
  clearDragState,
  returnGearToInventory,
  placeGearOnInput,
  placeGearOnOutput,
  placeGearOnShaft: (shaft, t) => {
    if (shaft === 'input' || shaft === 1) placeInputGear(t);
    else placeOutputGear(t);
  },
  dragDropState,
  // Phase 6 Mechanical API
  checkGearMesh,
  triggerMechanicalEngagement,
  // Phase 7 Progression, Tutorial & Controls API
  pauseGame,
  resumeGame,
  replayCurrentLevel,
  replay: replayCurrentLevel,
  startTutorial,
  skipTutorial,
  completeTutorial,
  tutorialState,
  isTutorialCompleted,
  setTutorialCompleted,
  showLevelIntro,
  closeLevelIntro,
  showLevelComplete,
  closeLevelComplete,
  openMainMenu,
  closeMainMenu,
  openPauseModal,
  closePauseModal,
  openSettingsModal,
  closeSettingsModal,
  audio,
  // Phase 11 API Surface
  getContextualHint,
  updateContextualHintUI,
  openRpmInfoModal,
  closeRpmInfoModal,
  openWelcomeModal,
  closeWelcomeModal,
  checkFirstTimeWelcome,
  openHowGearsModal,
  closeHowGearsModal,
  get inputDirectionArrow() { return currentAssembly.inputDirectionArrow; },
  get outputDirectionArrow() { return currentAssembly.outputDirectionArrow; },
};
window.GearFactory = window.gearFactory;
// --- End: src/main.js ---

})();