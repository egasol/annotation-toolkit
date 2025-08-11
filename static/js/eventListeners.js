// js/eventListeners.js
// Initializes all event listeners for the application.

import { state, CONSTANTS, resetState } from './state.js';
import * as api from './api.js';
import * as canvas from './canvas.js';
import * as ui from './ui.js';

export function initializeEventListeners() {
    const canvasElem = document.getElementById('annotatorCanvas');
    const ctx = canvasElem.getContext('2d');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const fileListElem = document.getElementById('file-list');
    const saveBtn = document.getElementById('save-btn');
    const imageNameDisplay = document.getElementById('current-image-name');
    const imageFolderInput = document.getElementById('file-input');
    const propsFileInput = document.getElementById('props-input');
    const annotDirInput = document.getElementById('annot-dir-input');
    const setAnnotDirBtn = document.getElementById('set-annot-dir-btn');

    async function switchImage(filename) {
        if (state.currentImageName && state.currentImageName !== filename) {
            await api.saveAnnotations(state.currentImageName, state.rois);
            await ui.updateAnnotationStatus();
        }
        state.rois = [];
        state.currentImageName = filename;
        document.querySelectorAll('#file-list .file-item').forEach(item => {
            item.classList.toggle('active', item.dataset.filename === filename);
        });
        imageNameDisplay.textContent = `Annotating: ${filename}`;
        const file = state.localFileObjects[filename];
        const localUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = localUrl;
        img.onload = async () => {
            state.currentImage = img;
            canvas.zoomToFit(canvasElem, img.width, img.height);
            state.rois = await api.loadAnnotations(filename);
            canvas.redraw(canvasElem, ctx);
            URL.revokeObjectURL(localUrl);
        };
    }

    imageFolderInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        resetState(fileListElem, imageNameDisplay);
        const supportedFormats = ['image/jpeg', 'image/png', 'image/gif'];
        let imageFiles = [];
        for (const file of e.target.files) {
            if (supportedFormats.includes(file.type)) {
                state.localFileObjects[file.name] = file;
                imageFiles.push(file.name);
            }
        }
        imageFiles.sort();
        if (imageFiles.length === 0) {
            fileListElem.innerHTML = '<li>No supported images found.</li>';
            return;
        }
        fileListElem.innerHTML = '';
        imageFiles.forEach(name => {
            const li = document.createElement('li');
            li.textContent = `📄 ${name}`;
            li.className = 'file-item';
            li.dataset.filename = name;
            li.addEventListener('click', () => switchImage(name));
            fileListElem.appendChild(li);
        });
        await ui.updateAnnotationStatus();
    });

    propsFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const newConfig = JSON.parse(event.target.result);
                ui.populatePropertiesPanel(document.getElementById('properties-form'), newConfig);
                alert('Successfully loaded new properties file.');
            } catch (error) {
                alert('Failed to parse JSON from properties file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    setAnnotDirBtn.addEventListener('click', async () => {
        const path = annotDirInput.value.trim();
        if (!path) return;
        try {
            await api.setAnnotationDirectory(path);
            alert(`Annotation directory set to:\n${path}`);
            await ui.updateAnnotationStatus();
        } catch (error) {
            alert(`Error setting directory: ${error.message}`);
        }
    });

    saveBtn.addEventListener('click', async () => {
        if (!state.currentImageName) {
            alert('Please select an image first.');
            return;
        }
        await api.saveAnnotations(state.currentImageName, state.rois);
        await ui.updateAnnotationStatus();
        alert('Annotations saved!');
    });

    resetViewBtn.addEventListener('click', () => {
        if (!state.currentImage) return;
        canvas.zoomToFit(canvasElem, state.currentImage.width, state.currentImage.height);
        canvas.redraw(canvasElem, ctx);
    });

    canvasElem.addEventListener('mousedown', e => {
        if (!state.currentImage) return;
        if (e.button === 1) {
            e.preventDefault();
            state.isPanning = true;
            state.panStart.x = e.clientX;
            state.panStart.y = e.clientY;
            canvasElem.classList.add('panning');
        } else if (e.button === 0) {
            const pos = canvas.getMousePos(canvasElem, e);
            state.startX = pos.x;
            state.startY = pos.y;
            state.isDrawing = true;
        }
    });

    canvasElem.addEventListener('mousemove', e => {
        if (state.isPanning) {
            const dx = e.clientX - state.panStart.x;
            const dy = e.clientY - state.panStart.y;
            state.panStart.x = e.clientX;
            state.panStart.y = e.clientY;
            state.originX -= dx / state.scale;
            state.originY -= dy / state.scale;
            canvas.redraw(canvasElem, ctx);
        } else if (state.isDrawing) {
            const pos = canvas.getMousePos(canvasElem, e);
            state.currentRoi = {
                x: Math.min(state.startX, pos.x),
                y: Math.min(state.startY, pos.y),
                w: Math.abs(pos.x - state.startX),
                h: Math.abs(pos.y - state.startY),
            };
            canvas.redraw(canvasElem, ctx);
        }
    });

    canvasElem.addEventListener('mouseup', e => {
        if (state.isPanning) {
            state.isPanning = false;
            canvasElem.classList.remove('panning');
        }
        if (state.isDrawing) {
            state.isDrawing = false;
            if (state.currentRoi.w > 5 / state.scale && state.currentRoi.h > 5 / state.scale) {
                state.currentRoi.properties = { ...state.currentProperties };
                state.rois.push(state.currentRoi);
            }
            state.currentRoi = {};
            canvas.redraw(canvasElem, ctx);
        }
    });

    canvasElem.addEventListener('contextmenu', e => {
        e.preventDefault();
        if (!state.currentImage) return;
        const pos = canvas.getMousePos(canvasElem, e);
        let roiToDelete = -1;
        for (let i = state.rois.length - 1; i >= 0; i--) {
            const roi = state.rois[i];
            if (pos.x >= roi.x && pos.x <= roi.x + roi.w && pos.y >= roi.y && pos.y <= roi.y + roi.h) {
                roiToDelete = i;
                break;
            }
        }
        if (roiToDelete !== -1) {
            if (confirm(`Delete ROI "${state.rois[roiToDelete].properties.Class?.name || 'Untitled'}"?`)) {
                state.rois.splice(roiToDelete, 1);
                canvas.redraw(canvasElem, ctx);
            }
        }
    });

    canvasElem.addEventListener('wheel', e => {
        if (!state.currentImage) return;
        e.preventDefault();
        const pos = canvas.getMousePos(canvasElem, e);
        const zoom = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = Math.max(CONSTANTS.MIN_SCALE, Math.min(CONSTANTS.MAX_SCALE, state.scale * zoom));
        const newOriginX = pos.x - (e.clientX - canvasElem.getBoundingClientRect().left) / newScale;
        const newOriginY = pos.y - (e.clientY - canvasElem.getBoundingClientRect().top) / newScale;
        state.scale = newScale;
        state.originX = newOriginX;
        state.originY = newOriginY;
        canvas.redraw(canvasElem, ctx);
    });
}