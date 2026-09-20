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
export const GEAR_MODULE = 0.16;

// Available physical gear inventory (teeth count)
export const GEAR_INVENTORY = [10, 20, 30, 40, 50, 60];

// Main gearbox simulation operational state
export const state = {
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
export const puzzleState = {
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
export const debugTelemetry = {
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
export function calculateGearRatio(outputTeeth, inputTeeth) {
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
export function calculateOutputRPM(inputRPM, inputTeeth, outputTeeth) {
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
export function calculateGearOuterRadius(teeth, module = GEAR_MODULE) {
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
export function getContextualHint({ level = 1, inputTeeth = null, outputTeeth = null, targetRPM = 0, calculatedRPM = null, hasChecked = false } = {}) {
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
