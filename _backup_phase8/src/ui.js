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

import { GEAR_INVENTORY } from './game-state.js';

// DOM Element References Cache
export const elements = {
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
export function initUI(handlers = {}) {
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
export function createGearInventory(onSelectGear, onSelectInput, onSelectOutput) {
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
export function updateSelectedGearsUI(selectedInputTeeth, selectedOutputTeeth, selectedInventoryGear = null, requireSeparateGears = true) {
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
export function updateVerificationUI(selectedInputTeeth, selectedOutputTeeth, targetRPM, calculatedRPM, hasChecked, isPass) {
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
export function setPuzzleStatusUI(text, type = 'pending') {
  if (elements.puzzleStatusText) {
    elements.puzzleStatusText.textContent = text;
  }
  if (elements.puzzleGameStatus) {
    elements.puzzleGameStatus.className = `puzzle-status-badge status-${type}`;
  }
}

export function showSuccessBanner(message) {
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

export function showFailBanner(message) {
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

export function hideBanners() {
  if (elements.puzzleSuccessBanner) elements.puzzleSuccessBanner.style.display = 'none';
  if (elements.puzzleFailBanner) elements.puzzleFailBanner.style.display = 'none';
}

/**
 * Updates level objective badges (Current Level, Motor Input RPM, Target RPM).
 */
export function updateLevelObjectiveUI(levelNumber, totalLevels, inputRPM, targetRPM, difficulty = 'EASY', objective = '') {
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
export function updateLiveHUDDisplay(inRPM, outRPM, maxMeterRPM = 150) {
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
export function setRunningStateUI(isRunning) {
  if (elements.statusBadge) {
    elements.statusBadge.classList.toggle('active', isRunning);
    elements.statusBadge.classList.toggle('stopped', !isRunning);
  }
  if (elements.statusLabel) {
    elements.statusLabel.textContent = isRunning ? 'RUNNING' : 'STOPPED';
  }
}

export function setLabelToggleUI(isVisible) {
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
export function updateRealtimeRPMUI(motorRPM, inputRPM, outputRPM, isEngaged = false) {
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
export function renderAvailableGears(availableGears = [10, 20, 30, 40, 50, 60]) {
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
export function openLevelSelectModal() {
  if (elements.levelSelectModal) {
    elements.levelSelectModal.style.display = 'flex';
  }
}

export function closeLevelSelectModal() {
  if (elements.levelSelectModal) {
    elements.levelSelectModal.style.display = 'none';
  }
}

export function renderLevelSelectModal(levels, completedList = [], highestUnlocked = 1, currentLevel = 1, onSelectLevel) {
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

export function openMainMenu() {
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'flex';
}

export function closeMainMenu() {
  if (elements.mainMenuModal) elements.mainMenuModal.style.display = 'none';
}

export function openPauseModal() {
  if (elements.pauseModal) elements.pauseModal.style.display = 'flex';
}

export function closePauseModal() {
  if (elements.pauseModal) elements.pauseModal.style.display = 'none';
}

export function openSettingsModal() {
  if (elements.settingsModal) elements.settingsModal.style.display = 'flex';
}

export function closeSettingsModal() {
  if (elements.settingsModal) elements.settingsModal.style.display = 'none';
}

export function updateSettingsUI(soundEnabled, musicEnabled) {
  if (elements.btnToggleSound) {
    elements.btnToggleSound.textContent = soundEnabled ? 'ON' : 'OFF';
    elements.btnToggleSound.classList.toggle('active', !!soundEnabled);
  }
  if (elements.btnToggleMusic) {
    elements.btnToggleMusic.textContent = musicEnabled ? 'ON' : 'OFF';
    elements.btnToggleMusic.classList.toggle('active', !!musicEnabled);
  }
}

export function showLevelIntro(level, onStart) {
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

export function closeLevelIntro() {
  if (elements.levelIntroModal) elements.levelIntroModal.style.display = 'none';
}

export function showLevelComplete(targetRPM, outputRPM, timeStr, callbacks = {}) {
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

export function closeLevelComplete() {
  if (elements.levelCompleteModal) elements.levelCompleteModal.style.display = 'none';
}

export function formatTimer(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export function updateTimerDisplay(totalSeconds) {
  const formatted = formatTimer(totalSeconds);
  if (elements.levelTimerDisplay) {
    elements.levelTimerDisplay.textContent = `TIME ${formatted}`;
  }
  return formatted;
}
