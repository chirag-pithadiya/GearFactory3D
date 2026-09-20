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

  // ==========================================
  // TIER 8: LEVELS 51–60 — BEGINNER+ / WORKSHOP PRACTICE
  // Focus: Reinforce visual learning, equal gears, small->large, large->small
  // ==========================================
  {
    level: 51,
    difficulty: 'BEGINNER+',
    title: 'Level 51 — Equal Speed Transfer',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 1200,
    availableGears: [20, 30],
    visualHint: 'EQUAL GEAR TRANSFER ⚙=⚙',
    teachMessage: 'Matching gears transfer speed directly.',
    objective: 'Matching equal gears transfer speed 1:1. Run the machine at 1200 RPM.',
    requireSeparateGears: false,
  },
  {
    level: 52,
    difficulty: 'BEGINNER+',
    title: 'Level 52 — Gentle Reduction',
    motorRPM: 1000,
    inputRPM: 1000,
    targetRPM: 500,
    availableGears: [20, 40],
    visualHint: 'SMALL GEAR → LARGE GEAR',
    teachMessage: 'Driving a larger gear slows down the output.',
    objective: 'Driving a larger gear cuts speed in half. Reach the target 500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 53,
    difficulty: 'BEGINNER+',
    title: 'Level 53 — Speed Multiplier',
    motorRPM: 600,
    inputRPM: 600,
    targetRPM: 1200,
    availableGears: [20, 40],
    visualHint: 'LARGE GEAR → SMALL GEAR',
    teachMessage: 'Driving a smaller gear speeds up the output.',
    objective: 'Driving a smaller gear doubles the speed. Reach the target 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 54,
    difficulty: 'BEGINNER+',
    title: 'Level 54 — High Reduction',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 300,
    availableGears: [10, 30, 50],
    visualHint: 'STEP DOWN SPEED ⚙➔⚙',
    teachMessage: 'Use a much larger gear on the output.',
    objective: 'Choose the gears that reduce the machine speed to 300 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 55,
    difficulty: 'BEGINNER+',
    title: 'Level 55 — Speed Division',
    motorRPM: 1500,
    inputRPM: 1500,
    targetRPM: 750,
    availableGears: [20, 40, 60],
    visualHint: 'HALF SPEED DRIVE',
    teachMessage: 'Halve the motor speed to reach the target.',
    objective: 'Connect the gears to make the output machine run at 750 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 56,
    difficulty: 'BEGINNER+',
    title: 'Level 56 — Step Up Drive',
    motorRPM: 800,
    inputRPM: 800,
    targetRPM: 1600,
    availableGears: [10, 20, 30],
    visualHint: 'DOUBLE SPEED DRIVE',
    teachMessage: 'Make the output turn twice as fast.',
    objective: 'Pick the gears that double the machine speed to 1600 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 57,
    difficulty: 'BEGINNER+',
    title: 'Level 57 — Simple Overdrive',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 1800,
    availableGears: [20, 30, 40],
    visualHint: 'OVERDRIVE ENGAGEMENT',
    teachMessage: 'A large motor gear drives a smaller machine gear.',
    objective: 'Make the output reach the target speed of 1800 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 58,
    difficulty: 'BEGINNER+',
    title: 'Level 58 — Triple Reduction',
    motorRPM: 1800,
    inputRPM: 1800,
    targetRPM: 600,
    availableGears: [10, 30, 50],
    visualHint: 'TRIPLE REDUCTION',
    teachMessage: 'Step down the high motor speed.',
    objective: 'Slow the output machine down to 600 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 59,
    difficulty: 'BEGINNER+',
    title: 'Level 59 — Selective Meshing',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 400,
    availableGears: [10, 20, 30, 40],
    visualHint: 'DISCOVER THE RATIO',
    teachMessage: 'Look past the extra gears to find the 1:3 ratio.',
    objective: 'Choose the gears that make the machine run at 400 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 60,
    difficulty: 'BEGINNER+',
    title: 'Level 60 — Workshop Practice Milestone',
    motorRPM: 1000,
    inputRPM: 1000,
    targetRPM: 2000,
    availableGears: [20, 30, 40, 50],
    visualHint: 'SPEED DOUBLING',
    teachMessage: 'Test your understanding before the intermediate tier.',
    objective: 'Reinforce your knowledge: Reach 2000 RPM using the available gears.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 9: LEVELS 61–70 — INTERMEDIATE
  // Focus: 4–5 available gears, non-integer ratios (2:3, 3:2, 3:4, 4:5, 5:4, 5:3)
  // ==========================================
  {
    level: 61,
    difficulty: 'INTERMEDIATE',
    title: 'Level 61 — Two-Thirds Reduction',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 800,
    availableGears: [10, 20, 30, 40],
    visualHint: 'MODERATE REDUCTION',
    teachMessage: 'Try pairing gears that are close in size.',
    objective: 'Adjust the gears so the machine runs at exactly 800 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 62,
    difficulty: 'INTERMEDIATE',
    title: 'Level 62 — Thousand RPM Match',
    motorRPM: 1500,
    inputRPM: 1500,
    targetRPM: 1000,
    availableGears: [20, 30, 40, 50],
    visualHint: 'TARGET 1000 RPM',
    teachMessage: 'Find the gear pairing that drops 1500 down to 1000.',
    objective: 'Make the output reach the target speed of 1000 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 63,
    difficulty: 'INTERMEDIATE',
    title: 'Level 63 — Five-Four Step Up',
    motorRPM: 1600,
    inputRPM: 1600,
    targetRPM: 2000,
    availableGears: [20, 30, 40, 50],
    visualHint: 'SLIGHT STEP UP',
    teachMessage: 'The output needs to turn slightly faster than the motor.',
    objective: 'Choose the right gears to increase the machine speed to 2000 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 64,
    difficulty: 'INTERMEDIATE',
    title: 'Level 64 — Five-Thirds Boost',
    motorRPM: 750,
    inputRPM: 750,
    targetRPM: 1250,
    availableGears: [10, 20, 30, 50],
    visualHint: 'FRACTIONAL OVERDRIVE',
    teachMessage: 'A larger motor gear speeds up the smaller machine gear.',
    objective: 'Make the output reach the target speed of 1250 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 65,
    difficulty: 'INTERMEDIATE',
    title: 'Level 65 — Three-Quarter Drive',
    motorRPM: 1800,
    inputRPM: 1800,
    targetRPM: 1350,
    availableGears: [10, 30, 40, 50],
    visualHint: 'FINE REDUCTION',
    teachMessage: 'Pick the pair that gently steps down the speed.',
    objective: 'Set up the gearbox to deliver exactly 1350 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 66,
    difficulty: 'INTERMEDIATE',
    title: 'Level 66 — Fifteen Hundred Mark',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 1500,
    availableGears: [20, 30, 40, 50],
    visualHint: 'SPEED MULTIPLIER',
    teachMessage: 'Experiment with larger motor gears.',
    objective: 'Increase the speed from 900 RPM up to 1500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 67,
    difficulty: 'INTERMEDIATE',
    title: 'Level 67 — Quarter Speed Reduction',
    motorRPM: 2400,
    inputRPM: 2400,
    targetRPM: 600,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'MAJOR REDUCTION',
    teachMessage: 'A small motor gear into a large machine gear produces strong reduction.',
    objective: 'Bring the fast 2400 RPM motor down to 600 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 68,
    difficulty: 'INTERMEDIATE',
    title: 'Level 68 — Quarter Boost Calibration',
    motorRPM: 1000,
    inputRPM: 1000,
    targetRPM: 1250,
    availableGears: [10, 20, 40, 50],
    visualHint: 'SUBTLE SPEED BOOST',
    teachMessage: 'Pair the gears that give a 25% speed increase.',
    objective: 'Make the output reach the target speed of 1250 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 69,
    difficulty: 'INTERMEDIATE',
    title: 'Level 69 — One-and-a-Half Factor',
    motorRPM: 1400,
    inputRPM: 1400,
    targetRPM: 2100,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: '3:2 SPEED FACTOR',
    teachMessage: 'Find the gears that increase speed by 1.5 times.',
    objective: 'Drive the output machine at 2100 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 70,
    difficulty: 'INTERMEDIATE',
    title: 'Level 70 — Intermediate Milestone',
    motorRPM: 2000,
    inputRPM: 2000,
    targetRPM: 1600,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: 'FOUR-FIFTHS RATIO',
    teachMessage: 'Select the gears that gently slow 2000 down to 1600.',
    objective: 'Tune the gearbox to achieve 1600 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 10: LEVELS 71–80 — ADVANCED PUZZLES
  // Focus: 5–6 available gears, industrial motor speeds (720, 1080, 1440, 2160, 2500)
  // ==========================================
  {
    level: 71,
    difficulty: 'ADVANCED',
    title: 'Level 71 — Industrial Step-Down',
    motorRPM: 1440,
    inputRPM: 1440,
    targetRPM: 960,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'STANDARD MOTOR SPEED',
    teachMessage: '1440 RPM is a common industrial motor speed.',
    objective: 'Reduce the motor speed from 1440 RPM down to 960 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 72,
    difficulty: 'ADVANCED',
    title: 'Level 72 — Subtle Motor Drop',
    motorRPM: 1440,
    inputRPM: 1440,
    targetRPM: 1200,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: 'FIVE-SIXTHS REDUCTION',
    teachMessage: 'Two large gears with a small difference in size.',
    objective: 'Calibrate the machine output to run at 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 73,
    difficulty: 'ADVANCED',
    title: 'Level 73 — Low Speed Generator',
    motorRPM: 720,
    inputRPM: 720,
    targetRPM: 1800,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'HIGH MULTIPLICATION',
    teachMessage: 'Multiply the slow motor speed up to 1800 RPM.',
    objective: 'Choose the gears to boost output speed from 720 to 1800 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 74,
    difficulty: 'ADVANCED',
    title: 'Level 74 — High Turbine Step-Down',
    motorRPM: 2160,
    inputRPM: 2160,
    targetRPM: 1440,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'TURBINE REDUCTION',
    teachMessage: 'Multiple gear sizes can produce this reduction ratio.',
    objective: 'Step down the 2160 RPM turbine speed to 1440 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 75,
    difficulty: 'ADVANCED',
    title: 'Level 75 — Four-Thirds Step-Up',
    motorRPM: 1080,
    inputRPM: 1080,
    targetRPM: 1440,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: 'STEP UP TO 1440',
    teachMessage: 'Drive the output one-third faster than the motor.',
    objective: 'Match the output speed to exactly 1440 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 76,
    difficulty: 'ADVANCED',
    title: 'Level 76 — Heavy Mill Reducer',
    motorRPM: 2500,
    inputRPM: 2500,
    targetRPM: 1500,
    availableGears: [10, 20, 30, 40, 50],
    visualHint: 'THREE-FIFTHS RATIO',
    teachMessage: 'A 3:5 proportion drops 2500 down to 1500.',
    objective: 'Make the machine output run at 1500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 77,
    difficulty: 'ADVANCED',
    title: 'Level 77 — Six-Fifths Overdrive',
    motorRPM: 1500,
    inputRPM: 1500,
    targetRPM: 1800,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: 'SLIGHT OVERDRIVE',
    teachMessage: 'The input gear should be slightly larger than the output gear.',
    objective: 'Accelerate the output from 1500 RPM to 1800 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 78,
    difficulty: 'ADVANCED',
    title: 'Level 78 — Fine Turbine Trimming',
    motorRPM: 1800,
    inputRPM: 1800,
    targetRPM: 1500,
    availableGears: [20, 30, 40, 50, 60],
    visualHint: 'INVERSE RATIO',
    teachMessage: 'The reverse of the previous challenge.',
    objective: 'Trim the output speed down from 1800 to 1500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 79,
    difficulty: 'ADVANCED',
    title: 'Level 79 — Distractor Maze',
    motorRPM: 2100,
    inputRPM: 2100,
    targetRPM: 1400,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'TEST COMBINATIONS',
    teachMessage: 'Test combinations to find the one that reaches 1400 RPM.',
    objective: 'Reach the target speed of 1400 RPM from a 2100 RPM motor.',
    requireSeparateGears: true,
  },
  {
    level: 80,
    difficulty: 'ADVANCED',
    title: 'Level 80 — Advanced Gearbox Milestone',
    motorRPM: 1350,
    inputRPM: 1350,
    targetRPM: 2250,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'FIVE-THIRDS DRIVE',
    teachMessage: 'Boost 1350 RPM up into the high-speed 2000+ range.',
    objective: 'Advance through the workshop: Match the target 2250 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 11: LEVELS 81–90 — MASTER PUZZLES
  // Focus: Full 6-gear inventory, multiple tempting distractors, precise speed matching
  // ==========================================
  {
    level: 81,
    difficulty: 'MASTER',
    title: 'Level 81 — Master Calibration I',
    motorRPM: 2400,
    inputRPM: 2400,
    targetRPM: 2000,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'CLOSE RATIO MATCH',
    teachMessage: 'Carefully compare the available large gears.',
    objective: 'Master calibration: Reach exactly 2000 RPM from a 2400 RPM motor.',
    requireSeparateGears: true,
  },
  {
    level: 82,
    difficulty: 'MASTER',
    title: 'Level 82 — Master Overdrive I',
    motorRPM: 2000,
    inputRPM: 2000,
    targetRPM: 2400,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'INVERSE CLOSE RATIO',
    teachMessage: 'A slight step up from 2000 to 2400 RPM.',
    objective: 'Configure the gearbox to achieve 2400 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 83,
    difficulty: 'MASTER',
    title: 'Level 83 — Precision Four-Thirds',
    motorRPM: 1200,
    inputRPM: 1200,
    targetRPM: 1600,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'STEP UP RATIO',
    teachMessage: 'Find the gear pair that produces a 33% increase.',
    objective: 'Make the machine output run at 1600 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 84,
    difficulty: 'MASTER',
    title: 'Level 84 — Precision Three-Fourths',
    motorRPM: 1600,
    inputRPM: 1600,
    targetRPM: 1200,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'STEP DOWN RATIO',
    teachMessage: 'Step down the 1600 RPM motor to 1200 RPM.',
    objective: 'Match the output speed to exactly 1200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 85,
    difficulty: 'MASTER',
    title: 'Level 85 — Fine Drive Trimming',
    motorRPM: 2250,
    inputRPM: 2250,
    targetRPM: 1350,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'INTERMEDIATE REDUCTION',
    teachMessage: 'Test which gear pair drops 2250 down to 1350.',
    objective: 'Fine-tune the transmission to deliver 1350 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 86,
    difficulty: 'MASTER',
    title: 'Level 86 — Deep Reduction Challenge',
    motorRPM: 1750,
    inputRPM: 1750,
    targetRPM: 700,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'TWO-FIFTHS SPEED',
    teachMessage: 'Notice the relationship between 2 and 5.',
    objective: 'Bring the machine speed from 1750 RPM down to 700 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 87,
    difficulty: 'MASTER',
    title: 'Level 87 — High Output Step-Up',
    motorRPM: 1620,
    inputRPM: 1620,
    targetRPM: 2700,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'HIGH SPEED CALIBRATION',
    teachMessage: 'Boost the motor speed substantially above 2500 RPM.',
    objective: 'Configure the gears to hit 2700 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 88,
    difficulty: 'MASTER',
    title: 'Level 88 — High Speed Reduction',
    motorRPM: 2880,
    inputRPM: 2880,
    targetRPM: 1920,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'TWO-THIRDS DRIVE',
    teachMessage: 'Several gear pairings can produce a 2:3 reduction.',
    objective: 'Reduce 2880 RPM down to 1920 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 89,
    difficulty: 'MASTER',
    title: 'Level 89 — High Speed Overdrive',
    motorRPM: 1920,
    inputRPM: 1920,
    targetRPM: 2880,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'THREE-HALVES DRIVE',
    teachMessage: 'The inverse high speed drive: 1.5x multiplication.',
    objective: 'Multiply 1920 RPM up to 2880 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 90,
    difficulty: 'MASTER',
    title: 'Level 90 — Master Gearbox Milestone',
    motorRPM: 2700,
    inputRPM: 2700,
    targetRPM: 2250,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'SUBTLE STEP-DOWN',
    teachMessage: 'A 5:6 ratio gently steps down high speeds.',
    objective: 'Prove master competence: Calibrate the output to 2250 RPM.',
    requireSeparateGears: true,
  },

  // ==========================================
  // TIER 12: LEVELS 91–100 — GRANDMASTER FINALE
  // Focus: Peak challenges of the 100-level campaign. All 6 gears available.
  // ==========================================
  {
    level: 91,
    difficulty: 'GRANDMASTER',
    title: 'Level 91 — Finale Stage I',
    motorRPM: 1800,
    inputRPM: 1800,
    targetRPM: 2160,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'APEX RATIO SELECTION',
    teachMessage: 'Begin the final campaign gauntlet.',
    objective: 'Calibrate the machine output to exactly 2160 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 92,
    difficulty: 'GRANDMASTER',
    title: 'Level 92 — Finale Stage II',
    motorRPM: 2160,
    inputRPM: 2160,
    targetRPM: 1800,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'REVERSE APEX RATIO',
    teachMessage: 'Step down the 2160 RPM drive to 1800 RPM.',
    objective: 'Deliver precisely 1800 RPM to the machine output.',
    requireSeparateGears: true,
  },
  {
    level: 93,
    difficulty: 'GRANDMASTER',
    title: 'Level 93 — Deep Precision Step-Down',
    motorRPM: 2250,
    inputRPM: 2250,
    targetRPM: 900,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'DEEP STEP-DOWN',
    teachMessage: 'Cut 2250 RPM down to less than half its speed.',
    objective: 'Match the output speed to exactly 900 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 94,
    difficulty: 'GRANDMASTER',
    title: 'Level 94 — Deep Precision Boost',
    motorRPM: 900,
    inputRPM: 900,
    targetRPM: 2250,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'DEEP STEP-UP',
    teachMessage: 'Multiply 900 RPM up to 2250 RPM.',
    objective: 'Drive the output at the target speed of 2250 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 95,
    difficulty: 'GRANDMASTER',
    title: 'Level 95 — High Speed Calibration',
    motorRPM: 3000,
    inputRPM: 3000,
    targetRPM: 2500,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'HIGH SPEED REDUCTION',
    teachMessage: 'High motor speed requires steady, precise gearing.',
    objective: 'Step down 3000 RPM to reach 2500 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 96,
    difficulty: 'GRANDMASTER',
    title: 'Level 96 — High Speed Multiplication',
    motorRPM: 2500,
    inputRPM: 2500,
    targetRPM: 3000,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'HIGH SPEED BOOST',
    teachMessage: 'The reciprocal high speed challenge.',
    objective: 'Accelerate the machine output to 3000 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 97,
    difficulty: 'GRANDMASTER',
    title: 'Level 97 — Apex Dynamo Trimming',
    motorRPM: 3200,
    inputRPM: 3200,
    targetRPM: 2400,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'DYNAMO CALIBRATION',
    teachMessage: 'Step down the 3200 RPM dynamo to 2400 RPM.',
    objective: 'Tune the gearbox to achieve 2400 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 98,
    difficulty: 'GRANDMASTER',
    title: 'Level 98 — Apex Dynamo Step-Up',
    motorRPM: 2400,
    inputRPM: 2400,
    targetRPM: 3200,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'DYNAMO STEP-UP',
    teachMessage: 'Step up 2400 RPM to reach 3200 RPM.',
    objective: 'Drive the output machine at 3200 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 99,
    difficulty: 'GRANDMASTER',
    title: 'Level 99 — Penultimate Challenge',
    motorRPM: 3600,
    inputRPM: 3600,
    targetRPM: 3000,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'PENULTIMATE STAGE',
    teachMessage: 'One step away from completing the entire factory campaign.',
    objective: 'Step down the maximum 3600 RPM motor to 3000 RPM.',
    requireSeparateGears: true,
  },
  {
    level: 100,
    difficulty: 'GRANDMASTER',
    title: 'Level 100 — The Apex Grandmaster Gearbox',
    motorRPM: 3000,
    inputRPM: 3000,
    targetRPM: 3600,
    availableGears: [10, 20, 30, 40, 50, 60],
    visualHint: 'FINAL CAMPAIGN CHALLENGE ⚙★',
    teachMessage: 'The ultimate gearbox challenge: conquer 3600 RPM to complete the campaign!',
    objective: 'Conquer the final machine: Boost 3000 RPM to 3600 RPM to achieve Campaign Mastery!',
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
