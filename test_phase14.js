/**
 * Gear Factory 3D — Phase 14 Test Suite
 * Automated tests for 100-level expansion
 */
window.__phase14 = {
  // Test 1: Validate all 100 levels
  runValidation: function() {
    const gf = window.gearFactory;
    if (!gf) return { error: 'window.gearFactory not found' };

    const total = gf.getTotalLevels();
    const v = gf.validateLevels();
    const lvl101 = gf.getLevel ? gf.getLevel(101) : null;
    const allLevels = gf.levelData;

    const ids = allLevels.map(l => l.level);
    const uniqueIds = new Set(ids);
    const hasDuplicates = uniqueIds.size !== allLevels.length;

    // Check every level has valid properties
    const propertyErrors = [];
    allLevels.forEach(l => {
      if (!l.level || l.level < 1 || l.level > 100) propertyErrors.push(`Lvl ${l.level}: invalid id`);
      if (!l.difficulty) propertyErrors.push(`Lvl ${l.level}: missing difficulty`);
      if (!l.motorRPM || l.motorRPM <= 0) propertyErrors.push(`Lvl ${l.level}: invalid motorRPM`);
      if (!l.targetRPM || l.targetRPM <= 0) propertyErrors.push(`Lvl ${l.level}: invalid targetRPM`);
      if (!Array.isArray(l.availableGears) || l.availableGears.length === 0) propertyErrors.push(`Lvl ${l.level}: missing availableGears`);
      if (!l.objective) propertyErrors.push(`Lvl ${l.level}: missing objective`);
    });

    return {
      totalLevels: total,
      allPass: v.allPass,
      validCount: v.results.filter(r => r.valid).length,
      failedLevels: v.results.filter(r => !r.valid).map(r => r.level),
      hasLevel101: lvl101 !== null,
      hasDuplicates: hasDuplicates,
      firstLevelId: ids[0],
      lastLevelId: ids[ids.length - 1],
      propertyErrorsCount: propertyErrors.length,
      propertyErrors: propertyErrors.slice(0, 10)
    };
  },

  // Test 2: Check preservation of Levels 1–50
  testPreservedLevels: function() {
    const gf = window.gearFactory;
    return [1, 10, 20, 30, 40, 50].map(id => {
      const l = gf.getLevel(id);
      return {
        level: l.level,
        motorRPM: l.motorRPM,
        targetRPM: l.targetRPM,
        difficulty: l.difficulty,
        hasGears: l.availableGears && l.availableGears.length > 0
      };
    });
  },

  // Test 3: Test interactive gameplay on anchor and milestone levels
  testSampleGameplay: function(sampleTests) {
    const gf = window.gearFactory;
    const results = [];
    if (gf.setHighestUnlockedLevel) gf.setHighestUnlockedLevel(100);

    sampleTests.forEach(st => {
      gf.loadLevel(st.id);
      if (gf.closeLevelIntro) gf.closeLevelIntro();
      gf.placeInputGear(st.inT);
      gf.placeOutputGear(st.outT);
      gf.setRunningState(true);
      const isCorrect = gf.checkSolution();
      const calcRPM = gf.puzzleState.lastCalculatedRPM;
      const highestUnlocked = gf.getHighestUnlockedLevel();

      results.push({
        id: st.id,
        desc: st.desc,
        inT: st.inT,
        outT: st.outT,
        expRPM: st.expRPM,
        calcRPM: calcRPM,
        isCorrect: isCorrect,
        highestUnlocked: highestUnlocked,
        pass: isCorrect && Math.abs(calcRPM - st.expRPM) < 0.5
      });
    });

    return results;
  },

  // Test 4: Level 100 Campaign Completion
  testLevel100Completion: function() {
    const gf = window.gearFactory;
    if (gf.setHighestUnlockedLevel) gf.setHighestUnlockedLevel(100);
    gf.loadLevel(100);
    if (gf.closeLevelIntro) gf.closeLevelIntro();
    gf.placeInputGear(60);
    gf.placeOutputGear(50);
    gf.setRunningState(true);
    const isCorrect = gf.checkSolution();

    const modal = document.getElementById('level-complete-modal');
    const modalTitle = modal ? modal.querySelector('.modal-title')?.textContent.trim() : '';
    const modalEyebrow = modal ? modal.querySelector('.modal-eyebrow')?.textContent.trim() : '';
    const nextBtn = document.getElementById('btn-modal-next-level');
    const nextBtnDisplay = nextBtn ? nextBtn.style.display : '';
    const highestUnlocked = gf.getHighestUnlockedLevel();

    return {
      isCorrect: isCorrect,
      modalVisible: modal ? modal.style.display === 'flex' : false,
      modalTitle: modalTitle,
      modalEyebrow: modalEyebrow,
      nextBtnHidden: nextBtnDisplay === 'none',
      highestUnlocked: highestUnlocked,
      currentLevel: gf.currentLevel
    };
  },

  // Test 5: Level Select Modal (100 Levels Grid & Chapter Tabs)
  testLevelSelectUI: function() {
    const gf = window.gearFactory;
    if (gf.closeWelcomeModal) gf.closeWelcomeModal();
    if (gf.closeLevelIntro) gf.closeLevelIntro();
    if (gf.closeLevelComplete) gf.closeLevelComplete();
    gf.openLevelSelectModal();
    const modal = document.getElementById('level-select-modal');
    const tiles = modal ? modal.querySelectorAll('.level-tile') : [];
    const tabs = modal ? modal.querySelectorAll('.level-tab-btn') : [];
    const tabLabels = Array.from(tabs).map(t => t.textContent.trim());

    // Test clicking a tab to filter (e.g. 51-75)
    let filterTestPassed = false;
    if (tabs.length >= 4) {
      tabs[3].click(); // tab '51-75'
      const visibleSections = Array.from(modal.querySelectorAll('.tier-section')).filter(s => s.style.display !== 'none');
      filterTestPassed = visibleSections.length > 0 && visibleSections.length < 12;
      // Click back to All
      tabs[0].click();
    }

    return {
      modalVisible: modal && modal.style.display === 'flex',
      totalTilesCount: tiles.length,
      tabCount: tabs.length,
      tabLabels: tabLabels,
      filterTestPassed: filterTestPassed
    };
  },

  // Prep for screenshots
  prepareLevel: function(levelNum, inT, outT) {
    const gf = window.gearFactory;
    if (gf.setHighestUnlockedLevel) gf.setHighestUnlockedLevel(100);
    gf.loadLevel(levelNum);
    if (gf.closeLevelIntro) gf.closeLevelIntro();
    if (gf.closeWelcomeModal) gf.closeWelcomeModal();
    if (gf.closeLevelComplete) gf.closeLevelComplete();
    if (gf.closeLevelSelectModal) gf.closeLevelSelectModal();
    if (inT) gf.placeInputGear(inT);
    if (outT) gf.placeOutputGear(outT);
    gf.setRunningState(true);
    return true;
  }
};
