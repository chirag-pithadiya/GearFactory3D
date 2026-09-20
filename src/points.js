/**
 * Gear Factory 3D — In-Game Points & Gear Inventory Unlock System (Phase 15)
 *
 * Requirements & Features:
 * - Persistent player points stored in localStorage ('gearFactory3D_points')
 * - Anti-farming protection: base points awarded once; performance bonuses awarded once
 * - Centralized gear unlock configuration (GEAR_UNLOCKS):
 *     10T, 20T, 30T, 40T, 50T -> Starter (0 pts)
 *     60T  -> 1,000 pts
 *     70T  -> 2,500 pts
 *     80T  -> 4,500 pts
 *     90T  -> 7,000 pts
 *     100T -> 10,000 pts
 * - Progression data migration for existing players
 * - Safe reset behavior: level reset never resets points
 */

export const POINTS_STORAGE_KEYS = {
  POINTS: 'gearFactory3D_points',
  PROGRESSION: 'gearFactory3D_progression',
  UNLOCKED_GEARS: 'gearFactory3D_unlocked_gears',
  LEGACY_COMPLETED: 'gearfactory_completed_levels',
  LEGACY_HIGHEST: 'gearfactory_highest_unlocked',
};

// Centralized Gear Unlock Configuration
export const GEAR_UNLOCKS = [
  { teeth: 10, pointsRequired: 0, starter: true },
  { teeth: 20, pointsRequired: 0, starter: true },
  { teeth: 30, pointsRequired: 0, starter: true },
  { teeth: 40, pointsRequired: 0, starter: true },
  { teeth: 50, pointsRequired: 0, starter: true },
  { teeth: 60, pointsRequired: 1000, starter: false },
  { teeth: 70, pointsRequired: 2500, starter: false },
  { teeth: 80, pointsRequired: 4500, starter: false },
  { teeth: 90, pointsRequired: 7000, starter: false },
  { teeth: 100, pointsRequired: 10000, starter: false },
];

export const POINT_REWARDS = {
  BASE_COMPLETION: 100,
  FIRST_ATTEMPT: 25,
  NO_HINT: 25,
  QUICK_SOLVE: 25,
  PERFECT_SOLUTION: 50,
  MAX_PER_LEVEL: 225,
};

// Target solve time threshold in seconds for quick-solve bonus
export function getQuickSolveThreshold(levelId) {
  if (levelId <= 20) return 30;
  if (levelId <= 60) return 40;
  return 50;
}

/**
 * Retrieves current player points from localStorage.
 * @returns {number} Integer point balance
 */
export function getPlayerPoints() {
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEYS.POINTS);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    // Fallback to structured progression data if present
    const prog = getProgressionData();
    return typeof prog.points === 'number' ? prog.points : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * Sets player points in localStorage and progression structure.
 * @param {number} points
 */
export function setPlayerPoints(points) {
  const safePoints = Math.max(0, Math.floor(points));
  try {
    localStorage.setItem(POINTS_STORAGE_KEYS.POINTS, safePoints.toString());
    const prog = getProgressionData();
    prog.points = safePoints;
    saveProgressionData(prog);
  } catch (e) {
    console.warn('Failed to save points to localStorage:', e);
  }
  return safePoints;
}

export const BADGE_TYPES = {
  FIRST_SOLVE: 'FIRST_SOLVE',
  NO_HINT: 'NO_HINT',
  QUICK_SOLVE: 'QUICK_SOLVE',
  PERFECT: 'PERFECT',
};

export const BADGE_CONFIG = {
  FIRST_SOLVE: { id: 'FIRST_SOLVE', label: 'FIRST SOLVE', icon: '★', desc: 'Completed the level for the first time' },
  NO_HINT: { id: 'NO_HINT', label: 'NO HINT', icon: '⚡', desc: 'Completed without using a hint' },
  QUICK_SOLVE: { id: 'QUICK_SOLVE', label: 'QUICK SOLVE', icon: '⏱', desc: 'Completed within target quick-solve time' },
  PERFECT: { id: 'PERFECT', label: 'PERFECT', icon: '🏆', desc: 'First attempt + No hint + Quick solve' },
};

