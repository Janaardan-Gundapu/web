// For streamlined VR development install the WebXR emulator extension
// https://github.com/MozillaReality/WebXR-emulator-extension
//This extension is no longer available because it doesn't follow best practices for Chrome extensions.

//-----------------------------------------------------------------------------------------------------
//import all the packages that are needed


import '@kitware/vtk.js/favicon';

// Load the rendering pieces we want to use (for both WebGL and WebGPU)
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

// Force DataAccessHelper to have access to various data source
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HtmlDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/HttpDataAccessHelper';
import '@kitware/vtk.js/IO/Core/DataAccessHelper/JSZipDataAccessHelper';

import vtkResourceLoader from '@kitware/vtk.js/IO/Core/ResourceLoader';

// Custom UI controls, including button to start XR session
import controlPanel from './controller.html';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import { colorSpaceToWorking } from 'three/tsl';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';

// Import interaction setup functions
import { setupStandardInteractions, setupVRInteractions, setupInteractionModes, makeActorInteractive } from './interactions-js';

//--------------------------------------------------------------------------------------------------------

// Dynamically load WebXR polyfill from CDN for WebVR and Cardboard API backwards compatibility
if (navigator.xr === undefined) {
  vtkResourceLoader
    .loadScript(
      'https://cdn.jsdelivr.net/npm/webxr-polyfill@latest/build/webxr-polyfill.js'
    )
    .then(() => {
      // eslint-disable-next-line no-new, no-undef
      new WebXRPolyfill();
    });
}

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
  background: [0, 0, 0],
});
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();
const XRHelper = vtkWebXRRenderWindowHelper.newInstance({
  renderWindow: fullScreenRenderer.getApiSpecificRenderWindow(),
  drawControllersRay: true,
});

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------
// create a filter on the fly, sort of cool, this is a random scalars
// filter we create inline, for a simple cone you would not need
// this
// ----------------------------------------------------------------------------

const vtpReader = vtkXMLPolyDataReader.newInstance();

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function createPipeline(fileContents){
  vtpReader.parseAsArrayBuffer(fileContents);
}

function loadFile(file){
  const reader = new FileReader();
  reader.onload = function onLoad(e){
    // createPipeline(reader.result);
  };
  reader.readAsArrayBuffer(file);
}

const source = vtpReader.getOutputData(0);
const mapper = vtkMapper.newInstance();
const actor = vtkActor.newInstance();

actor.setMapper(mapper);

function handleFile(e){
  preventDefaults(e);
  const dataTransfer = e.dataTransfer;
  const files = e.target.files || dataTransfer.files;
  if (files.length > 0){
    const file = files[0];
    const fileReader = new FileReader();
    fileReader.onload = function onLoad(e){
      vtpReader.parseAsArrayBuffer(fileReader.result);
      mapper.setInputData(vtpReader.getOutputData(0));
      renderer.addActor(actor);
      renderer.resetCamera();
      renderWindow.render();
    };
    fileReader.readAsArrayBuffer(files[0]);
  }
}

// -----------------------------------------------------------
// UI control handling
// -----------------------------------------------------------
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

// Reset button
resetButton.addEventListener('click', () => {
  actor.reset();
});

// Make the loaded actor interactive
makeActorInteractive(actor, renderer, renderWindow);

// Setup standard interactions
const istyle = setupStandardInteractions(renderer, renderWindow, { primary: actor });

// Setup VR interactions
setupVRInteractions(XRHelper, renderer, renderWindow, { primary: actor, pickable: [actor] });
