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
 * @param {Object} actors Object containing all actors that can be manipulated
 */
export function setupVRInteractions(XRHelper, renderer, actors = {}) {
  // Create a widget manager for VR controllers
  const widgetManager = vtkWidgetManager.newInstance();
  widgetManager.setRenderer(renderer);

  // For VR mode - setup grab buttons
  const buttonWidget = vtkVRButtonWidget.newInstance();
  const buttonRepresentation = buttonWidget.getWidgetRep();
  buttonRepresentation.setScaleFactor(0.1);
  
  // Setup button appearance
  buttonRepresentation.setOrigin(0.0, 0.0, 0.0);
  buttonRepresentation.setHighlightColor(0.3, 0.3, 1.0);
  buttonRepresentation.setColor(0.9, 0.9, 0.9);
  
  // Add the button to the widget manager
  widgetManager.addWidget(buttonWidget);

  // Setup controller selection/grab behavior
  XRHelper.setControllerConnectedCallback((event) => {
    const { controller } = event;
    console.log('Controller connected:', controller);
    
    // Setup button press behavior
    controller.addEventListener('selectstart', () => {
      console.log('Select started - grabbing object');
      if (actors.primary) {
        // Start grab mode - record starting position
        actors.primary.userData = {
          grabbing: true,
          startPosition: controller.position.clone(),
          objectStartPosition: actors.primary.getPosition()
        };
      }
    });
    
    controller.addEventListener('selectend', () => {
      console.log('Select ended - releasing object');
      if (actors.primary && actors.primary.userData && actors.primary.userData.grabbing) {
        actors.primary.userData.grabbing = false;
      }
    });

    // Setup pinch behavior
    controller.addEventListener('pinchstart', () => {
      console.log('Pinch started - scaling object');
      if (actors.primary) {
        actors.primary.userData = {
          ...actors.primary.userData,
          pinching: true,
          initialScale: actors.primary.getScale()[0]
        };
      }
    });
    
    controller.addEventListener('pinchend', () => {
      console.log('Pinch ended');
      if (actors.primary && actors.primary.userData) {
        actors.primary.userData.pinching = false;
      }
    });
  });

  // Handle controller movements for grabbed objects
  XRHelper.setControllerMovedCallback((event) => {
    const { controller } = event;
    
    // If we're grabbing the object, move it with the controller
    if (actors.primary && 
        actors.primary.userData && 
        actors.primary.userData.grabbing) {
      
      const currentPosition = controller.position;
      const startPosition = actors.primary.userData.startPosition;
      const objectStartPosition = actors.primary.userData.objectStartPosition;
      
      // Calculate the delta movement and apply to object
      const deltaX = currentPosition.x - startPosition.x;
      const deltaY = currentPosition.y - startPosition.y;
      const deltaZ = currentPosition.z - startPosition.z;
      
      actors.primary.setPosition(
        objectStartPosition[0] + deltaX,
        objectStartPosition[1] + deltaY,
        objectStartPosition[2] + deltaZ
      );
    }
    
    // Handle pinch gesture for scaling
    if (actors.primary && 
        actors.primary.userData && 
        actors.primary.userData.pinching) {
      
      const pinchScale = controller.pinchScale || 1.0;
      const newScale = actors.primary.userData.initialScale * pinchScale;
      
      actors.primary.setScale(newScale, newScale, newScale);
    }
  });

  return widgetManager;
}

/**
 * Enable laser pointer interaction for VR controllers
 * @param {vtkWebXRRenderWindowHelper} XRHelper The WebXR helper
 * @param {vtkRenderer} renderer The main renderer
 * @param {Object} actors Object containing all actors that can be manipulated
 */
export function setupLaserPointerInteraction(XRHelper, renderer, actors = {}) {
  // Enable the controller ray for pointer interaction
  XRHelper.setDrawControllersRay(true);
  
  // Setup callback for laser pointer intersection
  XRHelper.setRayIntersectionCallback((event) => {
    const { controller, worldPickPoint } = event;
    
    // Check if we're pointing at any pickable actors
    if (actors.pickable && actors.pickable.length > 0) {
      const ray = {
        origin: controller.position.toArray(),
        direction: controller.direction.toArray(),
      };
      
      // TODO: Implement more sophisticated picking if needed
      console.log('Ray intersection at:', worldPickPoint);
      
      // Visual feedback when pointing at something
      controller.userData = {
        ...controller.userData,
        pointingAt: worldPickPoint
      };
    }
  });
}

