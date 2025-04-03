// interactions.js - Handles all gesture and controller interactions
import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkGestureCameraManipulator from '@kitware/vtk.js/Interaction/Manipulators/GestureCameraManipulator';
import vtkMouseCameraTrackballRotateManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseRangeManipulator';
import vtkPinchCameraManipulator from '@kitware/vtk.js/Interaction/Manipulators/PinchCameraManipulator';

// VR specific controllers
import vtkVRButtonWidget from '@kitware/vtk.js/Widgets/Widgets3D/VRButtonWidget';
import vtkWidgetManager from '@kitware/vtk.js/Widgets/Core/WidgetManager';
import { VRControllerManager } from './controllers-js';

/**
 * Sets up desktop and touch interactions 
 * @param {vtkRenderer} renderer The main renderer
 * @param {vtkRenderWindow} renderWindow The render window
 * @param {Object} actors Object containing all actors that can be manipulated
 * @returns {vtkInteractorStyleManipulator} The configured interaction style
 */
export function setupStandardInteractions(renderer, renderWindow, actors = {}) {
  const interactor = renderWindow.getInteractor();
  
  // Create and configure the interaction style
  const istyle = vtkInteractorStyleManipulator.newInstance();
  interactor.setInteractorStyle(istyle);

  // Add mouse camera manipulators
  istyle.addMouseManipulator(vtkMouseCameraTrackballRotateManipulator.newInstance());
  istyle.addMouseManipulator(vtkMouseCameraTrackballPanManipulator.newInstance({ button: 2 }));
  istyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 }));
  
  // Add touch manipulators
  istyle.addGestureManipulator(vtkGestureCameraManipulator.newInstance());
  istyle.addGestureManipulator(vtkPinchCameraManipulator.newInstance());

  // Setup model scaling interaction
  const rangeManipulator = vtkMouseRangeManipulator.newInstance({
    button: 1,
    scrollEnabled: true,
  });
  
  // Add scaling for primary actor if available
  if (actors.primary) {
    rangeManipulator.setVerticalListener(
      0.5, 2.0, 
      0.1,
      (scale) => {
        const currentScale = actors.primary.getScale();
        actors.primary.setScale(scale, scale, scale);
        renderWindow.render();
        return scale;
      }
    );
  }
  
  istyle.addMouseManipulator(rangeManipulator);
  
  // Return the style so it can be further customized if needed
  return istyle;
}

/**
 * Sets up VR-specific interactions and controllers
 * @param {vtkWebXRRenderWindowHelper} XRHelper The WebXR helper
 * @param {vtkRenderer} renderer The main renderer
 * @param {vtkRenderWindow} renderWindow The render window
 * @param {Object} actors Object containing all actors that can be manipulated
 */
export function setupVRInteractions(XRHelper, renderer, renderWindow, actors = {}) {
  // Initialize the VR controller manager
  const controllerManager = new VRControllerManager(XRHelper, renderer, renderWindow);
  controllerManager.initialize();

  // Setup pinch gesture for scaling
  controllerManager.setupPinchGesture(actors.primary);

  // Setup grab interaction for the primary actor
  controllerManager.setupGrabInteraction(actors.primary);

  // Enable laser pointer interaction
  controllerManager.enableLaserPointer(actors.pickable);

  // Handle controller button presses
  XRHelper.setControllerConnectedCallback((event) => {
    const { controller } = event;

    // Trigger haptic pulse on button press
    controller.addEventListener('selectstart', () => {
      controller.pulse(0.5, 50);
    });

    controller.addEventListener('squeezestart', () => {
      controller.pulse(0.5, 50);
    });
  });
  
  return controllerManager;
}

/**
 * Setup different interaction modes that can be toggled
 * @param {vtkRenderer} renderer The renderer
 * @param {vtkRenderWindow} renderWindow The render window
 * @param {Object} actors Available actors to interact with
 * @returns {Object} The interaction modes object
 */
export function setupInteractionModes(renderer, renderWindow, actors = {}) {
  // Different interaction modes
  const modes = {
    ROTATE: 'rotate',
    SCALE: 'scale',
    TRANSLATE: 'translate',
    INSPECT: 'inspect'
  };
  
  // Current active mode
  let currentMode = modes.ROTATE;
  
  // The interaction style
  const interactor = renderWindow.getInteractor();
  const istyle = vtkInteractorStyleManipulator.newInstance();
  interactor.setInteractorStyle(istyle);
  
  // Manipulators for each mode
  const rotateManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance();
  const panManipulator = vtkMouseCameraTrackballPanManipulator.newInstance();
  const zoomManipulator = vtkMouseCameraTrackballZoomManipulator.newInstance();
  
  // Setup scaling manipulator
  const scaleManipulator = vtkMouseRangeManipulator.newInstance({
    button: 1,
    scrollEnabled: true,
  });
  
  if (actors.primary) {
    scaleManipulator.setVerticalListener(
      0.5, 2.0, 
      0.1,
      (scale) => {
        const actor = actors.primary;
        actor.setScale(scale, scale, scale);
        renderWindow.render();
        return scale;
      }
    );
  }
  
  // Function to set the active mode
  function setMode(mode) {
    // Clear existing manipulators
    istyle.removeAllMouseManipulators();
    
    // Add appropriate manipulators based on the mode
    switch (mode) {
      case modes.ROTATE:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(panManipulator.setButton(2));
        istyle.addMouseManipulator(zoomManipulator.setButton(3));
        break;
        
      case modes.SCALE:
        istyle.addMouseManipulator(scaleManipulator);
        istyle.addMouseManipulator(panManipulator.setButton(2));
        istyle.addMouseManipulator(rotateManipulator.setButton(3));
        break;
        
      case modes.TRANSLATE:
        istyle.addMouseManipulator(panManipulator.setButton(1));
        istyle.addMouseManipulator(rotateManipulator.setButton(2));
        istyle.addMouseManipulator(zoomManipulator.setButton(3));
        break;
        
      case modes.INSPECT:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(zoomManipulator.setButton(3));
        // Add a picker for inspection
        // TODO: Implement detailed picking functionality
        break;
        
      default:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(panManipulator.setButton(2));
        istyle.addMouseManipulator(zoomManipulator.setButton(3));
    }
    
    currentMode = mode;
    renderWindow.render();
  }
  
  // Initialize with default mode
  setMode(currentMode);
  
  // Return the API
  return {
    modes,
    setMode,
    getCurrentMode: () => currentMode
  };
}

/**
 * Makes an actor pickable and interactive
 * @param {vtkActor} actor The actor to make interactive
 * @param {vtkRenderer} renderer The renderer
 * @param {vtkRenderWindow} renderWindow The render window
 */
export function makeActorInteractive(actor, renderer, renderWindow) {
  // Make sure the actor is pickable
  actor.getProperty().setInterpolationToPhong();
  
  // Store initial state
  actor.userData = {
    initialPosition: actor.getPosition(),
    initialScale: actor.getScale(),
    initialRotation: actor.getRotation(),
    selected: false
  };
  
  // Add methods for interaction
  actor.reset = function() {
    this.setPosition(...this.userData.initialPosition);
    this.setScale(...this.userData.initialScale);
    this.setRotation(...this.userData.initialRotation);
    renderWindow.render();
  };
  
  actor.highlight = function(enabled = true) {
    if (enabled) {
      this.getProperty().setColor(1.0, 0.8, 0.1);
    } else {
      this.getProperty().setColor(1.0, 1.0, 1.0);
    }
    renderWindow.render();
  };
  
  return actor;
}