/**
 * Loads complete structured progression record from localStorage.
 */
export function getProgressionData() {
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEYS.PROGRESSION);
    if (!raw) {
      return createInitialProgression();
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return createInitialProgression();
    }
    if (typeof data.points !== 'number') data.points = 0;
    if (!Array.isArray(data.unlockedGears)) data.unlockedGears = [10, 20, 30, 40, 50];
    if (!data.levelStats || typeof data.levelStats !== 'object') data.levelStats = {};
    if (!Array.isArray(data.recentRewards)) data.recentRewards = [];
    return data;
  } catch (e) {
    return createInitialProgression();
  }
}

/**
 * Saves progression object into localStorage.
 */
export function saveProgressionData(data) {
  try {
    localStorage.setItem(POINTS_STORAGE_KEYS.PROGRESSION, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save progression data to localStorage:', e);
  }
}

function createInitialProgression() {
  return {
    points: 0,
    unlockedGears: [10, 20, 30, 40, 50],
    levelStats: {},
    recentRewards: [], // [{ level, points, timestamp, badges: [], isNewBest: false, timeSeconds: 0 }]
  };
}

/**
 * Retrieves persisted unlocked gears array.
 * @returns {number[]}
 */
export function getPersistedUnlockedGears() {
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEYS.UNLOCKED_GEARS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const prog = getProgressionData();
    if (Array.isArray(prog.unlockedGears) && prog.unlockedGears.length > 0) {
      return prog.unlockedGears;
    }
  } catch (e) {}
  return [10, 20, 30, 40, 50];
}

/**
 * Saves persisted unlocked gears array to localStorage.
 * @param {number[]} unlockedList
 */
export function savePersistedUnlockedGears(unlockedList) {
  try {
    const safeList = Array.from(new Set(unlockedList)).sort((a, b) => a - b);
    localStorage.setItem(POINTS_STORAGE_KEYS.UNLOCKED_GEARS, JSON.stringify(safeList));
    const prog = getProgressionData();
    prog.unlockedGears = safeList;
    saveProgressionData(prog);
  } catch (e) {
    console.warn('Failed to save unlocked gears to localStorage:', e);
  }
}

/**
 * Requirement: Centralized Automatic Gear Unlock Engine
 *
 * Automatically evaluates the player's total cumulative points against all gear thresholds
 * and unlocks any qualifying gear immediately.
 * Points are NEVER spent or deducted.
 *
 * Thresholds:
 *   10T-50T: Starter gears (0 points)
 *   60T:  automatically unlock at 1,000 points
 *   70T:  automatically unlock at 2,500 points
 *   80T:  automatically unlock at 4,500 points
 *   90T:  automatically unlock at 7,000 points
 *   100T: automatically unlock at 10,000 points
 *
 * @param {number} [points] - Optional point balance (defaults to getPlayerPoints())
 * @returns {{ allUnlockedGears: number[], newlyUnlockedGears: number[] }}
 */
export function checkAndUnlockGears(points = null) {
  const currentPoints = points !== null ? points : getPlayerPoints();
  const previouslyUnlocked = getPersistedUnlockedGears();
  const newlyUnlockedGears = [];

  for (const gear of GEAR_UNLOCKS) {
    if (gear.starter || currentPoints >= gear.pointsRequired) {
      if (!previouslyUnlocked.includes(gear.teeth)) {
        newlyUnlockedGears.push(gear.teeth);
      }
    }
  }

  const allUnlockedGears = Array.from(new Set([...previouslyUnlocked, ...newlyUnlockedGears]))
    .sort((a, b) => a - b);

  savePersistedUnlockedGears(allUnlockedGears);

  return {
    allUnlockedGears,
    newlyUnlockedGears,
  };
}

/**
 * Adds points to player score and immediately checks all gear unlock thresholds.
 * Points are NEVER spent or deducted.
 * @param {number} amount
 * @returns {{ newPoints: number, newlyUnlockedGears: number[], allUnlockedGears: number[] }}
 */
