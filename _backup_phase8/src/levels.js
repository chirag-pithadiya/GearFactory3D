/**
 * Gear Factory 3D — Level Definitions & Progression System (Levels 1–20)
 *
 * Requirements & Features:
 * - 20 progressive mechanical gear puzzles across 4 difficulty tiers
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

  console.log(`Validation finished: ${allPass ? 'ALL 20 LEVELS VALIDATED ✓' : 'VALIDATION FAILED ✗'}`);
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

export function isTutorialCompleted() {
  try {
    return localStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED) === 'true';
  } catch (e) {
    return false;
  }
}

export function setTutorialCompleted() {
  try {
    localStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, 'true');
  } catch (e) { }
}
