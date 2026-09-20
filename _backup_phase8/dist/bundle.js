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
// --- End: src/game-state.js ---

// --- Begin: src/levels.js ---
/**
 * Gear Factory 3D — Level Definitions & Progression System (Levels 1–20)
 *
 * Requirements & Features:
 * - 20 progressive mechanical gear puzzles across 4 difficulty tiers
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
  // TIER 1: LEVELS 1–5 — BEGINNER
  // Focus: basic reduction, basic speed increase, 1:1 direct drive
  // ==========================================
  {
    level: 1,
    difficulty: 'BEGINNER',
    title: 'Level 1',
    motorRPM: 1000,
    inputRPM: 1000,
    targetRPM: 500,
    availableGears: [10, 20, 30, 40],
    objective: 'Halve the motor speed to 500 RPM (2:1 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 2,
    difficulty: 'BEGINNER',
    title: 'Level 2',
    motorRPM: 600,
    inputRPM: 600,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40],
    objective: 'Double the motor speed to 1200 RPM (1:2 step-up overdrive).',
    requireSeparateGears: true,
  },
  {
    level: 3,
    difficulty: 'BEGINNER',
    title: 'Level 3',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 900,
    availableGears: [10, 20, 30, 40],
    objective: 'Transmit direct drive speed without alteration (1:1 ratio).',
    requireSeparateGears: false,
  },
  {
    level: 4,
    difficulty: 'BEGINNER',
    title: 'Level 4',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 400,
    availableGears: [10, 20, 30, 40],
    objective: 'Reduce 1200 RPM to 400 RPM (3:1 reduction).',
    requireSeparateGears: true,
  },
  {
    level: 5,
    difficulty: 'BEGINNER',
    title: 'Level 5',
    motorRPM: 1600,
    inputRPM: 1600,
    targetRPM: 400,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Quarter the motor speed to 400 RPM (4:1 reduction).',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 2: LEVELS 6–10 — INTERMEDIATE
  // Focus: less obvious ratios, different motor RPM values, fractional gearing
  // ==========================================
  {
    level: 6,
    difficulty: 'INTERMEDIATE',
    title: 'Level 6',
    motorRPM: 800,
    inputRPM: 800,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Step up 800 RPM to 1200 RPM (3:2 ratio = 1.5x).',
    requireSeparateGears: true,
  },
  {
    level: 7,
    difficulty: 'INTERMEDIATE',
    title: 'Level 7',
    motorRPM: 990,
    inputRPM: 990,
    targetRPM: 660,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Moderate reduction to 660 RPM (2:3 ratio = 0.667x).',
    requireSeparateGears: true,
  },
  {
    level: 8,
    difficulty: 'INTERMEDIATE',
    title: 'Level 8',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Step up 900 RPM to 1200 RPM (4:3 ratio = 1.333x).',
    requireSeparateGears: true,
  },
  {
    level: 9,
    difficulty: 'INTERMEDIATE',
    title: 'Level 9',
    motorRPM: 600,
    inputRPM: 600,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Boost 600 RPM to 1500 RPM (5:2 ratio = 2.5x).',
    requireSeparateGears: true,
  },
  {
    level: 10,
    difficulty: 'INTERMEDIATE',
    title: 'Level 10',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    objective: 'Fine speed increase to 1500 RPM (5:4 ratio = 1.25x).',
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

  console.log(`Validation finished: ${allPass ? 'ALL 20 LEVELS VALIDATED ✓' : 'VALIDATION FAILED ✗'}`);
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

function isTutorialCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED) === 'true';
  } catch (e) {
    return false;
  }
}

function setTutorialCompleted() {
  try {
    localStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, 'true');
  } catch (e) { }
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
    bodyColor = 0x223042, // Industrial machine slate teal-gray
    endCoverColor = 0x182230,
    flangeColor = 0x2c3848,
    shaftRadius = 0.28,
    shaftLength = 1.0,
    metalness = 0.74,
    roughness = 0.38,
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
    color: 0x9ab0c4,
    metalness: 0.95,
    roughness: 0.16,
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
    outerColor = 0x384452, // Hardened bearing alloy outer raceway
    innerColor = 0xb0c0d2, // Precision ground mirror-smooth inner ring
    ballColor = 0xf8fafc, // Mirror chrome bearing spheres
    metalness = 0.96,
    roughness = 0.16,
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
    metalness: 0.92,
    roughness: 0.24,
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
    color = 0x96a5b5, // Precision ground turned steel
    metalness = 0.96,
    roughness = 0.16,
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
 * Gear Factory 3D — Lighting & Environment Setup
 */


