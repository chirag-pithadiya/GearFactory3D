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

export const TUTORIAL_STORAGE_KEY = 'tutorialCompleted';

export const tutorialState = {
  isActive: false,
  currentStep: 0,
  callbacks: {},
};

export function isTutorialCompleted() {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true';
}

export function setTutorialCompleted() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
  }
}

export function resetTutorialState() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  }
}

/**
 * Initializes tutorial controller with app callbacks.
 */
export function initTutorial(callbacks = {}) {
  tutorialState.callbacks = callbacks;
}

/**
 * Starts Tutorial from Step 0 (Intro).
 */
export function startTutorial() {
  tutorialState.isActive = true;
  tutorialState.currentStep = 0;
  showTutorialStep(0);
}

/**
 * Advances tutorial to specified or next step.
 */
export function setTutorialStep(stepNumber) {
  if (!tutorialState.isActive) return;
  tutorialState.currentStep = stepNumber;
  showTutorialStep(stepNumber);
}

export function nextTutorialStep() {
  if (!tutorialState.isActive) return;
  setTutorialStep(tutorialState.currentStep + 1);
}

/**
 * Skips the tutorial and transitions directly to Level 1.
 */
export function skipTutorial() {
  tutorialState.isActive = false;
  hideAllTutorialUI();
  if (tutorialState.callbacks.onSkip) {
    tutorialState.callbacks.onSkip();
  }
}

/**
 * Completes the tutorial, records persistence, and displays completion UI.
 */
export function completeTutorial() {
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