export function addPlayerPoints(amount) {
  const currentPoints = getPlayerPoints();
  const newPoints = currentPoints + Math.max(0, Math.floor(amount));

  // Save updated cumulative points total
  setPlayerPoints(newPoints);

  // Automatically check thresholds and unlock all newly qualifying gears
  const { allUnlockedGears, newlyUnlockedGears } = checkAndUnlockGears(newPoints);

  return {
    newPoints,
    newlyUnlockedGears,
    allUnlockedGears,
  };
}

/**
 * Returns list of teeth counts currently unlocked for given point total (or current points).
 * @param {number} [points]
 * @returns {number[]} Array of unlocked teeth counts
 */
export function getUnlockedGears(points = null) {
  const pts = points !== null ? points : getPlayerPoints();
  return GEAR_UNLOCKS
    .filter(g => g.starter || pts >= g.pointsRequired)
    .map(g => g.teeth);
}

/**
 * Checks whether a specific gear size is unlocked.
 * @param {number} teeth
 * @param {number} [points]
 * @returns {boolean}
 */
export function isGearUnlocked(teeth, points = null) {
  const cfg = GEAR_UNLOCKS.find(g => g.teeth === teeth);
  if (!cfg) return true; // Default allow if unconfigured
  if (cfg.starter) return true;
  const pts = points !== null ? points : getPlayerPoints();
  return pts >= cfg.pointsRequired;
}

/**
 * Returns information on the next locked gear to unlock, or null if all gears are unlocked.
 * @param {number} [points]
 * @returns {Object|null}
 */
export function getNextLockedGear(points = null) {
  const pts = points !== null ? points : getPlayerPoints();
  const next = GEAR_UNLOCKS.find(g => !g.starter && pts < g.pointsRequired);
  if (!next) return null;

  const remaining = next.pointsRequired - pts;
  // Progress toward this specific tier from the previous tier's points
  const prevTier = GEAR_UNLOCKS.filter(g => g.pointsRequired < next.pointsRequired).pop();
  const prevReq = prevTier ? prevTier.pointsRequired : 0;
  const tierSpan = next.pointsRequired - prevReq;
  const tierProgress = Math.max(0, pts - prevReq);
  const progressPercent = Math.min(100, Math.max(0, Math.round((tierProgress / tierSpan) * 100)));

  return {
    teeth: next.teeth,
    pointsRequired: next.pointsRequired,
    currentPoints: pts,
    remainingPoints: remaining,
    progressPercent,
  };
}

/**
 * Alias for checkAndUnlockGears for backwards compatibility
 */
export function unlockAvailableGears(points = null) {
  return checkAndUnlockGears(points);
}

/**
 * Requirement 16: Central Point Reward Calculation Function
 * Calculates rewards and bonuses for a level completion without farming duplication.
 *
 * @param {number} levelId
 * @param {Object} performance
 * @param {boolean} performance.isFirstAttempt - Completed on the very first try of this level session
 * @param {boolean} performance.hintUsed - Whether player opened or triggered contextual assistance
 * @param {number} performance.timeSeconds - Elapsed solve time in seconds
 * @param {boolean} performance.isPerfect - True if solved without failed solution checks
 * @returns {Object} Reward calculation result
 */
