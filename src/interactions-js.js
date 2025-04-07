import vtkInteractorStyleManipulator from '@kitware/vtk.js/Interaction/Style/InteractorStyleManipulator';
import vtkGestureCameraManipulator from '@kitware/vtk.js/Interaction/Manipulators/GestureCameraManipulator';
import vtkMouseCameraTrackballRotateManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballRotateManipulator';
import vtkMouseCameraTrackballPanManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballPanManipulator';
import vtkMouseCameraTrackballZoomManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseCameraTrackballZoomManipulator';
import vtkMouseRangeManipulator from '@kitware/vtk.js/Interaction/Manipulators/MouseRangeManipulator';
import { VRControllerManager } from './controllers-js';

export function setupStandardInteractions(renderer, renderWindow, actors = {}) {
  const interactor = renderWindow.getInteractor();
  const istyle = vtkInteractorStyleManipulator.newInstance();
  interactor.setInteractorStyle(istyle);

  istyle.addMouseManipulator(vtkMouseCameraTrackballRotateManipulator.newInstance());
  istyle.addMouseManipulator(vtkMouseCameraTrackballPanManipulator.newInstance({ button: 2 }));
  istyle.addMouseManipulator(vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 }));
  istyle.addGestureManipulator(vtkGestureCameraManipulator.newInstance());

  const rangeManipulator = vtkMouseRangeManipulator.newInstance({ button: 1, scrollEnabled: true });

  if (actors.primary) {
    rangeManipulator.setVerticalListener(0.5, 2.0, 0.1, (scale) => {
      actors.primary.setScale(scale, scale, scale);
      renderWindow.render();
      return scale;
    });
  }

  istyle.addMouseManipulator(rangeManipulator);

  return istyle;
}

export function setupVRInteractions(XRHelper, renderer, renderWindow, actors = {}) {
  const controllerManager = new VRControllerManager(XRHelper, renderer, renderWindow);
  controllerManager.initialize();

  controllerManager.setupPinchGesture(actors.primary);
  controllerManager.setupGrabInteraction(actors.primary);
  controllerManager.enableLaserPointer(actors.pickable);

  return controllerManager;
}

export function setupInteractionModes(renderer, renderWindow, actors = {}) {
  const modes = {
    ROTATE: 'rotate',
    SCALE: 'scale',
    TRANSLATE: 'translate',
    INSPECT: 'inspect'
  };

  let currentMode = modes.ROTATE;
  const interactor = renderWindow.getInteractor();
  const istyle = vtkInteractorStyleManipulator.newInstance();
  interactor.setInteractorStyle(istyle);

  const rotateManipulator = vtkMouseCameraTrackballRotateManipulator.newInstance();
  const panManipulator1 = vtkMouseCameraTrackballPanManipulator.newInstance({ button: 2 });
  const panManipulator2 = vtkMouseCameraTrackballPanManipulator.newInstance({ button: 1 });
  const zoomManipulator1 = vtkMouseCameraTrackballZoomManipulator.newInstance({ button: 3 });
  const rotateManipulatorAlt = vtkMouseCameraTrackballRotateManipulator.newInstance({ button: 3 });
  const rotateManipulatorAlt2 = vtkMouseCameraTrackballRotateManipulator.newInstance({ button: 2 });

  const scaleManipulator = vtkMouseRangeManipulator.newInstance({ button: 1, scrollEnabled: true });

  if (actors.primary) {
    scaleManipulator.setVerticalListener(0.5, 2.0, 0.1, (scale) => {
      actors.primary.setScale(scale, scale, scale);
      renderWindow.render();
      return scale;
    });
  }

  function setMode(mode) {
    istyle.removeAllMouseManipulators();

    switch (mode) {
      case modes.ROTATE:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(panManipulator1);
        istyle.addMouseManipulator(zoomManipulator1);
        break;

      case modes.SCALE:
        istyle.addMouseManipulator(scaleManipulator);
        istyle.addMouseManipulator(panManipulator1);
        istyle.addMouseManipulator(rotateManipulatorAlt);
        break;

      case modes.TRANSLATE:
        istyle.addMouseManipulator(panManipulator2);
        istyle.addMouseManipulator(rotateManipulatorAlt2);
        istyle.addMouseManipulator(zoomManipulator1);
        break;

      case modes.INSPECT:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(zoomManipulator1);
        break;

      default:
        istyle.addMouseManipulator(rotateManipulator);
        istyle.addMouseManipulator(panManipulator1);
        istyle.addMouseManipulator(zoomManipulator1);
    }

    currentMode = mode;
    renderWindow.render();
  }

  setMode(currentMode);

  return {
    modes,
    setMode,
    getCurrentMode: () => currentMode
  };
}

// --- Final Actor Interactivity ---
const actorDataMap = new Map();

export function makeActorInteractive(actor, renderer, renderWindow) {
  actor.getProperty().setInterpolationToPhong();

  actorDataMap.set(actor, {
    initialPosition: actor.getPosition(),
    initialScale: actor.getScale(),
    initialRotation: actor.getOrientation(),
    selected: false,
  });

  return {
    reset: () => {
      const data = actorDataMap.get(actor);
      actor.setPosition(...data.initialPosition);
      actor.setScale(...data.initialScale);
      actor.setOrientation(...data.initialRotation);
      renderWindow.render();
    },

    highlight: (enabled = true) => {
      actor.getProperty().setColor(
        enabled ? 1.0 : 1.0,
        enabled ? 0.8 : 1.0,
        enabled ? 0.1 : 1.0
      );
      renderWindow.render();
    },
  };
}
