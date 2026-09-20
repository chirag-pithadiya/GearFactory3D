/**
 * Gear Factory 3D — Level Definitions & Progression System (Levels 1–50)
 *
 * Requirements & Features:
 * - 50 progressive mechanical gear puzzles across 7 difficulty tiers
 * - Programmatic validation ensuring every level has at least one valid solution
 * - Browser localStorage persistence (highestUnlockedLevel, completedLevels)
 * - Strict solution concealment from player-facing UI
 */

import { calculateOutputRPM } from './game-state.js';

export const STORAGE_KEYS = {
  HIGHEST_UNLOCKED: 'gearfactory_highest_unlocked',
  COMPLETED_LEVELS: 'gearfactory_completed_levels',
  TUTORIAL_COMPLETED: 'tutorialCompleted',
};

export const levelData = [
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
export function getLevel(levelNumber) {
  if (levelNumber < 1 || levelNumber > levelData.length) return null;
  return levelData[levelNumber - 1];
}

/**
 * Returns total number of available levels.
 * @returns {number}
 */
export function getTotalLevels() {
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
export function checkLevelSolution(levelNumber, inputTeeth, outputTeeth, tolerance = 0.5) {
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
export function validateLevels() {
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
export function getHighestUnlockedLevel() {
  try {
    const val = parseInt(localStorage.getItem(STORAGE_KEYS.HIGHEST_UNLOCKED), 10);
    return isNaN(val) || val < 1 ? 1 : Math.min(val, levelData.length);
  } catch (e) {
    return 1;
  }
}

export function setHighestUnlockedLevel(levelNumber) {
  try {
    const current = getHighestUnlockedLevel();
    if (levelNumber > current && levelNumber <= levelData.length) {
      localStorage.setItem(STORAGE_KEYS.HIGHEST_UNLOCKED, levelNumber.toString());
    }
  } catch (e) { }
}

export function getCompletedLevels() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPLETED_LEVELS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    return [];
  }
}

export function setLevelCompleted(levelNumber) {
  try {
    const list = getCompletedLevels();
    if (!list.includes(levelNumber)) {
      list.push(levelNumber);
      localStorage.setItem(STORAGE_KEYS.COMPLETED_LEVELS, JSON.stringify(list));
    }
    setHighestUnlockedLevel(levelNumber + 1);
  } catch (e) { }
}

export function isLevelUnlocked(levelNumber) {
  if (levelNumber === 1) return true;
  return levelNumber <= getHighestUnlockedLevel();
}

export function isLevelCompleted(levelNumber) {
  return getCompletedLevels().includes(levelNumber);
}

export function getNextIncompleteLevel() {
  const completed = getCompletedLevels();
  const highest = getHighestUnlockedLevel();
  for (let i = 1; i <= highest; i++) {
    if (!completed.includes(i)) return i;
  }
  return Math.min(highest, levelData.length);
}