let inputGearGlow = null;
let outputGearGlow = null;

/**
 * Sets up industrial factory lighting and ground plane.
 * @param {THREE.Scene} scene - The target Three.js scene
 */
function setupLighting(scene) {
  // Ambient Light for soft fill
  const ambientLight = new THREE.AmbientLight(0xdde7f4, 1.15);
  scene.add(ambientLight);

  // Key Directional Light casting soft realistic shadows (5600K neutral studio key)
  const keyLight = new THREE.DirectionalLight(0xfffaee, 2.7);
  keyLight.position.set(9, 18, 11);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 48;
  keyLight.shadow.camera.left = -14;
  keyLight.shadow.camera.right = 14;
  keyLight.shadow.camera.top = 14;
  keyLight.shadow.camera.bottom = -14;
  keyLight.shadow.bias = -0.0003;
  scene.add(keyLight);

  // Front Fill Light for crystal-clear internal visibility
  const frontFillLight = new THREE.DirectionalLight(0xd0e0f2, 1.6);
  frontFillLight.position.set(-6, 12, 15);
  scene.add(frontFillLight);

  // Rim Light highlighting metallic gear edges
  const rimLight = new THREE.DirectionalLight(0xa5c4e8, 1.6);
  rimLight.position.set(-14, 10, -10);
  scene.add(rimLight);

  // Point Lights inside gearbox providing clean neutral illumination on gear faces
  inputGearGlow = new THREE.PointLight(0xfff6ea, 2.2, 16, 1.2);
  inputGearGlow.position.set(-1.0, 7.5, -3.2);
  scene.add(inputGearGlow);

  outputGearGlow = new THREE.PointLight(0xedf4fc, 2.2, 16, 1.2);
  outputGearGlow.position.set(1.0, 7.5, 1.6);
  scene.add(outputGearGlow);

  // Factory Floor Plane receiving shadows (matte industrial concrete workshop floor)
  const floorGeometry = new THREE.PlaneGeometry(50, 50);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x141822,
    roughness: 0.80,
    metalness: 0.20,
  });
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Precision Grid Helper with subtle slate engineering styling
  const gridHelper = new THREE.GridHelper(30, 30, 0x475569, 0x1e2634);
  gridHelper.position.y = 0.005;
  scene.add(gridHelper);

  return {
    ambientLight,
    keyLight,
    frontFillLight,
    rimLight,
    inputGearGlow,
    outputGearGlow,
    floorMesh,
    gridHelper,
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


const defaultCameraPos = new THREE.Vector3(-7.5, 8.2, 12.0);
const defaultTargetPos = new THREE.Vector3(0, 5.3, -0.4);

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
scene.background = new THREE.Color(0x0c1017);
scene.fog = new THREE.Fog(0x0c1017, 22, 65);

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
function createGearboxCasing(options = {}) {
  const {
    widthX = 2.6,
    heightY = 6.4,
    depthZ = 7.2,
    frameColor = 0x242a36, // Cast iron metallic dark slate
    panelColor = 0x8ab2d6, // Optical inspection acrylic
    panelOpacity = 0.04,
    metalness = 0.72,
    roughness = 0.56,
  } = options;

  const casingGroup = new THREE.Group();
  const shaftY = options.shaftY || 3.6;

  // 1. Structural Cast Iron Corner Stanchions
  const pillarGeo = new THREE.BoxGeometry(0.28, heightY, 0.28);
  const castMat = new THREE.MeshStandardMaterial({
    color: frameColor,
    metalness: metalness,
    roughness: roughness,
  });

  // Steel bolt material
  const boltMat = new THREE.MeshStandardMaterial({
    color: 0x161d26,
    metalness: 0.92,
    roughness: 0.28,
  });
  const hexBoltGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.10, 6);

  const xCorners = [-widthX * 0.5 + 0.14, widthX * 0.5 - 0.14];
  const zCorners = [-depthZ * 0.5 + 0.14, depthZ * 0.5 - 0.14];

  for (const cx of xCorners) {
    for (const cz of zCorners) {
      const pillar = new THREE.Mesh(pillarGeo, castMat);
      pillar.position.set(cx, heightY * 0.5, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      casingGroup.add(pillar);
    }
  }

  // 2. Base Perimeter Flange Rails & Stiffeners
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

  // 3. Heavy Top Cover Lid with Inspection Service Hatch & Lifting Eye
  const lidH = 0.28;
  const topCoverGeo = new THREE.BoxGeometry(widthX + 0.24, lidH, depthZ + 0.24);
  const topCoverMesh = new THREE.Mesh(topCoverGeo, castMat);
  topCoverMesh.position.set(0, heightY + lidH * 0.5, 0);
  topCoverMesh.castShadow = true;
  topCoverMesh.receiveShadow = true;
  casingGroup.add(topCoverMesh);

  // Top Inspection Service Cover (Raised rectangular plate with perimeter bolts)
  const hatchGeo = new THREE.BoxGeometry(widthX * 0.75, 0.08, depthZ * 0.45);
  const hatchMat = new THREE.MeshStandardMaterial({
    color: 0x303947,
    metalness: 0.82,
    roughness: 0.42,
  });
  const hatchMesh = new THREE.Mesh(hatchGeo, hatchMat);
  hatchMesh.position.set(0, heightY + lidH + 0.04, 0);
  hatchMesh.castShadow = true;
  casingGroup.add(hatchMesh);

  // Inspection Cover Fastener Bolts (4 corners)
  const hx = widthX * 0.32;
  const hz = depthZ * 0.18;
  const hatchBoltCorners = [
    [-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]
  ];
  for (const [cx, cz] of hatchBoltCorners) {
    const hBolt = new THREE.Mesh(hexBoltGeo, boltMat);
    hBolt.position.set(cx, heightY + lidH + 0.08 + 0.04, cz);
    hBolt.castShadow = true;
    casingGroup.add(hBolt);
  }

  // Heavy Drop-Forged Steel Lifting Eye Bolt on top center
  const eyeBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.26, 0.14, 18),
    new THREE.MeshStandardMaterial({ color: 0x6e7b8a, metalness: 0.90, roughness: 0.25 })
  );
  eyeBase.position.set(0, heightY + lidH + 0.08 + 0.07, 0);
  eyeBase.castShadow = true;
  casingGroup.add(eyeBase);

  const eyeTorus = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.075, 16, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a97a8, metalness: 0.94, roughness: 0.20 })
  );
  eyeTorus.position.set(0, heightY + lidH + 0.08 + 0.38, 0);
  eyeTorus.castShadow = true;
  casingGroup.add(eyeTorus);

  // 5. Optical Inspection Windows & Steel Retaining Bezels (Front & Back)
  // Ensures 100% crystal-clear visibility of all meshing teeth while preserving industrial housing
  const windowMat = new THREE.MeshStandardMaterial({
    color: panelColor,
    transparent: true,
    opacity: panelOpacity,
    roughness: 0.08,
    metalness: 0.25,
    depthWrite: false,
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

  // Retaining Bezel Framing around Front Inspection Window
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x1a212b,
    metalness: 0.88,
    roughness: 0.35,
  });
  const bezelBarH = new THREE.BoxGeometry(widthX - 0.18, 0.08, 0.04);
  const bezelTop = new THREE.Mesh(bezelBarH, bezelMat);
  bezelTop.position.set(0, heightY - 0.25, depthZ * 0.5 + 0.01);
  casingGroup.add(bezelTop);

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
  const motorShaft = motor.userData.shaftGroup;

  // 9. Create Input Shaft
  const inputShaftTotalLength = casingInternalWidthX + 1.4;
  const inputShaftCenterX = -0.7;
  const inputShaft = createShaft({
    radius: 0.32,
    length: inputShaftTotalLength,
    color: 0x94a3b8,
    hasCoupling: true,
  });
  inputShaft.position.set(inputShaftCenterX, shaftY, posZInput);
  scene.add(inputShaft);

  // 10. Create Input Gear (Case-hardened nitrided tool steel, CW) or Slot Locator Ring
  let inputGear = null;
  let inputSlotMarker = null;
  if (selectedInputTeeth) {
    inputGear = createSpurGear({
      teeth: selectedInputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.42,
      color: 0x928472, // Tempered case-hardened bronze/nitride tool steel
      metalness: 0.86,
      roughness: 0.28,
    });
    inputGear.position.set(0, shaftY, posZInput);
    scene.add(inputGear);
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

  // 11. Create Output Gear (Precision machined hardened alloy steel, CCW) or Slot Locator Ring
  let outputGear = null;
  let outputSlotMarker = null;
  let initialPhaseOutput = 0.0;
  if (selectedOutputTeeth) {
    outputGear = createSpurGear({
      teeth: selectedOutputTeeth,
      module: GEAR_MODULE,
      thickness: 0.65,
      boreRadius: 0.50,
      color: 0x75879a, // Precision ground hardened alloy steel
      metalness: 0.89,
      roughness: 0.24,
    });
    outputGear.position.set(0, shaftY, posZOutput);
    scene.add(outputGear);

    initialPhaseOutput = Math.PI / selectedOutputTeeth;
    outputGear.rotation.x = initialPhaseOutput;
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

  // 12. Create Output Shaft
  const outputShaftTotalLength = casingInternalWidthX + 6.0;
  const outputShaftCenterX = 3.0;
  const outputShaft = createShaft({
    radius: 0.40,
    length: outputShaftTotalLength,
    color: 0x8a95a5,
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
    housingColor: 0x384452,
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
    housingColor: 0x384452,
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
    housingColor: 0x384452,
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
    housingColor: 0x384452,
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
  elements.btnClearSelection?.addEventListener('click', () => onClearSelection && onClearSelection());

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
      elements.puzzleCalculatedOutputRpm.style.color = isPass ? '#34d399' : '#f87171';
    }
    if (elements.verificationStatusPill) {
      elements.verificationStatusPill.textContent = isPass ? 'PASS' : 'FAIL';
      elements.verificationStatusPill.className = `verification-status-pill ${isPass ? 'status-complete' : 'status-try-again'}`;
    }
    if (elements.puzzleStatusVal) {
      elements.puzzleStatusVal.textContent = isPass ? 'MATCH (PASS)' : 'RPM MISMATCH (FAIL)';
      elements.puzzleStatusVal.style.color = isPass ? '#34d399' : '#f87171';
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
 * Updates level objective badges (Current Level, Motor Input RPM, Target RPM).
 */
function updateLevelObjectiveUI(levelNumber, totalLevels, inputRPM, targetRPM, difficulty = 'EASY', objective = '') {
  if (elements.puzzleLevelIndicator) {
    elements.puzzleLevelIndicator.textContent = `Level ${levelNumber} of ${totalLevels} • ${difficulty}`;
  }
  if (elements.puzzleInputRpm) {
    elements.puzzleInputRpm.textContent = inputRPM.toFixed(0);
  }
  if (elements.puzzleTargetOutputRpm) {
    elements.puzzleTargetOutputRpm.textContent = targetRPM.toFixed(0);
  }
  if (elements.btnPrevLevel) {
    elements.btnPrevLevel.disabled = levelNumber <= 1;
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
    { name: 'ADVANCED', range: 'Levels 11–15', badgeClass: 'badge-hard', start: 11, end: 15 },
    { name: 'EXPERT', range: 'Levels 16–20', badgeClass: 'badge-advanced', start: 16, end: 20 },
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
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'flex';
}

function closeMainMenu() {
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'none';
}

function openPauseModal() {
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
    elements.introLevelTitle.textContent = `LEVEL ${level.level}`;
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

function showLevelComplete(targetRPM, outputRPM, timeStr, callbacks = {}) {
  if (!elements.levelCompleteModal) return;
  if (elements.modalOutputRpm) {
    elements.modalOutputRpm.textContent = `${Math.round(outputRPM)} RPM`;
  }
  if (elements.modalElapsedTime) {
    elements.modalElapsedTime.textContent = timeStr || '00:00';
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
            <div class="modal-eyebrow">TUTORIAL MODE</div>
            <h2 class="modal-title">GEAR FACTORY 3D</h2>
            <p class="tutorial-desc">Learn how to build a mechanical gear train step-by-step.</p>
            <div class="tutorial-goal-box">
              <span class="goal-label">MISSION GOAL:</span>
              <span class="goal-text">Match the <strong>TARGET RPM</strong> by selecting and meshing the correct gear combination.</span>
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
      // Step 1: Motor Explanation
      if (modal) modal.style.display = 'none';
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 1 OF 6</span>
            <span class="tut-step-title">Electric Drive Motor</span>
          </div>
          <p class="tut-step-text">The electric motor drives the input shaft at a fixed speed (e.g. <strong>1000 RPM</strong>). It runs continuously.</p>
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
      // Step 2: Choose Input Gear
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 2 OF 6</span>
            <span class="tut-step-title">Select Input Gear</span>
          </div>
          <p class="tut-step-text">Click an available gear from the inventory below (e.g. <strong>20T</strong>).</p>
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
      // Step 3: Drag Gear to Input Shaft
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 3 OF 6</span>
            <span class="tut-step-title">Mount to Input Shaft</span>
          </div>
          <p class="tut-step-text">Drag the gear into the 3D scene and drop it onto the <strong>INPUT SHAFT</strong> (or click the slot).</p>
          <div class="tut-guide-animation">
            <span class="tut-guide-chip">⚙ Inventory</span>
            <span class="tut-guide-arrow">➔</span>
            <span class="tut-guide-target">Input Shaft</span>
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
      // Step 4: Output Gear
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 4 OF 6</span>
            <span class="tut-step-title">Select & Mount Output Gear</span>
          </div>
          <p class="tut-step-text">Now select a gear (e.g. <strong>40T</strong>) and drag it onto the <strong>OUTPUT SHAFT</strong>.</p>
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
      // Step 5: Watch Transmission & Mechanical Formula
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 5 OF 6</span>
            <span class="tut-step-title">Mechanical Transmission</span>
          </div>
          <p class="tut-step-text">Both gears are meshed! Output speed is determined by gear ratio:</p>
          <div class="tut-formula-box">
            <code>Output RPM = Input RPM × (Z_in / Z_out)</code>
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
      // Step 6: Check Solution
      if (banner) {
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div class="tutorial-step-header">
            <span class="tut-step-badge">STEP 6 OF 6</span>
            <span class="tut-step-title">Verify Your Build</span>
          </div>
          <p class="tut-step-text">Press <strong>CHECK SOLUTION</strong> to verify if the output RPM matches the puzzle target.</p>
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

// Ensure camera is cleanly framed on the meshing gears
camera.position.set(-7.5, 8.2, 12.0);
controls.target.set(0, 5.3, -0.4);
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
    level.objective
  );
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
    elements.btnNextLevel.disabled = !isLevelUnlocked(levelNumber + 1);
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

  hideBanners();

  if (!puzzleState.selectedInputTeeth && !puzzleState.selectedOutputTeeth) {
    setPuzzleStatusUI('PLACE INPUT AND OUTPUT GEARS', 'pending');
  } else if (!puzzleState.selectedInputTeeth || !puzzleState.selectedOutputTeeth) {
    setPuzzleStatusUI('WAITING FOR SECOND GEAR', 'pending');
  } else {
    setPuzzleStatusUI('GEARS ENGAGED', 'engaged');
  }

  if (elements.btnNextLevel) elements.btnNextLevel.disabled = true;

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
    if (elements.btnNextLevel) elements.btnNextLevel.disabled = false;
    showSuccessBanner(`Calculated ${result.calculatedRPM.toFixed(1)} RPM matches target ${result.targetRPM.toFixed(1)} RPM (diff: ${result.diff.toFixed(2)} RPM).`);
    audio.playSuccess();

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
        }
      );
    }
  } else {
    setPuzzleStatusUI('TRY AGAIN', 'try-again');
    if (elements.btnNextLevel) {
      elements.btnNextLevel.disabled = !isLevelUnlocked(puzzleState.currentLevel + 1);
    }
    showFailBanner(`Speed does not match target. Try another gear combination!`);
    audio.playError();
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
    startTutorial();
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

// Requirement 16: Validate all 20 levels on startup
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
  setRunningState,
  kinetics,
  recalculateKinetics,
  validateLevels,
  getCompletedLevels,
  getHighestUnlockedLevel,
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
  openSettingsModal,
  closeSettingsModal,
  audio,
};
// --- End: src/main.js ---

})();