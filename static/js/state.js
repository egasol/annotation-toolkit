// js/state.js
// Holds the shared state for the entire application.

export const state = {
    // Annotation state
    rois: [],
    currentImage: null,
    currentImageName: '',
    isDrawing: false,
    startX: 0,
    startY: 0,
    currentRoi: {},
    currentProperties: {},
    localFileObjects: {},
    iconCache: {},
    propertyConfig: {},

    // View transform state
    scale: 1.0,
    originX: 0,
    originY: 0,
    isPanning: false,
    panStart: { x: 0, y: 0 },
};

export const CONSTANTS = {
    MIN_SCALE: 0.1,
    MAX_SCALE: 10,
};

export function resetState(fileListElem, imageNameDisplay, canvas) {
    state.rois = [];
    state.currentImage = null;
    state.currentImageName = '';
    state.isDrawing = false;
    state.localFileObjects = {};
    imageNameDisplay.textContent = 'No image selected';
    fileListElem.innerHTML = '<li>Select a folder to begin.</li>';
    state.scale = 1.0;
    state.originX = 0;
    state.originY = 0;
}