/**
 * Setup two-handed object manipulation (for scaling, rotation)
 * @param {vtkWebXRRenderWindowHelper} XRHelper The WebXR helper
 * @param {vtkRenderer} renderer The main renderer
 * @param {Object} actors Object containing all actors that can be manipulated
 */
export function setupTwoHandedInteraction(XRHelper, renderer, actors = {}) {
  // Track controller states
  const controllers = {
    left: null,
    right: null
  };
  
  // Function to handle two-handed manipulation
  function processControllers() {
    if (!controllers.left || !controllers.right || !actors.primary) {
      return;
    }
    
    // Check if both controllers are gripping
    if (controllers.left.gripping && controllers.right.gripping) {
      // Calculate the vector between controllers
      const leftPos = controllers.left.position;
      const rightPos = controllers.right.position;
      
      // Current distance between controllers
      const currentDistance = Math.sqrt(
        Math.pow(rightPos.x - leftPos.x, 2) +
        Math.pow(rightPos.y - leftPos.y, 2) +
        Math.pow(rightPos.z - leftPos.z, 2)
      );
      
      // If we've already started a two-handed interaction
      if (controllers.twoHandedInteraction) {
        // Update scale based on the change in distance between controllers
        const scaleFactor = currentDistance / controllers.initialDistance;
        const newScale = controllers.initialObjectScale * scaleFactor;
        
        actors.primary.setScale(newScale, newScale, newScale);
        
        // Calculate rotation based on the change in orientation of the line between controllers
        // This is a simplified version - could be expanded for more complex rotation
        const initialVector = controllers.initialVector;
        const currentVector = [
          rightPos.x - leftPos.x,
          rightPos.y - leftPos.y,
          rightPos.z - leftPos.z
        ];
        
        // Calculate rotation angle around Y axis
        const initialAngle = Math.atan2(initialVector[0], initialVector[2]);
        const currentAngle = Math.atan2(currentVector[0], currentVector[2]);
        const rotationY = currentAngle - initialAngle;
        
        // Apply rotation
        actors.primary.setRotation(0, rotationY * (180/Math.PI), 0);
      } else {
        // Start a new two-handed interaction
        controllers.twoHandedInteraction = true;
        controllers.initialDistance = currentDistance;
        controllers.initialObjectScale = actors.primary.getScale()[0];
        controllers.initialVector = [
          rightPos.x - leftPos.x,
          rightPos.y - leftPos.y,
          rightPos.z - leftPos.z
        ];
      }
    } else {
      // End two-handed interaction if either controller releases grip
      controllers.twoHandedInteraction = false;
    }
  }
  
  // Setup controller connected callback
  XRHelper.setControllerConnectedCallback((event) => {
    const { controller } = event;
    
    if (controller.handedness === 'left') {
      controllers.left = {
        controller,
        position: controller.position,
        gripping: false
      };
    } else if (controller.handedness === 'right') {
      controllers.right = {
        controller,
        position: controller.position,
        gripping: false
      };
    }
    
    // Setup event listeners for grip
    controller.addEventListener('gripstart', () => {
      if (controller.handedness === 'left' && controllers.left) {
        controllers.left.gripping = true;
      } else if (controller.handedness === 'right' && controllers.right) {
        controllers.right.gripping = true;
      }
      processControllers();
    });
    
    controller.addEventListener('gripend', () => {
      if (controller.handedness === 'left' && controllers.left) {
        controllers.left.gripping = false;
      } else if (controller.handedness === 'right' && controllers.right) {
        controllers.right.gripping = false;
      }
      controllers.twoHandedInteraction = false;
    });
  });
  
  // Update controller positions when they move
  XRHelper.setControllerMovedCallback((event) => {
    const { controller } = event;
    
    if (controller.handedness === 'left' && controllers.left) {
      controllers.left.position = controller.position;
    } else if (controller.handedness === 'right' && controllers.right) {
      controllers.right.position = controller.position;
    }
    
    // Process two-handed interactions
    if (controllers.twoHandedInteraction) {
      processControllers();
    }
  });
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