export function calculateLevelReward(levelId, {
  isFirstAttempt = false,
  hintUsed = false,
  timeSeconds = 0,
  isPerfect = true,
} = {}) {
  const prog = getProgressionData();
  const stats = prog.levelStats[levelId] || {
    completedBefore: false,
    firstAttemptAwarded: false,
    noHintAwarded: false,
    quickSolveAwarded: false,
    perfectAwarded: false,
    bestTime: null,
  };

  const breakdown = [];
  let totalEarned = 0;
  const newBonuses = {};

  // 1. Base Completion Reward (+100) — ONLY first time level is ever completed
  if (!stats.completedBefore) {
    breakdown.push({
      key: 'base',
      label: 'LEVEL COMPLETE',
      points: POINT_REWARDS.BASE_COMPLETION,
    });
    totalEarned += POINT_REWARDS.BASE_COMPLETION;
    newBonuses.completedBefore = true;
  }

  // 2. First Attempt Bonus (+25) — Awarded only once
  if (isFirstAttempt && !stats.firstAttemptAwarded) {
    breakdown.push({
      key: 'firstAttempt',
      label: 'FIRST ATTEMPT',
      points: POINT_REWARDS.FIRST_ATTEMPT,
    });
    totalEarned += POINT_REWARDS.FIRST_ATTEMPT;
    newBonuses.firstAttemptAwarded = true;
  }

  // 3. No Hint Bonus (+25) — Awarded only once
  if (!hintUsed && !stats.noHintAwarded) {
    breakdown.push({
      key: 'noHint',
      label: 'NO HINT USED',
      points: POINT_REWARDS.NO_HINT,
    });
    totalEarned += POINT_REWARDS.NO_HINT;
    newBonuses.noHintAwarded = true;
  }

  // 4. Quick Solve Bonus (+25) — Awarded only once
  const quickThreshold = getQuickSolveThreshold(levelId);
  const isQuick = timeSeconds >= 0 && timeSeconds <= quickThreshold;
  if (isQuick && !stats.quickSolveAwarded) {
    breakdown.push({
      key: 'quickSolve',
      label: 'QUICK SOLVE',
      points: POINT_REWARDS.QUICK_SOLVE,
    });
    totalEarned += POINT_REWARDS.QUICK_SOLVE;
    newBonuses.quickSolveAwarded = true;
  }

  // 5. Perfect Solution Bonus (+50) — Awarded only once
  if (isPerfect && !stats.perfectAwarded) {
    breakdown.push({
      key: 'perfect',
      label: 'PERFECT SOLUTION',
      points: POINT_REWARDS.PERFECT_SOLUTION,
    });
    totalEarned += POINT_REWARDS.PERFECT_SOLUTION;
    newBonuses.perfectAwarded = true;
  }

  // Phase 16: Track Best Times
  const prevBestTime = (typeof stats.bestTime === 'number' && stats.bestTime > 0) ? stats.bestTime : null;
  const isNewBestTime = (prevBestTime === null) || (timeSeconds > 0 && timeSeconds < prevBestTime);
  const currentBestTime = isNewBestTime ? (timeSeconds > 0 ? timeSeconds : prevBestTime || 0) : prevBestTime;

  // Phase 16: Badges Earned on this attempt
  const earnedBadgesThisRun = [];
  if (!stats.completedBefore) {
    earnedBadgesThisRun.push(BADGE_TYPES.FIRST_SOLVE);
  }
  if (!hintUsed) {
    earnedBadgesThisRun.push(BADGE_TYPES.NO_HINT);
  }
  if (isQuick) {
    earnedBadgesThisRun.push(BADGE_TYPES.QUICK_SOLVE);
  }
  // Requirement 5: PERFECT = Completed first attempt + no hint + quick solve
  if (isFirstAttempt && !hintUsed && isQuick) {
    earnedBadgesThisRun.push(BADGE_TYPES.PERFECT);
  }

  const existingBadges = Array.isArray(stats.badges) ? stats.badges : [];
  const allLevelBadges = Array.from(new Set([...existingBadges, ...earnedBadgesThisRun]));

  return {
    levelId,
    totalEarned,
    breakdown,
    newBonuses,
    isReplay: stats.completedBefore,
    timeSeconds,
    prevBestTime,
    currentBestTime,
    isNewBestTime,
    earnedBadgesThisRun,
    allLevelBadges,
  };
}

/**
 * Commits the earned rewards into persistent progression state.
 * @param {number} levelId
 * @param {Object} rewardResult - Return value from calculateLevelReward
 * @returns {{ totalPoints: number, newlyUnlockedGears: number[], isNewBestTime: boolean, currentBestTime: number, allLevelBadges: string[] }}
 */
