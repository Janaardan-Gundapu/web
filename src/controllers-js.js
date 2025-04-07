// controllers.js - Enhanced module for VR controllers handling
import { vec3 } from 'gl-matrix';

export class VRControllerManager {
  constructor(xrHelper, renderer, renderWindow) {
    this.xrHelper = xrHelper;
    this.renderer = renderer;
    this.renderWindow = renderWindow;
    this.controllers = {
      left: null,
      right: null
    };
    this.grabbedObject = null;
    this.pinchStartDistance = 0;
    this.initialScale = 1.0;
    this.isInitialized = false;
    this.isXRActive = false;

    this.viewMoveSpeed = 0.05;

    this.initialize = this.initialize.bind(this);
    this.updateViewPosition = this.updateViewPosition.bind(this);
    this.onSessionStarted = this.onSessionStarted.bind(this);
    this.onSessionEnded = this.onSessionEnded.bind(this);
    
    // Listen for XRHelper events
    if (this.xrHelper) {
      console.log('Setting up VRControllerManager event listeners');
      this.xrHelper.onSessionStart(this.onSessionStarted);
      this.xrHelper.onSessionEnd(this.onSessionEnded);
    }
  }

  onSessionStarted(session) {
    console.log('XR Session started', session);
    this.isXRActive = true;
    
    // Set up controllers now that session is active
    this.setupControllers(session);
    
    // Also add session event listeners
    session.addEventListener('inputsourceschange', this.handleInputSourcesChange.bind(this));
  }

  onSessionEnded() {
    console.log('XR Session ended');
    this.isXRActive = false;
    this.controllers.left = null;
    this.controllers.right = null;
  }

  handleInputSourcesChange(event) {
    console.log('InputSourcesChange event', event);
    
    if (event.added) {
      event.added.forEach((inputSource) => {
        console.log('Input source added:', inputSource);
        const handedness = inputSource.handedness;
        if (handedness === 'left' || handedness === 'right') {
          this.setupController(inputSource);
        }
      });
    }
    
    if (event.removed) {
      event.removed.forEach((inputSource) => {
        const handedness = inputSource.handedness;
        if (handedness === 'left' || handedness === 'right') {
          console.log(`Controller removed: ${handedness}`);
          this.controllers[handedness] = null;
        }
      });
    }
  }

  setupController(inputSource) {
    const handedness = inputSource.handedness;
    
    // Get the grip or targetRay space - grip is preferred for hand tracking
    const space = inputSource.gripSpace || inputSource.targetRaySpace;
    
    if (!space) {
      console.warn(`No valid space found for ${handedness} controller`);
      return;
    }
    
    // Get controller from xrHelper if available
    let controller;
    if (this.xrHelper.getControllerByReferenceSpace) {
      controller = this.xrHelper.getControllerByReferenceSpace(space);
    } else if (this.xrHelper.getController) {
      // Some implementations use index
      const index = handedness === 'left' ? 0 : 1;
      controller = this.xrHelper.getController(index);
    }
    
    if (!controller) {
      console.warn(`Failed to get ${handedness} controller from XRHelper`);
      return;
    }
    
    console.log(`Controller detected: ${handedness}`, controller);
    this.controllers[handedness] = controller;
    
    // Add event listeners to controller
    controller.triggerPressed = false;
    controller.gripPressed = false;
    
    controller.addEventListener('selectstart', () => {
      controller.triggerPressed = true;
      if (controller.pulse) {
        controller.pulse(0.5, 50);
      }
      console.log(`${handedness} trigger pressed`);
    });
    
    controller.addEventListener('selectend', () => {
      controller.triggerPressed = false;
      console.log(`${handedness} trigger released`);
    });
    
    controller.addEventListener('squeezestart', () => {
      controller.gripPressed = true;
      if (controller.pulse) {
        controller.pulse(0.5, 50);
      }
      console.log(`${handedness} grip pressed`);
    });
    
    controller.addEventListener('squeezeend', () => {
      controller.gripPressed = false;
      console.log(`${handedness} grip released`);
    });
  }

  setupControllers(session) {
    if (!session) {
      console.warn('No XR session available for controller setup');
      return;
    }
    
    // Handle any existing input sources
    session.inputSources.forEach((inputSource) => {
      console.log('Initial input source:', inputSource);
      const handedness = inputSource.handedness;
      if (handedness === 'left' || handedness === 'right') {
        this.setupController(inputSource);
      }
    });
  }

