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

import * as THREE from 'three';
import { GEAR_MODULE } from './game-state.js';
import { createSpurGear } from './gears.js';
import { audio } from './audio.js';
import { isGearUnlocked } from './points.js';

export const dragDropState = {
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
export function createShaftDropTargets(scene, shaftY = 5.3, posZInput = -2.3, posZOutput = 2.3) {
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
export function updateDropTargetPositions(shaftY, posZInput, posZOutput) {
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
export function startGearDrag(teeth, event) {
  if (!teeth || dragDropState.isDragging || !isGearUnlocked(teeth)) return;
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
export function updateGearDrag(event) {
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
export function finishGearDrag(event) {
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
export function returnGearToInventory(teeth) {
  clearDragState();
}

/**
 * Resets drag state, disposes preview mesh, and hides visual highlights.
 */
export function clearDragState() {
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
export function initDragDrop(options = {}) {
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
export function bindCardDragListeners() {
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
      if (!teeth || card.classList.contains('locked') || !isGearUnlocked(teeth)) return;

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
        if (!teeth || card.classList.contains('locked') || !isGearUnlocked(teeth)) return;

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
