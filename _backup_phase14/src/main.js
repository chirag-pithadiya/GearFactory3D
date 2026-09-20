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

import * as THREE from 'three';
import { scene, initRenderer, render, getRenderer } from './scene.js';
import { camera, updateCameraAspect, resetCamera, defaultCameraPos, defaultTargetPos } from './camera.js';
import { setupLighting } from './lighting.js';
import { initControls, updateControls, resetControls, getControls } from './controls.js';
import {
  state,
  puzzleState,
  GEAR_MODULE,
  GEAR_INVENTORY,
  calculateGearRatio,
  calculateOutputRPM,
  calculateGearOuterRadius,
  debugTelemetry,
  getContextualHint,
} from './game-state.js';
import {
  levelData,
  getLevel,
  getTotalLevels,
  checkLevelSolution,
  validateLevels,
  getHighestUnlockedLevel,
  setHighestUnlockedLevel,
  getCompletedLevels,
  setLevelCompleted,
  isLevelUnlocked,
  isLevelCompleted,
  getNextIncompleteLevel,
} from './levels.js';
import { audio } from './audio.js';
import { buildGearTrain, createGearboxCasing, createLabel } from './gearbox.js';
import { createSpurGear, createGear } from './gears.js';
import { createMotor } from './motor.js';
import { createShaft } from './shafts.js';
import {
  createBallBearing,
  createBearing,
  createBearingHousing,
  createShaftSupport,
  createMountingFeet,
} from './bearings.js';
import {
  elements,
  initUI,
  updateSelectedGearsUI,
  updateVerificationUI,
  setPuzzleStatusUI,
  showSuccessBanner,
  showFailBanner,
  hideBanners,
  updateLevelObjectiveUI,
  updateLiveHUDDisplay,
  setRunningStateUI,
  setLabelToggleUI,
  updateRealtimeRPMUI,
  renderAvailableGears,
  openLevelSelectModal,
  closeLevelSelectModal,
  renderLevelSelectModal,
  openMainMenu,
  closeMainMenu,
  openPauseModal,
  closePauseModal,
  openSettingsModal,
  closeSettingsModal,
  showLevelIntro,
  closeLevelIntro,
  showLevelComplete,
  closeLevelComplete,
  formatTimer,
  updateTimerDisplay,
  updateSettingsUI,
  updateContextualHintUI,
  openHowGearsModal,
  closeHowGearsModal,
  openRpmInfoModal,
  closeRpmInfoModal,
  openWelcomeModal,
  closeWelcomeModal,
  checkFirstTimeWelcome,
} from './ui.js';
import {
  initDragDrop,
  startGearDrag,
  updateGearDrag,
  finishGearDrag,
  clearDragState,
  returnGearToInventory,
  updateDropTargetPositions,
  dragDropState,
} from './drag-drop.js';
import {
  startTutorial,
  skipTutorial,
  completeTutorial,
  setTutorialStep,
  initTutorial,
  tutorialState,
  isTutorialCompleted,
  setTutorialCompleted,
} from './tutorial.js';

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
export const kinetics = {
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

export function recalculateKinetics() {
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
export function checkGearMesh() {
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
