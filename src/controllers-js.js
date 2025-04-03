// controllers.js - Specialized module for VR controllers handling
import { vec3 } from 'gl-matrix';

/**
 * A class to manage VR controllers and their interactions
 */
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

    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.onControllerConnected = this.onControllerConnected.bind(this);
    this.onControllerDisconnected = this.onControllerDisconnected.bind(this);
    this.onControllerMoved = this.onControllerMoved.bind(this);
    this.processGestures = this.processGestures.bind(this);
    this.handleLaserPointerSelection = this.handleLaserPointerSelection.bind(this);
  }

  /**
   * Initialize the controller manager
   */
  initialize() {
    if (this.isInitialized) return;

    // Set up controller callbacks
    this.xrHelper.setControllerConnectedCallback(this.onControllerConnected);
    this.xrHelper.setControllerDisconnectedCallback(this.onControllerDisconnected);
    this.xrHelper.setControllerMovedCallback(this.onControllerMoved);
    
    // Setup ray intersection callback for laser pointer
    this.xrHelper.setRayIntersectionCallback(this.handleLaserPointerSelection);
    
    // Enable ray visualization
    this.xrHelper.setDrawControllersRay(true);
    
    this.isInitialized = true;
    console.log('VR Controller manager initialized');
  }

  /**
   * Called when a controller is connected
   * @param {Object} event The controller event containing controller data
   */
  onControllerConnected(event) {
    const { controller } = event;
    console.log(`Controller connected: ${controller.handedness}`);
    
    // Store controller reference based on handedness
    if (controller.handedness === 'left') {
      this.controllers.left = controller;
      
      // Setup left controller gestures
      controller.addEventListener('selectstart', () => {
        console.log('Left controller select started');
        this.beginGrab(controller);
      });
      
      controller.addEventListener('selectend', () => {
        console.log('Left controller select ended');
        this.endGrab(controller);
      });
      
      controller.addEventListener('squeezestart', () => {
        console.log('Left controller squeeze started');
        this.beginPinch(controller);
      });
      
      controller.addEventListener('squeezeend', () => {
        console.log('Left controller squeeze ended');
        this.endPinch(controller);
      });

    } else if (controller.handedness === 'right') {
      this.controllers.right = controller;
      
      // Setup right controller gestures
      controller.addEventListener('selectstart', () => {
        console.log('Right controller select started');
        this.beginGrab(controller);
      });
      
      controller.addEventListener('selectend', () => {
        console.log('Right controller select ended');
        this.endGrab(controller);
      });
      
      controller.addEventListener('squeezestart', () => {
        console.log('Right controller squeeze started');
        this.beginPinch(controller);
      });
      
      controller.addEventListener('squeezeend', () => {
        console.log('Right controller squeeze ended');
        this.endPinch(controller);
      });
    }
    
    // Add vibration feedback
    controller.pulse = (intensity = 0.75, duration = 50) => {
      if (controller.gamepad && controller.gamepad.hapticActuators && 
          controller.gamepad.hapticActuators.length > 0) {
        controller.gamepad.hapticActuators[0].pulse(intensity, duration);
      }
    };
  }

  /**
   * Called when a controller is disconnected
   * @param {Object} event The controller event
   */
  onControllerDisconnected(event) {
    const { controller } = event;
    console.log(`Controller disconnected: ${controller.handedness}`);
    
    if (controller.handedness === 'left') {
      this.controllers.left = null;
    } else if (controller.handedness === 'right') {
      this.controllers.right = null;
    }
    
    // If we were grabbing with this controller, release the object
    if (this.grabbedObject && this.grabbedObject.controller === controller) {
      this.endGrab(controller);
    }
  }

  /**
   * Called when a controller moves
   * @param {Object} event The controller event
   */
  onControllerMoved(event) {
    const { controller } = event;
    
    // Update grabbed object position if applicable
    if (this.grabbedObject && this.grabbedObject.controller === controller) {
      this.updateGrabbedObjectPosition(controller);
    }
    
    // Process pinch gesture if both controllers are active
    this.processGestures();
  }
  
  /**
   * Begin grabbing an object with a controller
   * @param {Object} controller The controller
   */
  beginGrab(controller) {
    // Find closest intersecting object and grab it
    // This is a simplified version - in a real app, you'd use ray casting
    // to determine which object to grab based on controller position
    const actor = this.findClosestActor(controller);
    
    if (actor) {
      this.grabbedObject = {
        actor,
        controller,
        initialPosition: actor.getPosition(),
        initialControllerPosition: [
          controller.position.x,
          controller.position.y,
          controller.position.z
        ],
        grabOffset: [0, 0, 0] // Calculate offset if needed
      };
      
      // Provide haptic feedback
      if (controller.pulse) {
        controller.pulse(0.7, 50);
      }
      
      // Visual feedback
      actor.getProperty().setColor(1.0, 0.8, 0.1);
      this.renderWindow.render();
    }
  }
  
  /**
   * End grabbing an object
   * @param {Object} controller The controller
   */
  endGrab(controller) {
    if (this.grabbedObject && this.grabbedObject.controller === controller) {
      // Reset visual feedback
      this.grabbedObject.actor.getProperty().setColor(1.0, 1.0, 1.0);
      
      // Provide haptic feedback
      if (controller.pulse) {
        controller.pulse(0.3, 30);
      }
      
      this.grabbedObject = null;
      this.renderWindow.render();
    }
  }
  
  /**
   * Begin pinch gesture
   * @param {Object} controller The controller
   */
  beginPinch(controller) {
    // If both controllers are squeezing, we can do a two-handed pinch
    if (this.controllers.left && this.controllers.right) {
      // Calculate the distance between controllers
      const leftPos = this.controllers.left.position;
      const rightPos = this.controllers.right.position;
      
      this.pinchStartDistance = Math.sqrt(
        Math.pow(rightPos.x - leftPos.x, 2) +
        Math.pow(rightPos.y - leftPos.y, 2) +
        Math.pow(rightPos.z - leftPos.z, 2)
      );
      
      // Find an actor to scale (in this case, use the closest one)
      const actor = this.findClosestActor(controller);
      if (actor) {
        this.pinchObject = {
          actor,
          initialScale: actor.getScale()[0]
        };
        
        // Visual feedback
        actor.getProperty().setColor(0.1, 0.8, 1.0);
        this.renderWindow.render();
        
        // Haptic feedback
        if (controller.pulse) {
          controller.pulse(0.5, 40);
        }
      }
    }
  }
  
  /**
   * End pinch gesture
   * @param {Object} controller The controller
   */
  endPinch(controller) {
    if (this.pinchObject) {
      // Reset visual feedback
      this.pinchObject.actor.getProperty().setColor(1.0, 1.0, 1.0);
      
      // Haptic feedback
      if (controller.pulse) {
        controller.pulse(0.3, 30);
      }
      
      this.pinchObject = null;
      this.renderWindow.render();
    }
  }
  
  /**
   * Update the position of the grabbed object based on controller movement
   * @param {Object} controller The controller
   */
  updateGrabbedObjectPosition(controller) {
    if (!this.grabbedObject) return;
    
    const { actor, initialPosition, initialControllerPosition } = this.grabbedObject;
    
    // Calculate the delta movement
    const deltaX = controller.position.x - initialControllerPosition[0];
    const deltaY = controller.position.y - initialControllerPosition[1];
    const deltaZ = controller.position.z - initialControllerPosition[2];
    
    // Apply the delta to the actor's position
    actor.setPosition(
      initialPosition[0] + deltaX,
      initialPosition[1] + deltaY,
      initialPosition[2] + deltaZ
    );
    
    this.renderWindow.render();
  }
  
  /**
   * Process two-handed gestures like pinching to scale
   */
  processGestures() {
    // Only process if we have both controllers and a pinch object
    if (!this.controllers.left || !this.controllers.right || !this.pinchObject) {
      return;
    }
    
    // Calculate current distance between controllers
    const leftPos = this.controllers.left.position;
    const rightPos = this.controllers.right.position;
    
    const currentDistance = Math.sqrt(
      Math.pow(rightPos.x - leftPos.x, 2) +
      Math.pow(rightPos.y - leftPos.y, 2) +
      Math.pow(rightPos.z - leftPos.z, 2)
    );
    
    // Calculate scale factor based on distance change
    const scaleFactor = currentDistance / this.pinchStartDistance;
    const newScale = this.pinchObject.initialScale * scaleFactor;
    
    // Apply new scale to the object
    const { actor } = this.pinchObject;
    actor.setScale(newScale, newScale, newScale);
    
    this.renderWindow.render();
  }
  
  /**
   * Handle laser pointer selection
   * @param {Object} event The intersection event
   */
  handleLaserPointerSelection(event) {
    const { controller, worldPickPoint, intersected } = event;
    
    if (intersected && worldPickPoint) {
      // Visual feedback for pointing at something
      if (controller.pulse) {
        controller.pulse(0.2, 20);
      }
      
      // Store pointer position for future use
      controller.userData = {
        ...controller.userData,
        pointingAt: worldPickPoint
      };
      
      console.log(`Laser pointer intersected at: [${worldPickPoint[0]}, ${worldPickPoint[1]}, ${worldPickPoint[2]}]`);
    }
  }
  
  /**
   * Find the closest actor to a controller
   * @param {Object} controller The controller
   * @returns {vtkActor|null} The closest actor or null
   */
  findClosestActor(controller) {
    // In a real implementation, you would do proper ray casting
    // or proximity detection to find the closest actor
    
    // For this simplified example, just return the first actor in the scene
    const actors = this.renderer.getActors();
    if (actors.length > 0) {
      return actors[0];
    }
    
    return null;
  }
}