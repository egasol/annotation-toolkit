// js/canvas.js
// Handles all canvas rendering and transformations.

import { state } from './state.js';

export function getMousePos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    return {
        x: (canvasX / state.scale) + state.originX,
        y: (canvasY / state.scale) + state.originY,
    };
};

export function zoomToFit(canvas, imageWidth, imageHeight) {
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    const scaleX = canvasWidth / imageWidth;
    const scaleY = canvasHeight / imageHeight;
    state.scale = Math.min(scaleX, scaleY);
    state.originX = (imageWidth - canvasWidth / state.scale) / 2;
    state.originY = (imageHeight - canvasHeight / state.scale) / 2;
};

export function redraw(canvas, ctx) {
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#e9e9e9';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.translate(-state.originX * state.scale, -state.originY * state.scale);
    ctx.scale(state.scale, state.scale);

    if (state.currentImage) {
        ctx.imageSmoothingEnabled = state.scale < 1;
        ctx.drawImage(state.currentImage, 0, 0);
    } else {
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        ctx.font = '20px Arial';
        const worldCenterX = (canvasWidth / 2) / state.scale + state.originX;
        const worldCenterY = (canvasHeight / 2) / state.scale + state.originY;
        ctx.fillText("Select an image to begin", worldCenterX, worldCenterY);
    }

    state.rois.forEach(roi => {
        ctx.strokeStyle = 'lime';
        ctx.lineWidth = 2 / state.scale;
        ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
        const label = roi.properties.Class?.name || 'Untitled';
        ctx.font = `${16 / state.scale}px Arial`;
        ctx.fillStyle = 'lime';
        ctx.fillText(label, roi.x, roi.y > 10 / state.scale ? roi.y - 5 / state.scale : roi.y + roi.h + 15 / state.scale);

        let iconOffsetY = 0;
        const iconSize = 24 / state.scale;
        Object.values(roi.properties).forEach(propValue => {
            const iconName = propValue?.icon;
            if (iconName && state.iconCache[iconName]?.complete) {
                const iconImg = state.iconCache[iconName];
                const iconX = roi.x + roi.w - iconSize;
                const iconY = roi.y + iconOffsetY;
                if (iconY + iconSize <= roi.y + roi.h) {
                    ctx.drawImage(iconImg, iconX, iconY, iconSize, iconSize);
                    iconOffsetY += iconSize;
                }
            }
        });
    });

    if (state.isDrawing && state.currentRoi.w && state.currentRoi.h) {
        ctx.strokeStyle = 'yellow';
        ctx.lineWidth = 2 / state.scale;
        ctx.strokeRect(state.currentRoi.x, state.currentRoi.y, state.currentRoi.w, state.currentRoi.h);
    }
    ctx.restore();
};