  initialize() {
    if (this.isInitialized) return;

    console.log('Initializing VR Controller Manager');
    
    // Start animation loop manually to constantly check controller state
    const animate = () => {
      if (this.isXRActive) {
        this.updateViewPosition();
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    
    // Enable controller rays if possible
    if (this.xrHelper && this.xrHelper.setDrawControllersRay) {
      this.xrHelper.setDrawControllersRay(true);
      console.log('Controller rays enabled');
    }
    
    // If a session is already active, set up controllers
    const session = this.xrHelper && this.xrHelper.getXRSession ? this.xrHelper.getXRSession() : null;
    if (session) {
      console.log('XR Session already active:', session);
      this.onSessionStarted(session);
    } else {
      console.log('No active XR session yet, will set up controllers when session starts');
    }

    this.isInitialized = true;
    console.log('VR Controller manager initialization complete');
  }

  updateViewPosition() {
    const camera = this.renderer.getActiveCamera();
    let needsRender = false;

    // Debug current controller state
    if (this.controllers.left || this.controllers.right) {
      console.log('Controller state:', {
        left: this.controllers.left ? {
          triggerPressed: this.controllers.left.triggerPressed,
          gripPressed: this.controllers.left.gripPressed
        } : 'not connected',
        right: this.controllers.right ? {
          triggerPressed: this.controllers.right.triggerPressed,
          gripPressed: this.controllers.right.gripPressed
        } : 'not connected'
      });
    }

    if (this.controllers.left?.triggerPressed) {
      camera.elevation(this.viewMoveSpeed * 2);
      needsRender = true;
      console.log('Moving camera up');
    }

    if (this.controllers.right?.triggerPressed) {
      camera.elevation(-this.viewMoveSpeed * 2);
      needsRender = true;
      console.log('Moving camera down');
    }

    if (this.controllers.left?.gripPressed) {
      camera.azimuth(this.viewMoveSpeed * 2);
      needsRender = true;
      console.log('Rotating camera left');
    }

    if (this.controllers.right?.gripPressed) {
      camera.azimuth(-this.viewMoveSpeed * 2);
      needsRender = true;
      console.log('Rotating camera right');
    }

    if (needsRender) {
      this.renderWindow.render();
    }
  }

  setupPinchGesture(actor) {
    if (!actor) return;
    
    console.log('Setting up pinch gesture for actor');
    
    // Implementation for two-handed pinch/scale gesture
    const updatePinchScale = () => {
      if (!this.controllers.left || !this.controllers.right) return;
      if (!this.controllers.left.gripPressed || !this.controllers.right.gripPressed) return;
      
      // Get controller positions
      const leftPos = this.controllers.left.getWorldPosition();
      const rightPos = this.controllers.right.getWorldPosition();
      
      // Calculate distance between controllers
      const dx = rightPos[0] - leftPos[0];
      const dy = rightPos[1] - leftPos[1];
      const dz = rightPos[2] - leftPos[2];
      const currentDistance = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (this.pinchStartDistance === 0) {
        // Initialize starting distance when both grips are first pressed
        this.pinchStartDistance = currentDistance;
        this.initialScale = actor.getScale()[0]; // Assuming uniform scaling
      } else {
        // Calculate scale factor based on change in distance
        const scaleFactor = (currentDistance / this.pinchStartDistance) * this.initialScale;
        actor.setScale(scaleFactor, scaleFactor, scaleFactor);
        this.renderWindow.render();
        console.log('Pinch scaling:', scaleFactor);
      }
    };
    
    // Add to animation loop
    const pinchLoop = () => {
      if (this.isXRActive) {
        updatePinchScale();
      }
      requestAnimationFrame(pinchLoop);
    };
    requestAnimationFrame(pinchLoop);
    
    console.log('Pinch gesture setup complete');
  }

  setupGrabInteraction(actor) {
    if (!actor) return;
    
    console.log('Setting up grab interaction for actor');
    
    // Implementation for grabbing and moving objects
    // This will be called in the animation loop
    const updateGrab = () => {
      if (!this.isXRActive) return;
      
      // Check if either controller is triggering a grab
      if (this.controllers.right?.triggerPressed && !this.grabbedObject) {
        // Start grab with right controller
        this.grabbedObject = {
          actor,
          controller: this.controllers.right,
          offsetPosition: [0, 0, 0], // Calculate offset if needed
          initialPosition: actor.getPosition().slice()
        };
        console.log('Actor grabbed with right controller');
      } else if (this.controllers.left?.triggerPressed && !this.grabbedObject) {
        // Start grab with left controller
        this.grabbedObject = {
          actor,
          controller: this.controllers.left,
          offsetPosition: [0, 0, 0],
          initialPosition: actor.getPosition().slice()
        };
        console.log('Actor grabbed with left controller');
      }
      
      // Update position if object is grabbed
      if (this.grabbedObject) {
        const controller = this.grabbedObject.controller;
        
        // Check if we should release
        if (!controller.triggerPressed) {
          console.log('Actor released');
          this.grabbedObject = null;
          return;
        }
        
        // Update position based on controller movement
        const controllerPos = controller.getWorldPosition();
        if (controllerPos) {
          // Apply offset and set actor position
          actor.setPosition(
            controllerPos[0] + this.grabbedObject.offsetPosition[0],
            controllerPos[1] + this.grabbedObject.offsetPosition[1],
            controllerPos[2] + this.grabbedObject.offsetPosition[2]
          );
          this.renderWindow.render();
        }
      }
    };
    
    // Add to animation loop
    const grabLoop = () => {
      updateGrab();
      requestAnimationFrame(grabLoop);
    };
    requestAnimationFrame(grabLoop);
    
    console.log('Grab interaction setup complete');
  }

  enableLaserPointer(pickableActors) {
    if (!Array.isArray(pickableActors) || pickableActors.length === 0) {
      console.warn('No pickable actors provided for laser pointer');
      return;
    }
    
    console.log(`Enabling laser pointer for ${pickableActors.length} actors`);
    
    // If XRHelper supports controller rays, make sure they're enabled
    if (this.xrHelper && this.xrHelper.setDrawControllersRay) {
      this.xrHelper.setDrawControllersRay(true);
    }
    
    // Add visual feedback for when the laser hits an actor
    const highlightActor = (actor, highlight) => {
      if (!actor) return;
      
      const property = actor.getProperty();
      if (highlight) {
        // Save original color if not already saved
        if (!actor._originalColor) {
          actor._originalColor = property.getColor().slice();
        }
        // Highlight with a bright color
        property.setColor(1.0, 0.8, 0.2); // Yellowish highlight
      } else if (actor._originalColor) {
        // Restore original color
        property.setColor(...actor._originalColor);
      }
      this.renderWindow.render();
    };
    
    // Setup simple ray-casting for controller targeting
    const checkRayIntersection = (controller) => {
      if (!controller) return null;
      
      // Get controller position and direction
      const position = controller.getWorldPosition();
      const direction = controller.getWorldDirection();
      
      if (!position || !direction) return null;
      
      // Find closest intersection
      let closestActor = null;
      let closestDistance = Infinity;
      
      pickableActors.forEach(actor => {
        // Very simple bounding sphere intersection test
        // In a real implementation, you'd use proper ray-mesh intersection
        const actorPos = actor.getCenter();
        const dx = actorPos[0] - position[0];
        const dy = actorPos[1] - position[1];
        const dz = actorPos[2] - position[2];
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // Check if this is closer than previous hits
        if (distance < closestDistance) {
          closestDistance = distance;
          closestActor = actor;
        }
      });
      
      return closestDistance < 2.0 ? closestActor : null; // Arbitrary distance threshold
    };
    
    // Track highlighted actors
    let highlightedActors = {};
    
    // Add to animation loop for continuous intersection testing
    const laserLoop = () => {
      if (!this.isXRActive) {
        requestAnimationFrame(laserLoop);
        return;
      }
      
      // Check each controller
      ['left', 'right'].forEach(hand => {
        const controller = this.controllers[hand];
        if (!controller) return;
        
        // Find intersection
        const hitActor = checkRayIntersection(controller);
        
        // Update highlights
        if (hitActor) {
          if (highlightedActors[hand] !== hitActor) {
            // Unhighlight previous actor
            if (highlightedActors[hand]) {
              highlightActor(highlightedActors[hand], false);
            }
            // Highlight new actor
            highlightActor(hitActor, true);
            highlightedActors[hand] = hitActor;
          }
        } else if (highlightedActors[hand]) {
          // No hit, remove highlight from previous actor
          highlightActor(highlightedActors[hand], false);
          highlightedActors[hand] = null;
        }
      });
      
      requestAnimationFrame(laserLoop);
    };
    requestAnimationFrame(laserLoop);
    
    console.log('Laser pointer enabled');
  }
}
