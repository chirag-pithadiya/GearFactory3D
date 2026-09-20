/**
 * Gear Factory 3D — Phase 15 Comprehensive Test Suite
 * Validates Points System, Anti-Farming Protection, Gear Unlocks, and Levels 1-100.
 */
window.__phase15 = {
  // 1. Test Initial Player Setup & Starter Gears
  testStarterSetup: function() {
    const gf = window.gearFactory;
    if (!gf) return { pass: false, error: 'window.gearFactory not found' };

    // Reset to clean test state
    gf.resetAllProgress();

    const points = gf.getPlayerPoints();
    const unlocked = gf.getUnlockedGears();
    const starterGears = [10, 20, 30, 40, 50];
    const lockedGears = [60, 70, 80, 90, 100];

    const starterCheck = starterGears.every(t => gf.isGearUnlocked(t) && unlocked.includes(t));
    const lockedCheck = lockedGears.every(t => !gf.isGearUnlocked(t) && !unlocked.includes(t));

    return {
      pass: points === 0 && starterCheck && lockedCheck,
      points,
      unlocked,
      starterCheck,
      lockedCheck,
    };
  },

  // 2. Test Level 1 Reward Calculation & Bonuses
  testLevel1Rewards: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();

    // Load Level 1
    gf.loadLevel(1, true);

    // Solve Level 1 (Motor 1000 RPM, Target 500 RPM -> in 20T, out 40T)
    gf.placeInputGear(20);
    gf.placeOutputGear(40);
    gf.setRunningState(true);

    // Solution verification
    const pass = gf.checkSolution();
    const pointsAfter = gf.getPlayerPoints();

    // Max normal reward: 100 base + 25 first attempt + 25 no hint + 25 quick solve + 50 perfect = 225
    const headerVal = document.getElementById('header-points-val')?.textContent;
    const modalEarned = document.getElementById('modal-total-earned')?.textContent;

    return {
      pass: pass && pointsAfter === 225,
      isCorrect: pass,
      pointsAfter,
      headerVal,
      modalEarned,
      expectedPoints: 225,
    };
  },

  // 3. Test Anti-Farming / Replay Duplication Prevention
  testAntiFarming: function() {
    const gf = window.gearFactory;
    const pointsBefore = gf.getPlayerPoints(); // should be 225 from previous solve

    // Replay Level 1
    gf.loadLevel(1, true);
    gf.placeInputGear(20);
    gf.placeOutputGear(40);
    gf.setRunningState(true);

    const pass = gf.checkSolution();
    const pointsAfter = gf.getPlayerPoints();

    // Points MUST remain 225; base and bonuses cannot be farmed repeatedly!
    const noFarming = pointsAfter === pointsBefore;

    return {
      pass: pass && noFarming,
      pointsBefore,
      pointsAfter,
      pointsDiff: pointsAfter - pointsBefore,
      noFarming,
    };
  },

  // 4. Test Gear Unlock Thresholds (60T..100T)
  testUnlockThresholds: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();

    const results = [];
    const thresholds = [
      { pts: 999, shouldUnlock: [], shouldLock: [60, 70, 80, 90, 100] },
      { pts: 1000, shouldUnlock: [60], shouldLock: [70, 80, 90, 100] },
      { pts: 2500, shouldUnlock: [60, 70], shouldLock: [80, 90, 100] },
      { pts: 4500, shouldUnlock: [60, 70, 80], shouldLock: [90, 100] },
      { pts: 7000, shouldUnlock: [60, 70, 80, 90], shouldLock: [100] },
      { pts: 10000, shouldUnlock: [60, 70, 80, 90, 100], shouldLock: [] },
    ];

    thresholds.forEach(th => {
      gf.resetAllProgress();
      gf.addPlayerPoints(th.pts);
      const unlocked = gf.getUnlockedGears();

      const unlockOk = th.shouldUnlock.every(t => gf.isGearUnlocked(t) && unlocked.includes(t));
      const lockOk = th.shouldLock.every(t => !gf.isGearUnlocked(t) && !unlocked.includes(t));
      const nextLocked = gf.getNextLockedGear();

      results.push({
        pointsSet: th.pts,
        unlockOk,
        lockOk,
        pass: unlockOk && lockOk,
        unlockedGears: unlocked,
        nextLockedTeeth: nextLocked ? nextLocked.teeth : null,
      });
    });

    const allPass = results.every(r => r.pass);
    return {
      pass: allPass,
      details: results,
    };
  },

  // 5. Test Locked Gear Drag Prevention & Modal Trigger
  testLockedGearDrag: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress(); // 60T is locked at 0 points

    const is60Unlocked = gf.isGearUnlocked(60);
    const card60 = document.querySelector('.available-gear-card[data-teeth="60"]');

    // Attempt startGearDrag on 60T
    gf.dragDropState.isDragging = false;
    gf.startGearDrag(60);
    const dragRejected = (gf.dragDropState.isDragging === false);

    // Click 60T card
    if (card60) {
      card60.click();
    }
    const lockedModal = document.getElementById('locked-gear-modal');
    const modalVisible = lockedModal && lockedModal.style.display === 'flex';
    const remainingText = document.getElementById('locked-remaining-points')?.textContent;

    if (gf.closeGearInventoryModal) gf.closeGearInventoryModal();
    const closeBtn = document.getElementById('btn-close-locked-gear');
    if (closeBtn) closeBtn.click();

    return {
      pass: !is60Unlocked && dragRejected && modalVisible,
      is60Unlocked,
      dragRejected,
      modalVisible,
      remainingText,
    };
  },

  // 6. Test Unlocked Gear Drag
  testUnlockedGearDrag: function() {
    const gf = window.gearFactory;
    // 20T is starter (unlocked)
    gf.dragDropState.isDragging = false;
    gf.startGearDrag(20);
    const dragStarted = (gf.dragDropState.isDragging === true);
    gf.clearDragState();

    return {
      pass: dragStarted,
      dragStarted,
    };
  },

  // 7. Test Reset Level Isolation
  testResetLevelIsolation: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();
    gf.addPlayerPoints(3250); // Unlocks 60T and 70T
    const ptsBefore = gf.getPlayerPoints();

    gf.loadLevel(1, true);
    gf.placeInputGear(20);
    gf.placeOutputGear(40);

    // Call resetLevel
    gf.resetLevel();

    const ptsAfter = gf.getPlayerPoints();
    const is60StillUnlocked = gf.isGearUnlocked(60);
    const is70StillUnlocked = gf.isGearUnlocked(70);
    const slotsCleared = (!gf.puzzleState.selectedInputTeeth && !gf.puzzleState.selectedOutputTeeth);

    return {
      pass: ptsAfter === ptsBefore && is60StillUnlocked && is70StillUnlocked && slotsCleared,
      ptsBefore,
      ptsAfter,
      slotsCleared,
      is60StillUnlocked,
      is70StillUnlocked,
    };
  },

  // 8. Test Levels 1–100 Mathematical Validation
  testAll100Levels: function() {
    const gf = window.gearFactory;
    const v = gf.validateLevels();
    const total = gf.getTotalLevels();
    const lvl101 = gf.getLevel(101);

    return {
      pass: v.allPass && total === 100 && lvl101 === null,
      totalLevels: total,
      allPass: v.allPass,
      hasLevel101: lvl101 !== null,
    };
  },

  // 9. Test Level 100 Completion & Messaging
  testLevel100Completion: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();
    gf.addPlayerPoints(10000); // Grandmaster points

    if (gf.setHighestUnlockedLevel) gf.setHighestUnlockedLevel(100);
    gf.loadLevel(100, true);

    // Level 100 solution: motor 3000 RPM, target 3600 RPM -> in: 60T, out: 50T (3000 * 60 / 50 = 3600)
    gf.placeInputGear(60);
    gf.placeOutputGear(50);
    gf.setRunningState(true);

    const isCorrect = gf.checkSolution();
    const modalTitle = document.getElementById('modal-title-text')?.textContent;
    const modalEyebrow = document.getElementById('modal-eyebrow-text')?.textContent;
    const nextLevelBtn = document.getElementById('btn-modal-next-level');
    const nextBtnHidden = nextLevelBtn && nextLevelBtn.style.display === 'none';

    return {
      pass: isCorrect && modalTitle?.includes('ALL LEVELS COMPLETE') && nextBtnHidden,
      isCorrect,
      modalTitle,
      modalEyebrow,
      nextBtnHidden,
    };
  },

  // 10. Test Safe Progression Migration
  testMigration: function() {
    const gf = window.gearFactory;
    // Clear progression but simulate 8 completed levels in legacy storage
    localStorage.removeItem('gearFactory3D_points');
    localStorage.removeItem('gearFactory3D_progression');
    localStorage.removeItem('gearFactory3D_unlocked_gears');
    localStorage.setItem('gearfactory_completed_levels', JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8]));

    // Run migration
    gf.migrateExistingProgress();
    const pointsAfter = gf.getPlayerPoints();
    const unlockedAfter = gf.getUnlockedGears();

    // 8 levels * 150 pts = 1,200 points -> 60T unlocked
    const is60Unlocked = gf.isGearUnlocked(60);

    return {
      pass: pointsAfter === 1200 && is60Unlocked,
      points: pointsAfter,
      is60Unlocked,
    };
  },

  // 11. Test Automatic Unlock & Points Immutability (Points are NEVER spent/deducted)
  testAutomaticUnlockAndPointsImmutability: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();
    gf.addPlayerPoints(950);

    const is60InitiallyLocked = !gf.isGearUnlocked(60);
    const initialPoints = gf.getPlayerPoints(); // 950

    // Earn +100 points -> new total 1,050
    const addRes = gf.addPlayerPoints(100);
    const is60NowUnlocked = gf.isGearUnlocked(60);
    const finalPoints = gf.getPlayerPoints();

    // 60T automatically unlocks AND points remain 1,050 (NEVER deducted!)
    const pass = is60InitiallyLocked && is60NowUnlocked && finalPoints === 1050 && addRes.newlyUnlockedGears.includes(60);

    return {
      pass,
      initialPoints,
      finalPoints,
      is60InitiallyLocked,
      is60NowUnlocked,
      newlyUnlockedGears: addRes.newlyUnlockedGears,
    };
  },

  // 12. Test Multiple Thresholds Simultaneous Unlock (e.g. 900 -> 4,900 unlocks 60T, 70T, 80T)
  testMultipleThresholdSimultaneousUnlock: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();
    gf.addPlayerPoints(900);

    const checkInitial = !gf.isGearUnlocked(60) && !gf.isGearUnlocked(70) && !gf.isGearUnlocked(80);

    // Jump by 4,000 points -> 4,900 points
    const addRes = gf.addPlayerPoints(4000);
    const pointsAfter = gf.getPlayerPoints(); // 4900

    const is60Unlocked = gf.isGearUnlocked(60);
    const is70Unlocked = gf.isGearUnlocked(70);
    const is80Unlocked = gf.isGearUnlocked(80);
    const is90Locked = !gf.isGearUnlocked(90);

    const allThreeUnlocked = is60Unlocked && is70Unlocked && is80Unlocked && is90Locked;
    const arrayMatches = [60, 70, 80].every(t => addRes.newlyUnlockedGears.includes(t));
    const pass = checkInitial && allThreeUnlocked && arrayMatches && pointsAfter === 4900;

    return {
      pass,
      pointsAfter,
      newlyUnlockedGears: addRes.newlyUnlockedGears,
      allThreeUnlocked,
    };
  },

  // 13. Test Inventory & Dialog Wording (Zero buy/spend/purchase terms)
  testNoPurchaseTerminology: function() {
    const gf = window.gearFactory;
    gf.resetAllProgress();
    gf.openGearInventoryModal();

    const modalHtml = document.getElementById('gear-inventory-modal')?.innerHTML || '';
    const lockedHtml = document.getElementById('locked-gear-modal')?.innerHTML || '';
    const combined = (modalHtml + ' ' + lockedHtml).toUpperCase();

    const forbidden = ['BUY', 'PURCHASE', 'SPEND', 'UNLOCK NOW'];
    const forbiddenFound = forbidden.filter(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(combined);
    });

    const hasAutoUnlockText = combined.includes('UNLOCKS AUTOMATICALLY');
    const pass = forbiddenFound.length === 0 && hasAutoUnlockText;

    gf.closeGearInventoryModal();

    return {
      pass,
      hasAutoUnlockText,
      forbiddenFound,
    };
  },

  // Run all tests
  runAll: function() {
    const t1 = this.testStarterSetup();
    const t2 = this.testLevel1Rewards();
    const t3 = this.testAntiFarming();
    const t4 = this.testUnlockThresholds();
    const t5 = this.testLockedGearDrag();
    const t6 = this.testUnlockedGearDrag();
    const t7 = this.testResetLevelIsolation();
    const t8 = this.testAll100Levels();
    const t9 = this.testLevel100Completion();
    const t10 = this.testMigration();
    const t11 = this.testAutomaticUnlockAndPointsImmutability();
    const t12 = this.testMultipleThresholdSimultaneousUnlock();
    const t13 = this.testNoPurchaseTerminology();

    const summary = {
      t1_starterSetup: t1,
      t2_level1Rewards: t2,
      t3_antiFarming: t3,
      t4_unlockThresholds: t4,
      t5_lockedGearDrag: t5,
      t6_unlockedGearDrag: t6,
      t7_resetLevelIsolation: t7,
      t8_all100Levels: t8,
      t9_level100Completion: t9,
      t10_migration: t10,
      t11_automaticUnlockImmutability: t11,
      t12_multipleThresholdUnlock: t12,
      t13_noPurchaseTerminology: t13,
      allPassed: t1.pass && t2.pass && t3.pass && t4.pass && t5.pass && t6.pass && t7.pass && t8.pass && t9.pass && t10.pass && t11.pass && t12.pass && t13.pass,
    };

    return summary;
  }
};