export function commitLevelReward(levelId, rewardResult) {
  const prog = getProgressionData();
  const existingStats = prog.levelStats[levelId] || {};

  // Merge newly achieved bonuses and records
  prog.levelStats[levelId] = {
    ...existingStats,
    completedBefore: true,
    firstAttemptAwarded: existingStats.firstAttemptAwarded || rewardResult.newBonuses.firstAttemptAwarded || false,
    noHintAwarded: existingStats.noHintAwarded || rewardResult.newBonuses.noHintAwarded || false,
    quickSolveAwarded: existingStats.quickSolveAwarded || rewardResult.newBonuses.quickSolveAwarded || false,
    perfectAwarded: existingStats.perfectAwarded || rewardResult.newBonuses.perfectAwarded || false,
    bestTime: rewardResult.currentBestTime,
    badges: rewardResult.allLevelBadges,
    lastCompletedAt: Date.now(),
  };

  // Phase 16: Prepend to compact Recent Rewards History (capped at 10)
  if (!Array.isArray(prog.recentRewards)) {
    prog.recentRewards = [];
  }
  const historyEntry = {
    level: levelId,
    points: rewardResult.totalEarned,
    timestamp: Date.now(),
    badges: rewardResult.earnedBadgesThisRun,
    isNewBest: rewardResult.isNewBestTime,
    timeSeconds: rewardResult.timeSeconds,
    bestTime: rewardResult.currentBestTime,
  };
  prog.recentRewards.unshift(historyEntry);
  if (prog.recentRewards.length > 10) {
    prog.recentRewards = prog.recentRewards.slice(0, 10);
  }

  saveProgressionData(prog);

  let newlyUnlockedGears = [];
  let totalPoints = getPlayerPoints();

  if (rewardResult.totalEarned > 0) {
    const res = addPlayerPoints(rewardResult.totalEarned);
    totalPoints = res.newPoints;
    newlyUnlockedGears = res.newlyUnlockedGears;
  }

  return {
    totalPoints,
    newlyUnlockedGears,
    isNewBestTime: rewardResult.isNewBestTime,
    currentBestTime: rewardResult.currentBestTime,
    allLevelBadges: rewardResult.allLevelBadges,
    earnedBadgesThisRun: rewardResult.earnedBadgesThisRun,
  };
}

/**
 * Returns saved performance stats for a given level.
 * @param {number} levelId
 * @returns {Object}
 */
export function getLevelStats(levelId) {
  const prog = getProgressionData();
  const stats = (prog.levelStats && prog.levelStats[levelId]) ? prog.levelStats[levelId] : null;
  if (!stats) {
    return {
      completedBefore: false,
      firstAttemptAwarded: false,
      noHintAwarded: false,
      quickSolveAwarded: false,
      perfectAwarded: false,
      bestTime: null,
      badges: [],
    };
  }
  return {
    ...stats,
    badges: Array.isArray(stats.badges) ? stats.badges : [],
  };
}

/**
 * Calculates total badges count and breakdown across all completed levels.
 * @returns {{ totalBadges: number, perfectLevelsCount: number, badgesMap: Object }}
 */
export function getAllBadgesEarned() {
  const prog = getProgressionData();
  let totalBadges = 0;
  let perfectLevelsCount = 0;
  const badgesMap = {};

  if (prog.levelStats) {
    Object.keys(prog.levelStats).forEach(lvl => {
      const stats = prog.levelStats[lvl];
      if (stats && Array.isArray(stats.badges)) {
        stats.badges.forEach(b => {
          totalBadges++;
          badgesMap[b] = (badgesMap[b] || 0) + 1;
          if (b === BADGE_TYPES.PERFECT) {
            perfectLevelsCount++;
          }
        });
      }
    });
  }

  return {
    totalBadges,
    perfectLevelsCount,
    badgesMap,
  };
}

/**
 * Returns recent reward entries (up to limit, defaults to 10).
 * @param {number} [limit=10]
 * @returns {Array}
 */
