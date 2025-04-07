// controllers.js - Specialized module for VR controllers handling
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

    this.viewMoveSpeed = 0.05;

    this.initialize = this.initialize.bind(this);
    this.updateViewPosition = this.updateViewPosition.bind(this);
  }

  initialize() {
    if (this.isInitialized) return;

    // Start animation loop manually
    const animate = () => {
      this.updateViewPosition();
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    if (this.xrHelper.setDrawControllersRay) {
      this.xrHelper.setDrawControllersRay(true);
    }

    const session = this.xrHelper.getXRSession?.();
    if (session) {
      session.addEventListener('inputsourceschange', (event) => {
        event.added?.forEach((input) => {
          const handedness = input.handedness;
          if (handedness === 'left' || handedness === 'right') {
            const controller = this.xrHelper.getControllerByReferenceSpace?.(input?.targetRaySpace);
            if (controller) {
              this.controllers[handedness] = controller;
              console.log(`Controller detected: ${handedness}`);

              controller.triggerPressed = false;
              controller.gripPressed = false;

              controller.addEventListener('selectstart', () => {
                controller.triggerPressed = true;
                controller.pulse?.(0.5, 50);
                console.log(`${handedness} trigger pressed`);
              });

              controller.addEventListener('selectend', () => {
                controller.triggerPressed = false;
                console.log(`${handedness} trigger released`);
              });

              controller.addEventListener('squeezestart', () => {
                controller.gripPressed = true;
                controller.pulse?.(0.5, 50);
                console.log(`${handedness} grip pressed`);
              });

              controller.addEventListener('squeezeend', () => {
                controller.gripPressed = false;
                console.log(`${handedness} grip released`);
              });
            }
          }
        });

        event.removed?.forEach((input) => {
          const handedness = input.handedness;
          if (this.controllers[handedness]) {
            console.log(`Controller removed: ${handedness}`);
            this.controllers[handedness] = null;
          }
        });
      });
    } else {
      console.warn('No XRSession found. Controller setup skipped.');
    }

    this.isInitialized = true;
    console.log('VR Controller manager initialized');
  }

  updateViewPosition() {
    const camera = this.renderer.getActiveCamera();
    let needsRender = false;

    if (this.controllers.left?.triggerPressed) {
      camera.elevation(this.viewMoveSpeed * 2);
      needsRender = true;
    }

    if (this.controllers.right?.triggerPressed) {
      camera.elevation(-this.viewMoveSpeed * 2);
      needsRender = true;
    }

    if (this.controllers.left?.gripPressed) {
      camera.azimuth(this.viewMoveSpeed * 2);
      needsRender = true;
    }

    if (this.controllers.right?.gripPressed) {
      camera.azimuth(-this.viewMoveSpeed * 2);
      needsRender = true;
    }

    if (needsRender) {
      this.renderWindow.render();
    }
  }

  setupPinchGesture(actor) {
    console.log('Pinch gesture setup complete');
  }

  setupGrabInteraction(actor) {
    console.log('Grab interaction setup complete');
  }

  enableLaserPointer(pickableActors) {
    console.log('Laser pointer enabled');
  }
}
