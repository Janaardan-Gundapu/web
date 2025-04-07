import '@kitware/vtk.js/favicon';
import '@kitware/vtk.js/Rendering/Profiles/Geometry';

import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkCalculator from '@kitware/vtk.js/Filters/General/Calculator';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkWebXRRenderWindowHelper from '@kitware/vtk.js/Rendering/WebXR/RenderWindowHelper';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import vtkXMLPolyDataReader from '@kitware/vtk.js/IO/XML/XMLPolyDataReader';
import vtkPolyDataNormals from '@kitware/vtk.js/Filters/Core/PolyDataNormals';

import { AttributeTypes } from '@kitware/vtk.js/Common/DataModel/DataSetAttributes/Constants';
import { FieldDataTypes } from '@kitware/vtk.js/Common/DataModel/DataSet/Constants';
import { XrSessionTypes } from '@kitware/vtk.js/Rendering/WebXR/RenderWindowHelper/Constants';

import '@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import vtkResourceLoader from '@kitware/vtk.js/IO/Core/ResourceLoader';

import controlPanel from './controller.html';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';

import {
  setupStandardInteractions,
  setupVRInteractions,
  setupInteractionModes,
  makeActorInteractive
} from './interactions-js';

// Load WebXR polyfill for compatibility
if (navigator.xr === undefined) {
  vtkResourceLoader
    .loadScript('https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js')
    .then(() => {
      new WebXRPolyfill();
    });
}

// ----------------------------------------------------------------------------
// VTK.js Rendering Setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  background: [0, 0, 0],
});
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// ✅ Make XRHelper globally accessible
window.XRHelper = vtkWebXRRenderWindowHelper.newInstance({
  renderWindow: fullScreenRenderer.getApiSpecificRenderWindow(),
  drawControllersRay: true,
});
const XRHelper = window.XRHelper;

console.log("XRHelper globally available:", XRHelper);

// ----------------------------------------------------------------------------
// Load .vtp model
// ----------------------------------------------------------------------------

const vtpReader = vtkXMLPolyDataReader.newInstance();
const source = vtpReader.getOutputData(0);
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();
actor.setMapper(mapper);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function handleFile(e) {
  preventDefaults(e);
  const dataTransfer = e.dataTransfer;
  const files = e.target.files || dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    const fileReader = new FileReader();
    fileReader.onload = function onLoad(e) {
      vtpReader.parseAsArrayBuffer(fileReader.result);
      mapper.setInputData(vtpReader.getOutputData(0));
      renderer.addActor(actor);
      renderer.resetCamera();
      renderWindow.render();
    };
    fileReader.readAsArrayBuffer(file);
  }
}

// ----------------------------------------------------------------------------
// UI Controls
// ----------------------------------------------------------------------------

fullScreenRenderer.addController(controlPanel);
const representationSelector = document.querySelector('.representations');
const vrbutton = document.querySelector('.vrbutton');
const fileInput = document.getElementById('fileInput');
const interactionModeSelector = document.querySelector('.interactionMode');
const colorSelector = document.querySelector('.colorSelect');
const resetButton = document.getElementById('resetButton');

fileInput.addEventListener('change', handleFile);

representationSelector.addEventListener('change', (e) => {
  const newRepValue = Number(e.target.value);
  actor.getProperty().setRepresentation(newRepValue);
  renderWindow.render();
});

vrbutton.addEventListener('click', (e) => {
  if (vrbutton.textContent === 'Send To VR') {
    XRHelper.startXR(XrSessionTypes.InlineVr);
    vrbutton.textContent = 'Return From VR';
  } else {
    XRHelper.stopXR();
    vrbutton.textContent = 'Send To VR';
  }
});

// Setup interaction modes
const interactionModes = setupInteractionModes(renderer, renderWindow, { primary: actor });
interactionModeSelector.addEventListener('change', (e) => {
  const selectedMode = e.target.value;
  interactionModes.setMode(selectedMode);
});

// Color control
colorSelector.addEventListener('change', (e) => {
  const selectedColor = e.target.value;
  actor.getProperty().setColor(selectedColor);
  renderWindow.render();
});

// Make the actor interactive and store helpers
const actorTools = makeActorInteractive(actor, renderer, renderWindow);

// Reset button uses helper
resetButton.addEventListener('click', () => {
  actorTools.reset();
});

// Standard interactions
setupStandardInteractions(renderer, renderWindow, { primary: actor });

// VR-specific interactions
setupVRInteractions(XRHelper, renderer, renderWindow, {
  primary: actor,
  pickable: [actor],
});