export function getRecentRewards(limit = 10) {
  const prog = getProgressionData();
  if (!Array.isArray(prog.recentRewards)) return [];
  return prog.recentRewards.slice(0, limit);
}

/**
 * Returns total count of completed levels (combining levelStats and legacy completed list).
 * @returns {number}
 */
export function getCompletedLevelsCount() {
  const prog = getProgressionData();
  const statsCount = prog.levelStats
    ? Object.keys(prog.levelStats).filter(k => prog.levelStats[k] && prog.levelStats[k].completedBefore).length
    : 0;

  let legacyCount = 0;
  try {
    const raw = localStorage.getItem(POINTS_STORAGE_KEYS.LEGACY_COMPLETED);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) legacyCount = parsed.length;
    }
  } catch (e) {}

  return Math.min(100, Math.max(statsCount, legacyCount));
}

/**
 * Returns complete summary object for Player Progress dashboard.
 * @returns {Object}
 */
export function getProgressionSummary() {
  const points = getPlayerPoints();
  const unlockedGears = getPersistedUnlockedGears();
  const completedCount = getCompletedLevelsCount();
  const nextGear = getNextLockedGear(points);
  const badgesInfo = getAllBadgesEarned();
  const recent = getRecentRewards(10);

  return {
    totalPoints: points,
    gearsUnlocked: unlockedGears.length,
    totalGears: GEAR_UNLOCKS.length, // 10
    levelsCompleted: completedCount,
    totalLevels: 100,
    badgesEarned: badgesInfo.totalBadges,
    perfectCount: badgesInfo.perfectLevelsCount,
    bestPerformance: badgesInfo.perfectLevelsCount > 0 ? `${badgesInfo.perfectLevelsCount} PERFECT` : `${completedCount} COMPLETED`,
    nextGear,
    recentRewards: recent,
  };
}

/**
 * Validates whether all gears required to solve a level are currently unlocked.
 * @param {Object} level - Level definition object
 * @param {number[]} unlockedGears - List of currently unlocked teeth counts
 * @returns {{ canPlay: boolean, missingGears: number[] }}
 */
export function validateLevelGearRequirement(level, unlockedGears = null) {
  if (!level) return { canPlay: true, missingGears: [] };
  const unlocked = unlockedGears || getUnlockedGears();

  const motor = level.motorRPM || level.inputRPM;
  const target = level.targetRPM;
  const gears = level.availableGears || [10, 20, 30, 40, 50, 60];
  const requireSep = level.requireSeparateGears !== false;

  // Check if at least one valid solution exists using currently unlocked gears
  let hasUnlockedSolution = false;
  const missingCandidates = new Set();

  for (const inG of gears) {
    for (const outG of gears) {
      if (requireSep && inG === outG) continue;
      const rpm = (motor * inG) / outG;
      if (Math.abs(rpm - target) <= 0.5) {
        if (unlocked.includes(inG) && unlocked.includes(outG)) {
          hasUnlockedSolution = true;
          break;
        } else {
          if (!unlocked.includes(inG)) missingCandidates.add(inG);
          if (!unlocked.includes(outG)) missingCandidates.add(outG);
        }
      }
    }
    if (hasUnlockedSolution) break;
  }

  return {
    canPlay: hasUnlockedSolution,
    missingGears: Array.from(missingCandidates),
  };
}

/**
 * Requirement 15: Safe Progression Migration
 * If an older save exists without points, initializes points and gear unlock data
 * based on already completed levels so existing users do not lose anything.
 */
export function migrateExistingProgress() {
  try {
    const rawPoints = localStorage.getItem(POINTS_STORAGE_KEYS.POINTS);
    const rawProg = localStorage.getItem(POINTS_STORAGE_KEYS.PROGRESSION);
    const rawCompleted = localStorage.getItem(POINTS_STORAGE_KEYS.LEGACY_COMPLETED);

    let completedList = [];
    if (rawCompleted) {
      try {
        const parsed = JSON.parse(rawCompleted);
        if (Array.isArray(parsed)) completedList = parsed;
      } catch (e) {}
    }

    // Only migrate if points or progression have never been initialized
    if (rawPoints === null && rawProg === null && completedList.length > 0) {
      console.log(`[GearFactory3D Points] Migrating legacy progress for ${completedList.length} completed levels...`);
      // Award retroactive 150 points per completed level (average of base + bonuses)
      const retroPoints = completedList.length * 150;
      const prog = createInitialProgression();
      prog.points = retroPoints;

      completedList.forEach(lvl => {
        prog.levelStats[lvl] = {
          completedBefore: true,
          firstAttemptAwarded: true,
          noHintAwarded: true,
          quickSolveAwarded: false,
          perfectAwarded: false,
          bestTime: 25,
          lastCompletedAt: Date.now(),
        };
      });

      saveProgressionData(prog);
      localStorage.setItem(POINTS_STORAGE_KEYS.POINTS, retroPoints.toString());
      console.log(`[GearFactory3D Points] Migration complete. Initialized points: ${retroPoints}`);
    } else if (rawPoints !== null && rawProg === null) {
      // Points exist but progression data object is missing
      const pts = parseInt(rawPoints, 10) || 0;
      const prog = createInitialProgression();
      prog.points = pts;
      completedList.forEach(lvl => {
        prog.levelStats[lvl] = {
          completedBefore: true,
          firstAttemptAwarded: true,
          noHintAwarded: true,
          quickSolveAwarded: false,
          perfectAwarded: false,
          bestTime: null,
        };
      });
      saveProgressionData(prog);
    } else if (rawProg !== null) {
      // Existing progression object exists: verify all fields are initialized (Phase 16 migration)
      try {
        const prog = JSON.parse(rawProg);
        let changed = false;
        if (!Array.isArray(prog.recentRewards)) {
          prog.recentRewards = [];
          changed = true;
        }
        if (!prog.levelStats || typeof prog.levelStats !== 'object') {
          prog.levelStats = {};
          changed = true;
        } else {
          Object.keys(prog.levelStats).forEach(lvl => {
            const st = prog.levelStats[lvl];
            if (st && typeof st === 'object') {
              if (!Array.isArray(st.badges)) {
                st.badges = [];
                if (st.completedBefore) st.badges.push(BADGE_TYPES.FIRST_SOLVE);
                if (st.noHintAwarded) st.badges.push(BADGE_TYPES.NO_HINT);
                if (st.quickSolveAwarded) st.badges.push(BADGE_TYPES.QUICK_SOLVE);
                if (st.perfectAwarded) st.badges.push(BADGE_TYPES.PERFECT);
                changed = true;
              }
              if (typeof st.bestTime !== 'number' && st.bestTime !== null) {
                st.bestTime = null;
                changed = true;
              }
            }
          });
        }
        if (changed) {
          saveProgressionData(prog);
        }
      } catch (e) {}
    }
    // Always run automatic gear unlock check to guarantee all eligible gears are unlocked
    checkAndUnlockGears();
  } catch (e) {
    console.warn('[GearFactory3D Points] Migration check failed:', e);
  }
}

/**
 * Requirement 17: Complete Progress Reset (with Confirmation)
 * Explicitly clears points, progression, and completed levels.
 * Only accessible via Settings with confirmation dialog.
 */
export function resetAllProgress() {
  try {
    localStorage.removeItem(POINTS_STORAGE_KEYS.POINTS);
    localStorage.removeItem(POINTS_STORAGE_KEYS.PROGRESSION);
    localStorage.removeItem(POINTS_STORAGE_KEYS.UNLOCKED_GEARS);
    localStorage.removeItem(POINTS_STORAGE_KEYS.LEGACY_COMPLETED);
    localStorage.removeItem(POINTS_STORAGE_KEYS.LEGACY_HIGHEST);
    savePersistedUnlockedGears([10, 20, 30, 40, 50]);
    console.log('[GearFactory3D Points] All player progress and points reset.');
  } catch (e) {
    console.warn('[GearFactory3D Points] Failed to clear localStorage:', e);
  }
}
